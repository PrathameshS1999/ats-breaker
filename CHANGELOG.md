# Changelog

## v7 — 18 Nov 2026: fixes from the Jobscan comparison

### How the bugs were found
One real resume was tailored to five real job ads: BearingPoint (Azure Cloud Engineer),
Mastercard (Senior SWE, AI), Fidelity (Senior SWE/Developer, AWS), IBM (Azure DevOps
Engineer) and Stripe (Full-Stack SWE). Each was scanned in ATS_Breaker and in Jobscan's free
plan. The two tools agreed within 3–7 points on four jobs. On BearingPoint they were 24 points
apart (76 vs 100), and reading the results line by line turned up the bugs below.
The full write-up and screenshots live outside the repo, in
`~/Downloads/ats-comparison-screenshots/` (RESULTS.md).

### Bugs fixed (`js/scan-score.js`, `js/scan-keywords.js`, `js/scan-ui.js`)
| # | Bug | Example | Fix |
| --- | --- | --- | --- |
| 1 | Task wording from job bullets became "keywords" | "operate cloud environments", "navigate ambiguity", "make hard decisions", "performing software development" | Generic phrases that start with a task verb (`TASK_VERB`) are skipped |
| 2 | Vague nouns became keywords | "technical requirements", "organisational standards", "publishing efforts", "large-scale enterprise environments" | `VAGUE` word list (environments, requirements, standards, efforts, solutions…) |
| 3 | Half-phrases ending in an adjective, and "for/in" | "complex technical", "for/in multiple platforms" | `TRAIL_ADJ` list; slash-joined stop words rejected |
| 4 | "Key Competencies" heading counted as a keyword | Mastercard | `(key \|core )?competencies` is now a heading |
| 5 | "You have…" forced Preferred skills to Required | Stripe: Ruby, TypeScript under "Preferred qualifications" | Removed "you have" from `INLINE_REQ` |
| 6 | Either/or grabbed "Azure" out of "Azure Kubernetes Service" | IBM: Docker "Covered by Azure" | AKS alias "Azure Kubernetes Service", so the longer name wins |
| 7 | "Covered by" could name a skill that was itself only covered | IBM: AKS "Covered by Docker" | Coverage always names a skill the resume really has |
| 8 | "rewards" matched "compensation and benefits" | Stripe: "one of our greatest rewards" | Alias changed from "reward" to "total reward" |
| 9 | Skills-list items counted as experience bullets | "4 of 30 bullets" (30 = 16 real + 14 skills lines) | `NOT_BULLETS`: skills, certifications and education lists are skipped |
| 10 | Same word shown as an alias | 'As "runbooks"' for the keyword runbooks | Alias only shown when the word really differs (ignoring plurals) |
| 11 | A table layout was titled "Two columns" | Every scan of a resume with a skills table | Issue carries its own title: "Table layout" or "Two columns" |

Also in this release (from earlier, uncommitted):
- `css/styles.css`: a long file name no longer widens the resume column over the job
  description (`.field` grid uses `minmax(0, 1fr)`).

### Effect on the five tailored resumes (ATS_Breaker, standard matching)
| Job | Before | After | Recruiter readiness before → after |
| --- | --- | --- | --- |
| BearingPoint | 76 | 81 | Competitive 73 → Strong 87 |
| Mastercard | 49 | 49 | Competitive 60 → Competitive 73 |
| Fidelity | 58 | 60 | Competitive 67 → Strong 80 |
| IBM | 77 | 79 | Competitive 73 → Strong 87 |
| Stripe | 41 | 41 | Needs work 47 → Competitive 60 |

Jobscan for the same resumes: 100, 56, 55, 74, 48. ATS match scores moved only where the junk
keywords had been dragging them down. Recruiter readiness rose everywhere, because the bullet
checks now look at real bullets only.

### Tests
`tests/scan-tests.html`: the 55 existing tests plus 14 new ones, one or more for each bug
above. 69 of 69 pass.

### Known limitations still open
- Known skills in "About the team" / overview text count as Required by default (Stripe:
  "UI", "API design"). That's arguably right for a skill the job names, but it isn't
  marked Preferred.
- Both tools still flag real gaps that rewording can't fix: AZ-900 (BearingPoint);
  LLMs/RAG/LangChain (Mastercard); Zope/SaltStack/Sentry (Fidelity); Java and SC clearance (IBM);
  React/TypeScript/Ruby (Stripe).
- The resume's skills table still costs 6 parse points. That's a finding about the resume,
  not a bug.

## v5 and earlier
See git history: initial site, in-browser scan, 1,100-term keyword list, Netlify config,
optional Smart matching (BGE small).
