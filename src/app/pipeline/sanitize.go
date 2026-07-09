package pipeline

import (
	"regexp"
	"strings"
)

var (
	reScript     = regexp.MustCompile(`(?is)<script[\s\S]*?</script>`)
	reScriptOpen = regexp.MustCompile(`(?is)<script[^>]*>`)
	// canvas elements require JS to render — strip them and their contents
	reCanvas     = regexp.MustCompile(`(?is)<canvas[^>]*>[\s\S]*?</canvas>`)
	reCanvasVoid = regexp.MustCompile(`(?is)<canvas[^>]*/?>`)
)

// SanitizeHTML strips <script> and <canvas> tags from LLM-generated HTML.
// Canvas elements are removed because their Chart.js scripts are also
// stripped, which would otherwise leave blank space.
func SanitizeHTML(html string) string {
	html = reScript.ReplaceAllString(html, "")
	html = reScriptOpen.ReplaceAllString(html, "")
	html = reCanvas.ReplaceAllString(html, "")
	html = reCanvasVoid.ReplaceAllString(html, "")
	return html
}

// StripMarkdownFences removes ```html or ```json wrapper fences that LLMs
// sometimes add around otherwise-valid output.
func StripMarkdownFences(s string) string {
	s = strings.TrimSpace(s)
	re := regexp.MustCompile("(?s)^```(?:html|json)?\\s*|\\s*```$")
	return strings.TrimSpace(re.ReplaceAllString(s, ""))
}
