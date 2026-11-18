# ATS_Breaker site — notes for future sessions

Static site: plain HTML, one stylesheet, vanilla JS. No framework, no build step, no npm.
Opens from `index.html` (works from file:// too); deploys by uploading the folder.
Relative paths only.

## Source of truth
`design-system/` holds the original X-ray design system (`index.html` mockup,
`README.md` rules, `preview-full-page.png`). Every colour, font, component and word
comes from there. Don't invent content or add sections it doesn't ask for.
`design-system/` doesn't need to be uploaded with the site.

## Design rules (X-ray)
- Dark film ground `#0E1419`, panels `#141C23`, inputs `#0B1115`, ATS view `#081014`.
- Text `#E4ECF1`, secondary `#C3D0D9`, muted `#93A4B1`, borders `#263440`.
- X-ray cyan `#7FD6E6` for actions only (text on it `#0E1419`); links `#9EE0EC`.
- Status: Matched ✓ `#5BD08F`, Partial ◐ `#F2C14E`, Missing ✕ `#FF8A73`.
  Always an icon AND a word, never colour alone.
- JetBrains Mono: headings, scores, labels (labels uppercase, letter-spaced).
  Source Sans 3: body at 16px. Loaded from Google Fonts.
- 4px corners, 1px slate borders, no glow, no shadows. 48px between sections.
- Faint scan lines only in the ATS view (`.xray`).
- All tokens are CSS variables at the top of `css/styles.css`.

## Pages
| File | What |
| --- | --- |
| `index.html` | Hero + scan form. Running a scan renders the full results below it (`#results`). |
| `example-report.html` | Static results page with the design system's invented example (Aoife Byrne / Northwind Cloud). |
| `how-scoring-works.html` | The scoring the scan actually uses: ATS parts, six rubric items, band cut-offs, parse checks. |
| `privacy.html` | Short privacy promises + placeholder for the full policy. |
| `about.html` | Who built it + placeholder for the owner's own words. |
| `report.html` | "Report a wrong result" form. |

Header and footer are identical on every page (only `aria-current="page"` differs in
the nav). When changing either, change all six files.

**Cache busting:** CSS/JS links carry `?v=N`. Bump N in every page whenever CSS or JS
changes, or returning visitors may run old JS against new HTML.

## The scan (runs entirely in the browser; nothing is uploaded)
Loaded on `index.html` only, in this order:
- `js/scan-keywords.js` — ~1,100 known skills/tools/certs across industries
  (`"Canonical|alias"`, `!` = cert), related-term credit (GitLab CI → CI/CD, Xero →
  accounting), `CASE_SENSITIVE` words, and `AMBIGUOUS` words (Go, R, C, Lean, Swift,
  spoken languages…) that only count in a list or next to context words (`CONTEXT`).
  Short all-caps acronyms (SEO, CRM, QA) automatically match in capitals only.
- `js/scan-read.js` — `ATS.readResume(file, text)`: PDF via pdf.js (lazy-loaded),
  DOCX via a small built-in unzip + `DecompressionStream`, or pasted text. Detects
  two-column PDFs (a gutter nothing crosses), DOCX headers with contact details, table
  layouts, text boxes. Builds the "ATS view" (lines read straight across). Errors:
  `scanned` (shows the design's scanned-image panel), `encrypted`, `unreadable`, `nodocx`.
- `js/scan-score.js` — `ATS.analyseJD` (title, level, years incl. "three years", degree,
  keywords; Required/Preferred from headings in `HEADINGS` incl. Markdown/bold, and
  overridden by in-sentence phrases like "is a plus", "ideally", "must"; either/or groups
  like "ACCA or CIMA" where one covers the rest). Dates: many formats (`parseDate`,
  "2019–21", "06/2020", "Summer 2021", "Q3 2022", "since 2019"), role durations
  ("(3 years)") and a stated "N years of experience" fallback.
  `ATS.score` (hard skills 40, job title 10,
  experience 20, education/certs 10, parse 20; six rubric items rated Strong 100 /
  Competitive 60 / Needs work 20, averaged: ≥75 Strong, 50–74 Competitive; fixes ranked
  by estimated gain). Keep `how-scoring-works.html` in step with any change here.
- `js/scan-ui.js` — runs the scan with the scanning steps, renders results using the
  same components as the example report, live "We detected" row, rescan comparison.
- `js/vendor/pdfjs/` — pdf.js 3.11.174 (Apache-2.0), verified against cdnjs SRI hashes.
  Kept on 3.x because it is a classic script that works from file:// (4.x+ is
  ES-module only). Loaded with `isEvalSupported: false` (CVE-2024-4367 mitigation).
sessionStorage keeps only a score snapshot (`ats-last-scan`, no resume text) so a rescan
of the same job description can show "Since your first scan", plus ticked fixes.

## Forms
Real `<form>` elements with a `name` on every field.
- `index.html` `form[name=scan]`: `resume` (file, PDF/DOCX ≤ 5 MB) or `resume_text`,
  plus `job_description`. Has `data-local-scan`: handled by the in-browser scan.
- `form[name=feedback]` (example report and live results): `report`, `accurate`
  (+ `ats` on live results). Not connected yet.
- `report.html` `form[name=report]`: `check`, `details`. Not connected yet.

`js/main.js` handles all forms with one module:
- Validators live in the `validators` object, keyed by the form's `name`. Errors show
  in the `#<field-id>-err` element (icon + words) and set `aria-invalid`; focus goes to
  the first bad field.
- While a form has `data-no-handler` (or no `action`), a valid submit shows
  `data-pending-msg` ("…isn't connected yet, so nothing was sent"). Nothing is cleared.
- To connect a form: set `action` (and `method`), remove `data-no-handler`. It then
  POSTs `FormData` with fetch, disables its buttons while sending (no double submits),
  and shows `data-success-msg` on a 2xx or `data-error-msg` otherwise.
  `data-reset-on-success` clears the report form after a successful send.
- `ATS.bindForm(form)` binds forms added later (the live results' feedback form).

## Other behaviour (js/main.js, event delegation so it works on live results too)
Keyword filter buttons (aria-pressed), fix tick-off saved in sessionStorage,
"Download report (PDF)" = browser print dialog (print CSS hides chrome and the form),
"Copy fix list" with a screen-reader status, and links like `#job_description` / `#scan`
focus that field.

## Owner's real details
- Name and site: "Built by Prathamesh Shinde · prathameshshinde.com" in the footer
  of every page, and on `about.html`.
- Content still owed is marked `TODO-CONTENT` (HTML comment + dashed `.todo` box):
  `privacy.html` full policy, `about.html` personal note. `grep -rn TODO-CONTENT *.html`.
- No photos are needed by the design; `images/` is empty apart from a note.
