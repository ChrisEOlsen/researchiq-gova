# Visual Explainer — Embedded Prompt Guide

When generating the `visual_html` field, create a beautiful, self-contained HTML page
that visually explains the research findings to a client. Follow these principles:

---

## Structure — Match Content to Approach
- Mechanisms/processes → Use one of these two mobile-friendly alternatives. **Do NOT use Mermaid or any JavaScript-dependent chart library for process flows.**

  **Option A — HTML table** (best for cause → effect, comparisons, or 2-column relationships):
  ```html
  <div style="overflow-x:auto;">
  <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
    <thead>
      <tr>
        <th style="text-align:left;padding:0.625rem 0.75rem;background:#eef2f1;border:1px solid #dce3e1;font-weight:600;color:#14333c;">Cause / Factor</th>
        <th style="text-align:left;padding:0.625rem 0.75rem;background:#eef2f1;border:1px solid #dce3e1;font-weight:600;color:#14333c;">Effect / Outcome</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:0.625rem 0.75rem;border:1px solid #dce3e1;vertical-align:top;">...</td>
        <td style="padding:0.625rem 0.75rem;border:1px solid #dce3e1;vertical-align:top;">...</td>
      </tr>
    </tbody>
  </table>
  </div>
  ```

  **Option B — numbered CSS step-list** (best for sequential processes, pipelines, mechanisms):
  ```html
  <ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0.75rem;">
    <li style="display:flex;align-items:flex-start;gap:1rem;background:#f6f8f7;border:1px solid #dce3e1;border-radius:8px;padding:1rem;">
      <span style="flex-shrink:0;width:2rem;height:2rem;background:#14333c;color:#f6f8f7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.875rem;">1</span>
      <div>
        <strong style="display:block;margin-bottom:0.25rem;color:#14333c;">Step title</strong>
        <span style="color:#5a7178;font-size:0.9rem;">Brief explanation of what happens at this step.</span>
      </div>
    </li>
    <!-- repeat for each step -->
  </ol>
  ```
- Statistics/comparisons → plain CSS bars (NO Chart.js, NO canvas — scripts are stripped at render time)
- Key findings with narrative → editorial cards with clear hierarchy
- Cause-effect or timeline → CSS central-line layout with cards

## Style Rules
- **Fonts**: Spectral (headings; weights 300/500/600, italic for annotations) + IBM Plex Sans (body) via Google Fonts CDN
- **Palette**: bg `#f6f8f7` (cool lab paper), ink text `#14333c`, data accent `#0e7a63` (teal),
  highlight `#fde85c` (highlighter yellow — badges and key-finding marks only), muted `#5a7178`, border `#dce3e1`
  OR choose your own cool, print-like, non-neon palette
- **Shadows**: max `0 2px 8px rgba(20,51,60,0.08)` — no dramatic shadows
- **Border radius**: max 12px — no pill shapes, no 20px+ radius
- **Animation**: simple staggered fade-in on load only (`@keyframes fadeIn`).
  Always include: `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`

---

## Content Requirements
- H1 title restating the research question (plain language, not academic)
- 2–4 key findings shown visually
- Each visual element has a short annotation explaining what it means in plain English
- Footer: "Based on peer-reviewed research"

## Technical Requirements
- Completely self-contained: all CSS inside `<style>` tags, no linked `.css` files
- Allowed CDN: Google Fonts only — NO Chart.js, NO canvas, NO JavaScript libraries
- Must render correctly at viewport widths 800px–1400px
- No JavaScript errors

## Forbidden Patterns
- `<canvas>` elements or Chart.js — scripts are stripped, leaving blank space
- Any `<script>` tags or external JS libraries
- Gradient mesh backgrounds
- Neon or glowing effects
- Animated pulsing/breathing elements
- Emoji icons in section headers
- Generic metric-card dashboard with no narrative
- Oversized rounded corners (>8px on cards)
- Linking SVGs externally — they MUST be inlined if used
- HTML entities in CSS `content` properties (e.g. `content: "&bull;"` renders literally as text). Use `list-style-type: disc` for bullets, or Unicode escapes: `\2022` (bullet •), `\2014` (em-dash —), `\2192` (arrow →)
