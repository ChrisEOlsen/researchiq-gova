package pipeline

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	// canvas elements require JS to render — strip them and their contents.
	// Kept as a targeted regex pass (rather than folded into the allowlist
	// policy below) because Chart.js-driven <canvas> is a known dead-end
	// output shape from the visual-synthesis prompts, not a general HTML
	// construct worth modelling in the policy.
	reCanvas     = regexp.MustCompile(`(?is)<canvas[^>]*>[\s\S]*?</canvas>`)
	reCanvasVoid = regexp.MustCompile(`(?is)<canvas[^>]*/?>`)

	// reStyleBlock isolates <style>...</style> bodies so they can be
	// checked for legacy CSS-based injection patterns. bluemonday does not
	// sanitize the raw text content of <style> elements (see htmlPolicy
	// below) since it has no CSS parser for block-level style sheets, only
	// for the "style" attribute — this regex is the defense-in-depth
	// backstop for that gap.
	reStyleBlock = regexp.MustCompile(`(?is)<style[^>]*>([\s\S]*?)</style>`)

	// unsafeCSSPattern flags legacy/dangerous CSS constructs: IE's
	// expression()/behavior:, Firefox's -moz-binding, @import (can load
	// external stylesheets/track requests), and javascript:/vbscript:
	// pseudo-URLs, plus any url(...) at all — the visual pages have no
	// legitimate need to load external resources from CSS (design guide:
	// "Google Fonts CDN only", loaded via <link>, never via CSS).
	unsafeCSSPattern = regexp.MustCompile(`(?i)expression\s*\(|url\s*\(|@import|javascript:|vbscript:|-moz-binding|behaviou?r\s*:`)
)

// visualStyleProperties is the CSS property allowlist for the "style"
// attribute on any element in AI-generated visual explainer HTML. It covers
// every property used by the embedded templates (visual_templates/*.html)
// and the freeform-HTML design guide (visual_explainer.md), which both rely
// heavily on inline style="" for layout since the output must be a single
// self-contained document.
var visualStyleProperties = []string{
	"width", "height", "max-width", "min-width", "max-height", "min-height",
	"margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
	"padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
	"display", "flex", "flex-direction", "flex-wrap", "flex-shrink", "flex-grow",
	"align-items", "align-self", "justify-content", "justify-items", "gap",
	"grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
	"background", "background-color", "color", "opacity",
	"border", "border-color", "border-width", "border-style", "border-radius",
	"border-top", "border-bottom", "border-left", "border-right",
	"border-collapse",
	"font-size", "font-weight", "font-family", "font-style",
	"text-align", "text-transform", "text-decoration", "line-height",
	"letter-spacing", "white-space", "vertical-align",
	"list-style", "list-style-type",
	"box-shadow", "box-sizing", "overflow", "overflow-x", "overflow-y",
	"position", "top", "left", "right", "bottom", "z-index",
	"animation", "transition", "transform", "cursor", "content",
}

// htmlPolicy is an allowlist-based sanitizer for the AI-generated visual
// explainer documents. Unlike typical bluemonday use (sanitizing a fragment
// of user content dropped into an existing page), both AI paths in this
// pipeline (synthesizeVisualTemplate / synthesizeVisualFallback) produce a
// complete, self-contained <!DOCTYPE html> document, so the policy has to
// allow the document-shell elements bluemonday's UGCPolicy deliberately
// excludes (html/head/body/title/meta/link/style), on top of UGCPolicy's
// safe defaults for rich content (headings, tables, lists, links restricted
// to safe URL schemes, no script/event-handler attributes, no iframe/object/
// embed/svg).
var htmlPolicy = newVisualHTMLPolicy()

