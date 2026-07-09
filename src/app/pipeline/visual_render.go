package pipeline

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"
)

//go:embed visual_templates/page-shell.html
var tmplPageShell string

//go:embed visual_templates/bar-chart.html
var tmplBarChart string

//go:embed visual_templates/step-list.html
var tmplStepList string

//go:embed visual_templates/html-table.html
var tmplHTMLTable string

//go:embed visual_templates/editorial-cards.html
var tmplEditorialCards string

//go:embed visual_templates/timeline.html
var tmplTimeline string

// VisualPage is the JSON structure the model returns for template-based
// visual synthesis: a title/subtitle plus a list of typed sections.
type VisualPage struct {
	Title    string            `json:"title"`
	Subtitle string            `json:"subtitle"`
	Sections []json.RawMessage `json:"sections"`
}

type sectionBase struct {
	Type string `json:"type"`
}

// BarChartSection holds data for a CSS horizontal bar chart.
type BarChartSection struct {
	Heading    string `json:"heading"`
	Annotation string `json:"annotation"`
	Bars       []struct {
		Label  string  `json:"label"`
		Value  float64 `json:"value"`
		Suffix string  `json:"suffix"`
	} `json:"bars"`
}

// StepListSection holds data for a numbered step list.
type StepListSection struct {
	Heading string `json:"heading"`
	Steps   []struct {
		Title string `json:"title"`
		Body  string `json:"body"`
	} `json:"steps"`
}

// HTMLTableSection holds data for a 2-column comparison table.
type HTMLTableSection struct {
	Heading string `json:"heading"`
	ColA    string `json:"col_a"`
	ColB    string `json:"col_b"`
	Rows    []struct {
		A string `json:"a"`
		B string `json:"b"`
	} `json:"rows"`
}

// EditorialCardsSection holds data for a grid of finding cards.
type EditorialCardsSection struct {
	Heading string `json:"heading"`
	Cards   []struct {
		Title string `json:"title"`
		Body  string `json:"body"`
		Badge string `json:"badge"`
	} `json:"cards"`
}

// TimelineSection holds data for a central-line timeline.
type TimelineSection struct {
	Heading string `json:"heading"`
	Events  []struct {
		Year  string `json:"year"`
		Title string `json:"title"`
		Body  string `json:"body"`
	} `json:"events"`
}

var visualFuncs = template.FuncMap{
	"add": func(a, b int) int { return a + b },
}

func renderSection(raw json.RawMessage) (string, error) {
	var base sectionBase
	if err := json.Unmarshal(raw, &base); err != nil {
		return "", fmt.Errorf("section base parse: %w", err)
	}
	var tmplSrc string
	var data interface{}
	switch base.Type {
	case "bar-chart":
		tmplSrc = tmplBarChart
		var s BarChartSection
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", fmt.Errorf("bar-chart parse: %w", err)
		}
		data = s
	case "step-list":
		tmplSrc = tmplStepList
		var s StepListSection
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", fmt.Errorf("step-list parse: %w", err)
		}
		data = s
	case "html-table":
		tmplSrc = tmplHTMLTable
		var s HTMLTableSection
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", fmt.Errorf("html-table parse: %w", err)
		}
		data = s
	case "editorial-cards":
		tmplSrc = tmplEditorialCards
		var s EditorialCardsSection
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", fmt.Errorf("editorial-cards parse: %w", err)
		}
		data = s
	case "timeline":
		tmplSrc = tmplTimeline
		var s TimelineSection
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", fmt.Errorf("timeline parse: %w", err)
		}
		data = s
	default:
		return "", fmt.Errorf("unknown section type: %q", base.Type)
	}
	t, err := template.New("").Funcs(visualFuncs).Parse(tmplSrc)
	if err != nil {
		return "", fmt.Errorf("parse %q template: %w", base.Type, err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute %q template: %w", base.Type, err)
	}
	return buf.String(), nil
}

// RenderVisualPage renders a VisualPage to a complete self-contained HTML
// document by type-switching each section on its "type" discriminator,
// rendering it through the matching text/template, and wrapping the
// concatenated body in the page shell. Returns an error on an unknown
// section type or a template-execute failure — the caller
// (synthesizeVisual) falls back to the Sonnet freeform-HTML path in
// either case.
func RenderVisualPage(page VisualPage) (string, error) {
	var body strings.Builder
	for i, raw := range page.Sections {
		html, err := renderSection(raw)
		if err != nil {
			return "", fmt.Errorf("section %d: %w", i, err)
		}
		body.WriteString(html)
	}
	type shellData struct {
		Title       string
		Subtitle    string
		BodyContent string
	}
	t, err := template.New("shell").Funcs(visualFuncs).Parse(tmplPageShell)
	if err != nil {
		return "", fmt.Errorf("parse shell template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, shellData{
		Title:       page.Title,
		Subtitle:    page.Subtitle,
		BodyContent: body.String(),
	}); err != nil {
		return "", fmt.Errorf("execute shell template: %w", err)
	}
	return buf.String(), nil
}
