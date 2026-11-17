# ATS_Breaker

See your resume the way the ATS does. Add your resume and the job description and get
three checks (parse, match, recruiter) and a ranked list of what to change.

- Runs entirely in the browser: resumes are read on the visitor's device and never uploaded.
- Free, no account, nothing stored.
- Plain HTML, CSS and JavaScript. No build step. Open `index.html`, or upload the folder to any static host.

## Structure

| Path | What |
| --- | --- |
| `index.html` | Scan form and live results |
| `example-report.html` | Example report |
| `how-scoring-works.html` | How the scores are calculated |
| `privacy.html`, `about.html`, `report.html` | Supporting pages |
| `css/styles.css` | All design tokens and components |
| `js/` | Page behaviour (`main.js`) and the scan (`scan-*.js`) |
| `js/vendor/pdfjs/` | Mozilla pdf.js 3.11.174 (Apache-2.0), used to read PDFs |
| `design-system/` | The original X-ray design system the site is built from |

See `CLAUDE.md` for design rules and implementation notes.

Scores are estimates of fit. They don't reproduce any employer's system.

Built by Prathamesh Shinde · [prathameshshinde.com](https://prathameshshinde.com)
