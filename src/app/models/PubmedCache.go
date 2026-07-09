package models

import (
	"database/sql"
)

type PubmedCacheModel struct {
	readDB  *sql.DB
	writeDB *sql.DB
}

func NewPubmedCacheModel(readDB, writeDB *sql.DB) *PubmedCacheModel {
	return &PubmedCacheModel{readDB: readDB, writeDB: writeDB}
}

func (m *PubmedCacheModel) GetMany(pmids []string) (map[string]string, error) {
	result := make(map[string]string)
	for _, pmid := range pmids {
		var abstractJSON string
		err := m.readDB.QueryRow("SELECT abstract_json FROM pubmed_cache WHERE pmid = ?", pmid).Scan(&abstractJSON)
		if err == nil {
			result[pmid] = abstractJSON
		} else if err != sql.ErrNoRows {
			return nil, err
		}
	}
	return result, nil
}

func (m *PubmedCacheModel) Store(pmid string, abstractJSON string) error {
	_, err := m.writeDB.Exec("INSERT OR REPLACE INTO pubmed_cache (pmid, abstract_json, fetched_at) VALUES (?, ?, CURRENT_TIMESTAMP)", pmid, abstractJSON)
	return err
}

// PruneOlderThan30Days is called on a 24h ticker from main.go, not just
// once at startup — GOTHA's janitor only ran at process boot (Known Bug #5).
func (m *PubmedCacheModel) PruneOlderThan30Days() error {
	_, err := m.writeDB.Exec("DELETE FROM pubmed_cache WHERE fetched_at < datetime('now', '-30 days')")
	return err
}
