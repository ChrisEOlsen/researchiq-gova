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
        <th style="text-align:left;padding:0.625rem 0.75rem;background:#f5f0ea;border:1px solid #e8e0d8;font-weight:600;color:#292524;">Cause / Factor</th>
        <th style="text-align:left;padding:0.625rem 0.75rem;background:#f5f0ea;border:1px solid #e8e0d8;font-weight:600;color:#292524;">Effect / Outcome</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:0.625rem 0.75rem;border:1px solid #e8e0d8;vertical-align:top;">...</td>
        <td style="padding:0.625rem 0.75rem;border:1px solid #e8e0d8;vertical-align:top;">...</td>
      </tr>
    </tbody>
  </table>
  </div>
  ```

  **Option B — numbered CSS step-list** (best for sequential processes, pipelines, mechanisms):
  ```html
  <ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0.75rem;">
    <li style="display:flex;align-items:flex-start;gap:1rem;background:#faf8f5;border:1px solid #e8e0d8;border-radius:6px;padding:1rem;">
      <span style="flex-shrink:0;width:2rem;height:2rem;background:#c0392b;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem;">1</span>
      <div>
        <strong style="display:block;margin-bottom:0.25rem;color:#292524;">Step title</strong>
        <span style="color:#78716c;font-size:0.9rem;">Brief explanation of what happens at this step.</span>
      </div>
    </li>
    <!-- repeat for each step -->
  </ol>
  ```
- Statistics/comparisons → plain CSS bars (NO Chart.js, NO canvas — scripts are stripped at render time)
- Key findings with narrative → editorial cards with clear hierarchy
- Cause-effect or timeline → CSS central-line layout with cards

## Style Rules
- **Fonts**: Playfair Display (headings) + Inter (body) via Google Fonts CDN
- **Palette**: bg `#faf8f5`, text `#292524`, accent `#c0392b`, muted `#78716c`, border `#e8e0d8`
  OR choose your own warm, non-neon palette
- **Shadows**: max `0 2px 8px rgba(0,0,0,0.08)` — no dramatic shadows
- **Border radius**: max 8px — no pill shapes, no 20px+ radius
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