func newVisualHTMLPolicy() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()

	// Document-shell elements. AllowUnsafe is required for the <style>
	// element's raw CSS text content to survive at all (bluemonday drops
	// <style> tag *and* its content whenever AllowUnsafe is false,
	// regardless of AllowElements — see sanitize.go's html.TextToken
	// handling in the bluemonday source). This does NOT re-enable
	// <script>: script is never added via AllowElements below, and
	// bluemonday's default "skip content" set (populated in NewPolicy)
	// still drops both the <script> tag and its body unconditionally.
	p.AllowElements("html", "head", "body", "title", "style", "header", "footer", "main", "nav")
	p.AllowUnsafe(true)

	p.AllowAttrs("charset").Matching(regexp.MustCompile(`(?i)^utf-8$`)).OnElements("meta")
	p.AllowAttrs("name").Matching(regexp.MustCompile(`(?i)^(viewport|description)$`)).OnElements("meta")
	p.AllowAttrs("content").Matching(regexp.MustCompile(`^[\p{L}\p{N}\s\-_,\.=:/]*$`)).OnElements("meta")
	// Deliberately NOT allowing "http-equiv" — <meta http-equiv="refresh">
	// is a redirect/injection vector and has no legitimate use here.

	p.AllowAttrs("rel").Matching(regexp.MustCompile(`(?i)^(preconnect|dns-prefetch|preload|stylesheet|icon)$`)).OnElements("link")
	p.AllowAttrs("href").OnElements("link") // scheme validated by AllowStandardURLs (set by UGCPolicy)
	p.AllowAttrs("crossorigin").Matching(regexp.MustCompile(`(?i)^(anonymous|use-credentials|)$`)).OnElements("link")

	// class + style attributes, used pervasively by both the embedded
	// templates and the Sonnet freeform fallback (which relies on inline
	// style="" per the design guide, not an external stylesheet).
	p.AllowStyling() // class attribute, globally, token-matched
	p.AllowStyles(visualStyleProperties...).MatchingHandler(safeCSSValue).Globally()

	return p
}

func safeCSSValue(v string) bool {
	return !unsafeCSSPattern.MatchString(v)
}

// SanitizeHTML runs LLM-generated HTML through an allowlist-based sanitizer
// (bluemonday) that strips <script>, event-handler attributes (onerror=,
// onload=, onclick=, ...), javascript:/vbscript: URIs, <iframe>/<object>/
// <embed>/<svg>, <meta http-equiv="refresh">, and any tag/attribute/CSS
// property outside the allowlist. <canvas> is stripped separately (its
// Chart.js scripts are already stripped, which would otherwise leave blank
// space), and any residual legacy CSS injection pattern inside a <style>
// block (bluemonday does not parse block-level CSS) is scrubbed as a
// defense-in-depth backstop.
func SanitizeHTML(html string) string {
	trimmed := strings.TrimSpace(html)
	hadDoctype := len(trimmed) >= 9 && strings.EqualFold(trimmed[:9], "<!doctype")

	out := htmlPolicy.Sanitize(html)
	out = reCanvas.ReplaceAllString(out, "")
	out = reCanvasVoid.ReplaceAllString(out, "")
	out = reStyleBlock.ReplaceAllStringFunc(out, func(block string) string {
		if unsafeCSSPattern.MatchString(block) {
			return ""
		}
		return block
	})

	// bluemonday unconditionally drops the doctype token (it has no safe
	// parsing mechanism for arbitrary doctype content) — restore a
	// canonical one so the document still renders in standards mode
	// instead of falling back to quirks mode.
	trimmedOut := strings.TrimSpace(out)
	if hadDoctype && !(len(trimmedOut) >= 9 && strings.EqualFold(trimmedOut[:9], "<!doctype")) {
		out = "<!DOCTYPE html>\n" + out
	}
	return out
}

// StripMarkdownFences removes ```html or ```json wrapper fences that LLMs
// sometimes add around otherwise-valid output.
func StripMarkdownFences(s string) string {
	s = strings.TrimSpace(s)
	re := regexp.MustCompile("(?s)^```(?:html|json)?\\s*|\\s*```$")
	return strings.TrimSpace(re.ReplaceAllString(s, ""))
}
