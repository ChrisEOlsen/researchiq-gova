package pipeline

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gova/app/models"
)

const (
	esearchURL    = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
	efetchURL     = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
	httpUserAgent = "ResearchIQ/1.0 (health research tool)"
)

// PubMedSearch runs an esearch query against NCBI eUtils and returns PMIDs.
func PubMedSearch(query string, maxResults int) ([]string, error) {
	params := url.Values{
		"db":      {"pubmed"},
		"term":    {query},
		"retmax":  {fmt.Sprintf("%d", maxResults)},
		"sort":    {"relevance"},
		"retmode": {"json"},
	}
	if key := os.Getenv("NCBI_API_KEY"); key != "" {
		params.Set("api_key", key)
	}
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", esearchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", httpUserAgent)
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("esearch: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		ESearchResult struct {
			IDList []string `json:"idlist"`
		} `json:"esearchresult"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("esearch parse: %w", err)
	}
	return result.ESearchResult.IDList, nil
}

// PubMedFetchAbstracts resolves Study records for the given PMIDs,
// cache-first via cacheModel.GetMany, fetching only misses live from NCBI
// efetch and writing fresh fetches back via cacheModel.Store. Results are
// returned in the original pmids order (cache hits and fresh fetches
// merged back into that order), matching GOTHA's cacheLookup/cacheStore
// merge behavior but driven by the new model methods instead of
// package-level DB handles.
func PubMedFetchAbstracts(pmids []string, cacheModel *models.PubmedCacheModel) ([]Study, error) {
	if len(pmids) == 0 {
		return nil, nil
	}

	cached, err := cacheModel.GetMany(pmids)
	if err != nil {
		// Fail open: treat the cache as empty rather than failing the job.
		cached = map[string]string{}
	}

	hits := make(map[string]Study, len(cached))
	var misses []string
	for _, pmid := range pmids {
		raw, ok := cached[pmid]
		if !ok {
			misses = append(misses, pmid)
			continue
		}
		var s Study
		if err := json.Unmarshal([]byte(raw), &s); err != nil {
			// Corrupt cache entry — refetch live.
			misses = append(misses, pmid)
			continue
		}
		hits[pmid] = s
	}

	var fetched []Study
	if len(misses) > 0 {
		fetched, err = fetchFromPubMed(misses)
		if err != nil {
			return nil, err
		}
		for _, s := range fetched {
			raw, merr := json.Marshal(s)
			if merr != nil {
				continue
			}
			_ = cacheModel.Store(s.PubmedID, string(raw))
		}
	}
	fetchedByPMID := make(map[string]Study, len(fetched))
	for _, s := range fetched {
		fetchedByPMID[s.PubmedID] = s
	}

	result := make([]Study, 0, len(pmids))
	for _, pmid := range pmids {
		if s, ok := hits[pmid]; ok {
			result = append(result, s)
		} else if s, ok := fetchedByPMID[pmid]; ok {
			result = append(result, s)
		}
	}
	return result, nil
}

func fetchFromPubMed(pmids []string) ([]Study, error) {
	params := url.Values{
		"db":      {"pubmed"},
		"id":      {strings.Join(pmids, ",")},
		"rettype": {"abstract"},
		"retmode": {"xml"},
	}
	if key := os.Getenv("NCBI_API_KEY"); key != "" {
		params.Set("api_key", key)
	}
	req, err := http.NewRequest("GET", efetchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", httpUserAgent)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("efetch: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return parsePubMedXML(raw)
}

type pubmedArticleSet struct {
	XMLName  xml.Name        `xml:"PubmedArticleSet"`
	Articles []pubmedArticle `xml:"PubmedArticle"`
}

type pubmedArticle struct {
	MedlineCitation struct {
		PMID    string `xml:"PMID"`
		Article struct {
			ArticleTitle string `xml:"ArticleTitle"`
			AuthorList   struct {
				Authors []struct {
					LastName string `xml:"LastName"`
					Initials string `xml:"Initials"`
				} `xml:"Author"`
			} `xml:"AuthorList"`
			Abstract struct {
				AbstractTexts []struct {
					Label string `xml:"Label,attr"`
					Text  string `xml:",chardata"`
				} `xml:"AbstractText"`
			} `xml:"Abstract"`
			Journal struct {
				ISOAbbreviation string `xml:"ISOAbbreviation"`
				Title           string `xml:"Title"`
				JournalIssue    struct {
					PubDate struct {
						Year        string `xml:"Year"`
						MedlineDate string `xml:"MedlineDate"`
					} `xml:"PubDate"`
				} `xml:"JournalIssue"`
			} `xml:"Journal"`
		} `xml:"Article"`
	} `xml:"MedlineCitation"`
}

var reYear = regexp.MustCompile(`\d{4}`)

// parseYear extracts a 4-digit year from PubMed's Year or MedlineDate
// fields (which sometimes hold ranges/seasons like "2020 Jan-Feb" or
// "2019-2020"). Returns 0 if no year can be found.
func parseYear(s string) int {
	match := reYear.FindString(s)
	if match == "" {
		return 0
	}
	n, err := strconv.Atoi(match)
	if err != nil {
		return 0
	}
	return n
}

func parsePubMedXML(data []byte) ([]Study, error) {
	var set pubmedArticleSet
	if err := xml.Unmarshal(data, &set); err != nil {
		return nil, fmt.Errorf("pubmed xml parse: %w", err)
	}
	var studies []Study
	for _, a := range set.Articles {
		mc := a.MedlineCitation
		art := mc.Article
		title := strings.TrimSpace(art.ArticleTitle)
		if title == "" {
			continue
		}
		var authorParts []string
		for i, au := range art.AuthorList.Authors {
			if i >= 3 {
				authorParts = append(authorParts, "et al.")
				break
			}
			name := strings.TrimSpace(au.LastName + " " + au.Initials)
			if name != "" {
				authorParts = append(authorParts, name)
			}
		}
		var abParts []string
		for _, at := range art.Abstract.AbstractTexts {
			text := strings.TrimSpace(at.Text)
			if text == "" {
				continue
			}
			if at.Label != "" {
				abParts = append(abParts, at.Label+": "+text)
			} else {
				abParts = append(abParts, text)
			}
		}
		abstract := strings.Join(abParts, "\n")
		if abstract == "" {
			continue
		}
		yearStr := art.Journal.JournalIssue.PubDate.Year
		if yearStr == "" {
			yearStr = art.Journal.JournalIssue.PubDate.MedlineDate
		}
		journal := art.Journal.ISOAbbreviation
		if journal == "" {
			journal = art.Journal.Title
		}
		pmid := strings.TrimSpace(mc.PMID)
		studies = append(studies, Study{
			Title:    title,
			Authors:  strings.Join(authorParts, ", "),
			Year:     parseYear(yearStr),
			Journal:  journal,
			PubmedID: pmid,
			Abstract: abstract,
			URL:      "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/",
		})
	}
	return studies, nil
}
