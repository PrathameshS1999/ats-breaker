# Changelog

## v8 — 19 Nov 2026: fixes from the round-2 Jobscan comparison

### How the bugs were found
Round 2 used five resumes, each tailored to one cloud/DevOps/SRE role in Ireland: BearingPoint
(Azure Cloud Engineer), Mastercard (Software Engineer II, SRE/DevOps), Fidelity (Senior Cloud
Engineer, Galway), IBM (Cloud Infrastructure / DevOps Engineer, Azure) and Stripe (Corporate Systems
Engineer). Each was scanned in ATS_Breaker and Jobscan. ATS_Breaker was 29 points below Jobscan
on IBM and 8 below on Stripe, and most of that gap traced back to the bugs below.
Write-up and screenshots: `~/Downloads/ats-comparison-screenshots/round2/` (RESULTS-round2.md).

### Bugs fixed (`js/scan-score.js`, `js/scan-keywords.js`)
| # | Bug | Example | Fix |
| --- | --- | --- | --- |
| 1 | More task wording became keywords | "deploy ARM templates", "diagnose performance" | `TASK_VERB` gains deploy, diagnose, author, scale, write, integrate, migrate, automate, install, handle, plan |
| 2 | Broken fragment became a keyword | "point to- site" (from "point-to-site") | Words with a dangling hyphen, or stop words hidden behind one, are rejected |
| 3 | Job title with "/" only partly matched | IBM "Cloud Infrastructure / DevOps Engineer" scored 8/10 with the exact title in the resume | Title words may be separated by spaces, "/", ",", "\|" or dashes |
| 4 | "and/or" lists weren't either/or | Stripe "Puppet, Chef, Ansible, and/or Terraform": Puppet and Chef missing despite Terraform | "and/or" joins an either/or chain |
| 5 | Adjective-led phrase became a keyword | "reliable software systems" | New `LEAD_ADJ` list (reliable, scalable, robust, complex…) |
| 6 | One skill counted twice | "verbal communication skills" → verbal communication + communication skills | Overlapping known-term hits count once (the earlier one wins) |
| — | Fix 1 dropped a real skill | "ARM templates" vanished with "deploy ARM templates" | Added known terms "ARM templates" (Azure Resource Manager templates) and "Bicep" |

### Effect on the round-2 resumes (ATS_Breaker)
| Job | Before | After | Jobscan |
| --- | --- | --- | --- |
| BearingPoint | 81 | 81 | 100 |
| Mastercard | 83 | 83 | 69 |
| Fidelity | 70 | 71 | 63 |
| IBM | 69 | **78** | 98 |
| Stripe | 74 | **81** | 82 |
| Average | 75 | **79** | 82 |

### Tests
8 new tests in `tests/scan-tests.html`; 77 of 77 pass.

### Known limitations still open
- A skill named in a "can't do yet" sentence still counts. IBM's resume says "ARM templates
  … would be new", and both tools count it as present.
- The skills table still costs 6 parse points on every one of these resumes. That's a finding
  about the resume, not a bug.

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
