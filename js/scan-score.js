/* ATS_Breaker scan: job description analysis and scoring.
   ATS.analyseJD(text)                 → what the job asks for
   ATS.score(model, jd, jdText, prev)  → everything the results page shows
   Weights follow the design: hard skills 40, job title 10, experience and seniority 20,
   education and certifications 10, parse quality 20. Six recruiter rubric items.
   Scores are estimates of fit; they don't reproduce any employer's system. */
(function () {
  "use strict";
  var ATS = window.ATS = window.ATS || {};

  /* ------------------------------------------------------------- matching */
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Short all-caps acronyms (SEO, CRM, IAM, QA, S3…) only count in capitals.
  function isAcronym(name) { return /^[A-Z0-9][A-Z0-9&/+#.\-]{1,5}$/.test(name) && /[A-Z]/.test(name); }

  function nameRe(name) {
    var cs = !!ATS.caseSensitive[name] || isAcronym(name);
    var p = escapeRe(name).replace(/-|\s+/g, "[\\s-]?");
    if (/[a-z]$/i.test(name) && name.length > 2) p += "(?:s|es)?";
    return new RegExp("(^|[^A-Za-z0-9+#&@])(" + p + ")(?![A-Za-z0-9+#&])", cs ? "g" : "gi");
  }
  var reCache = {};
  function re(name) { return reCache[name] || (reCache[name] = nameRe(name)); }

  // Ambiguous words (Go, R, Lean, Swift…) count only in a list or next to related words.
  var LIST_BEFORE = /[,/|(•·:;+&]\s*$|\band\s*$|\bor\s*$/i;
  var LIST_AFTER = /^\s*[,/|);+&]|^\s+(and|or)\s+[A-Z]/;
  function inContext(text, hit, kind) {
    var ls = text.lastIndexOf("\n", hit.start - 1) + 1;
    var le = text.indexOf("\n", hit.end);
    if (le < 0) le = text.length;
    var before = text.slice(ls, hit.start), after = text.slice(hit.end, le);
    if (/^[-–]/.test(after)) return false;          // "Go-to-market", "Go-live", "R-squared"
    // Alone on its line, or the only thing on a bullet line ("- Rust"): a list item
    if (/^\s*(?:[-•*●▪·]\s*)?$/.test(before) && /^\s*[.,;]?\s*$/.test(after)) return true;
    if (LIST_BEFORE.test(before) || LIST_AFTER.test(after)) return true;
    var ctx = ATS.context[kind];
    return !!ctx && ctx.test(before + " " + after);
  }

  function findAll(text, name) {
    var r = re(name), out = [], m;
    var amb = ATS.ambiguous && ATS.ambiguous[name];
    r.lastIndex = 0;
    while ((m = r.exec(text))) {
      var hit = { start: m.index + m[1].length, end: m.index + m[1].length + m[2].length, text: m[2] };
      if (!amb || inContext(text, hit, amb)) out.push(hit);
      if (m[0].length === 0) r.lastIndex++;
    }
    return out;
  }
  function has(text, name) { return findAll(text, name).length > 0; }

  /* ------------------------------------------------------ job description */
  // Section headings in a job description, and what they mean for keyword weight.
  var A = "(?:'|’)";
  var HEADINGS = [
    ["pref", "preferred(?: qualifications| skills| experience| requirements)?|nice[- ]to[- ]haves?|bonus(?: points)?|bonus if you(?: have)?|desirable(?: skills| criteria| requirements)?|good to have|great to have|it" + A + "s a plus|pluses|plus|even better|extra credit|optional|additional (?:skills|qualifications)|would be (?:great|nice|a plus)"],
    ["other", "(?:key |main |core )?responsibilities|(?:key |main )?duties|what you" + A + "ll do|what you will do|what you" + A + "ll be doing|day[- ]to[- ]day|in this role|the role|about the role|role overview|overview|job summary|about (?:us|the company|the team)|who we are|our team|benefits|what we offer|perks|compensation|salary|how to apply|equal opportunit\\w*|our values|why join us|why us"],
    ["req", "required(?: skills| qualifications| experience)?|requirements|minimum (?:requirements|qualifications)|basic qualifications|must[- ]haves?|essential(?: skills| criteria| requirements)?|key (?:skills|requirements)|what you" + A + "ll need|you" + A + "ll need|you will need|what we" + A + "re looking for|what we are looking for|who you are|about you|your profile|your skills|your experience|(?:the )?ideal candidate|you have|you bring|what you" + A + "ll bring|what you bring|you" + A + "ll bring|qualifications|skills(?: and experience| & experience| required)?|experience(?: required)?|person specification|candidate requirements|technical skills|competencies"]
  ];
  var MARKER_RE = new RegExp("(^|\\n|[.;]\\s+)[ \\t]*(?:[-•*#>]+[ \\t]*)?(?:\\*\\*|__)?(" +
    HEADINGS.map(function (h) { return h[1]; }).join("|") + ")(?:\\*\\*|__)?[ \\t]*(?::|\\n|—|–|$)", "gi");
  var HEADING_KIND = HEADINGS.map(function (h) { return [new RegExp("^(?:" + h[1] + ")$", "i"), h[0]]; });

  // Phrases inside a sentence that change a keyword's weight ("Go is a plus", "ideally Kafka").
  var INLINE_PREF = /\b(?:a (?:big |huge |strong |real )?(?:plus|bonus|advantage)|is a plus|are a plus|nice[- ]to[- ]have|desirable|preferred|preferably|ideally|advantageous|beneficial|would be (?:great|nice|helpful|useful|a plus)|is welcome|are welcome|bonus|not (?:required|essential|necessary|mandatory))\b/i;
  var INLINE_REQ = /\b(?:must|required|essential|mandatory|need(?:s)? to have|you have|minimum of|at least|proven|demonstrable|strong (?:experience|knowledge|background))\b/i;

  var STOP = ("a an the and or of in on at to for with as by from into via using use is are be been being you your our we will " +
    "can able ability strong excellent good great solid proven deep broad demonstrated hands-on handson working work " +
    "knowledge understanding familiarity experience experienced exposure background skills skill proficiency proficient " +
    "expertise years year yrs minimum least plus etc e.g eg i.e ie including such like similar other related relevant " +
    "equivalent required preferred desirable bonus nice must have has having ideally preferably also any some both " +
    "highly very well across within building build running run managing manage owning own").split(" ");
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });
  var JUNK = /\b(team|teams|company|companies|opportunity|culture|salary|benefits|location|hybrid|remote|office|environment|role|roles|candidate|candidates|people|customers|day|days|week|weeks|time|degree|bachelor|master|phd|university|world|industry|business|things|stuff|someone|anyone|production|pipelines?)\b/i;
  var SOFT = /^(communication|leadership|collaboration|teamwork|ownership|mentoring|coaching|negotiation|presentation|organisation|organization|problem[- ]solving|prioritisation|prioritization|attention to detail|time management|adaptability|creativity)$/i;
  var DEGREE_RE = /\b(bachelor(?:'|’)?s?|master(?:'|’)?s?|ph\.?\s?d|doctorate|b\.?\s?sc|m\.?\s?sc|bsc|msc|b\.?eng|m\.?eng|mba|degree)\b/i;
  var TITLE_WORD = /\b(engineer|developer|manager|designer|analyst|scientist|architect|consultant|specialist|coordinator|director|lead|administrator|officer|assistant|associate|executive|technician|nurse|teacher|accountant|writer|editor|marketer|representative|advisor|adviser|intern|head|recruiter|planner|producer|strategist|researcher|tester|operator|agent|clerk|controller|auditor|buyer|chef|pharmacist|therapist|physician|lawyer|paralegal|owner|programmer|sre)s?\b/i;
  var LEVEL_WORDS = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|mid[- ]?level|intermediate|graduate|entry[- ]level|i{1,3}|iv)\b/gi;

  function detectTitle(text) {
    var m = text.match(/(?:job title|position|role title|title)\s*[:\-–]\s*([^\n]{3,80})/i);
    var lines = text.trim().split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var candidates = m ? [m[1]] : [];
    if (lines.length) {
      candidates.push(lines[0].split(/[.!?](?:\s|$)/)[0]);
      lines.slice(1, 6).forEach(function (l) { candidates.push(l); });
    }
    for (var i = 0; i < candidates.length; i++) {
      var display = candidates[i].replace(/\s*\([^)]*\)\s*/g, " ").replace(/^(job title|position|role)\s*[:\-–]\s*/i, "").trim();
      var title = display.split(/,|\s+at\s+|\s+[-–—|]\s+/)[0].trim();
      if (title && title.split(/\s+/).length <= 7 && TITLE_WORD.test(title)) {
        return { title: title, display: display.split(/\s+/).length <= 10 ? display : title };
      }
    }
    return null;
  }

  var NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };
  function detectYears(text) {
    var r = /(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)\s*\+?\s*(?:\(\d{1,2}\)\s*)?(?:(?:-|–|to)\s*\d{1,2}\s*)?(?:years?|yrs?)\b/gi, m;
    while ((m = r.exec(text))) {
      var n = /\d/.test(m[1]) ? parseInt(m[1], 10) : NUM_WORDS[m[1].toLowerCase()];
      if (n > 0 && n <= 20) return n;
    }
    return null;
  }

  function detectLevel(title, text, years) {
    var t = (title || "") + " ";
    if (/\b(senior|sr\.?|lead|principal|staff|head of)\b/i.test(t)) return "Senior";
    if (/\b(junior|jr\.?|graduate|entry[- ]level|intern)\b/i.test(t)) return "Junior";
    if (/\b(mid[- ]?level|intermediate)\b/i.test(text)) return "Mid-level";
    if (years !== null) return years >= 5 ? "Senior" : years >= 2 ? "Mid-level" : "Junior";
    if (/\b(junior|graduate|entry[- ]level)\b/i.test(text)) return "Junior";
    if (/\b(senior|principal)\b/i.test(text)) return "Senior";
    return null;
  }

  function regionsOf(text) {
    var marks = [], m;
    MARKER_RE.lastIndex = 0;
    while ((m = MARKER_RE.exec(text))) {
      var word = m[2].trim(), kind = "req";
      for (var i = 0; i < HEADING_KIND.length; i++) { if (HEADING_KIND[i][0].test(word)) { kind = HEADING_KIND[i][1]; break; } }
      marks.push({ at: m.index + m[1].length, kind: kind });
    }
    return marks;
  }

  // The weight a sentence gives a keyword on its own, or null if it doesn't say.
  function inlineWeight(text, pos) {
    var s = Math.max(text.lastIndexOf("\n", pos - 1), text.lastIndexOf(". ", pos - 1), text.lastIndexOf(";", pos - 1)) + 1;
    var ends = [text.indexOf("\n", pos), text.indexOf(". ", pos), text.indexOf(";", pos)].filter(function (x) { return x >= 0; });
    var e = ends.length ? Math.min.apply(null, ends) : text.length;
    var sentence = text.slice(s, e);
    var pref = INLINE_PREF.test(sentence), req = INLINE_REQ.test(sentence);
    if (pref && req) {
      // Both in one sentence ("Python required, Go a plus"): look only at this keyword's clause
      var cs = text.lastIndexOf(",", pos - 1);
      var ce = text.indexOf(",", pos);
      var clause = text.slice(Math.max(s, cs + 1), ce >= 0 && ce < e ? ce : e);
      pref = INLINE_PREF.test(clause); req = INLINE_REQ.test(clause);
      if (pref === req) return null;
    }
    return pref ? "pref" : req ? "req" : null;
  }
  function regionAt(marks, pos) {
    var kind = marks.length ? "other" : "req";
    for (var i = 0; i < marks.length; i++) { if (marks[i].at <= pos) kind = marks[i].kind; else break; }
    return kind;
  }

  function cleanChunk(chunk) {
    var words = chunk.replace(/\([^)]*\)/g, " ").replace(/[“”"'’:]/g, " ").trim().split(/\s+/).filter(Boolean);
    while (words.length && STOPSET[words[0].toLowerCase()]) words.shift();
    while (words.length && STOPSET[words[words.length - 1].toLowerCase()]) words.pop();
    return words;
  }

  ATS.analyseJD = function (raw) {
    var text = (raw || "").replace(/\r\n?/g, "\n");
    var marks = regionsOf(text);
    var title = detectTitle(text);
    var years = detectYears(text);
    var kws = [], seen = {};

    var place = function (kw, positions) {
      // A sentence that says "a plus" or "must" wins over the section heading it sits under
      var kinds = positions.map(function (p) { return inlineWeight(text, p) || regionAt(marks, p); });
      if (kinds.indexOf("req") >= 0) kw.weight = "req";
      else if (kinds.indexOf("pref") >= 0) kw.weight = "pref";
      else kw.weight = "req";
      kw.firstAt = Math.min.apply(null, positions);
    };

    // 1. Known terms
    var found = [];
    ATS.terms.forEach(function (t) {
      if (seen[t.term.toLowerCase()]) return;
      var names = [t.term].concat(t.aliases), hits = [];
      names.forEach(function (n) { hits = hits.concat(findAll(text, n)); });
      if (!hits.length) return;
      seen[t.term.toLowerCase()] = 1;
      found.push({ t: t, names: names, hits: hits });
    });
    // Ignore words in the company name on the title line ("Operations Manager – Northfield Logistics")
    // (only the stretch right after the title, up to the first line break, full stop or bracket)
    var titleEnd = title ? text.indexOf(title.title) + title.title.length : -1;
    var nameEnd = -1;
    if (titleEnd > 0) {
      var rest = text.slice(titleEnd);
      var stop = rest.search(/\n|\.\s|[!?(]/);
      nameEnd = titleEnd + (stop < 0 ? Math.min(rest.length, 80) : Math.min(stop, 80));
    }
    var inCompanyName = function (h) { return nameEnd > 0 && h.start >= titleEnd && h.start < nameEnd; };
    // Drop hits that sit inside a longer known term (e.g. "AWS" inside "AWS Certified Solutions Architect")
    found.forEach(function (f) {
      f.hits = f.hits.filter(function (h) {
        if (inCompanyName(h)) return false;
        return !found.some(function (o) {
          return o !== f && o.hits.some(function (g) { return g.start <= h.start && g.end >= h.end && (g.end - g.start) > (h.end - h.start); });
        });
      });
    });
    found.forEach(function (f) {
      if (!f.hits.length) return;
      var kw = { term: f.t.term, names: f.names, cert: f.t.cert, count: f.hits.length, generic: false, hits: f.hits };
      place(kw, f.hits.map(function (h) { return h.start; }));
      kws.push(kw);
    });

    // 2. Other items listed under Required / Preferred (or as bullet lines)
    var listText = [];
    var segs = marks.length ? marks.map(function (mk, i) {
      return { kind: mk.kind, start: mk.at, end: i + 1 < marks.length ? marks[i + 1].at : text.length };
    }) : [];
    segs.forEach(function (s) { if (s.kind !== "other") listText.push({ t: text.slice(s.start, s.end).replace(/^[^:\n]*[:\n]/, ""), at: s.start, kind: s.kind }); });
    text.split("\n").forEach(function (line, i, all) {
      if (/^\s*[-•*●▪]\s+/.test(line)) {
        var at = all.slice(0, i).join("\n").length + 1;
        listText.push({ t: line, at: at, kind: regionAt(marks, at) });
      }
    });
    var generic = 0;
    listText.forEach(function (block) {
      if (block.kind === "other" && marks.length) return;
      block.t.split(/[,;\n•·●▪]|\s\band\b\s|\s\bor\b\s|\.(?=\s|$)|\s[-–—]\s/).forEach(function (chunk) {
        if (generic >= 12) return;
        var words = cleanChunk(chunk);
        if (!words.length || words.length > 3) return;
        var phrase = words.join(" ");
        if (/\d/.test(phrase) || phrase.length < 3 || JUNK.test(phrase)) return;
        if (words.some(function (w) { return w.length < 2 || STOPSET[w.toLowerCase()]; })) return;
        if (kws.some(function (k) { return k.names.some(function (n) { return has(phrase, n); }); })) return;
        var proper = /[A-Z]/.test(phrase.charAt(0)) && words.length === 1 && !/^(The|A|An|You|We|Our)$/.test(phrase);
        if (words.length === 1 && !proper && !SOFT.test(phrase)) return;
        if (TITLE_WORD.test(phrase) && words.length <= 2) return;
        var key = phrase.toLowerCase();
        if (seen[key]) return;
        var hits = findAll(text, phrase);
        if (!hits.length) return;
        seen[key] = 1;
        var kw = { term: phrase, names: [phrase], cert: false, count: hits.length, generic: true, hits: hits };
        place(kw, hits.map(function (h) { return h.start; }));
        kws.push(kw);
        generic++;
      });
    });

    // Either/or requirements ("ACCA or CIMA", "Xero/Sage", "Python, Go or Rust"): any one is enough.
    var all = [];
    kws.forEach(function (k, ki) { k.hits.forEach(function (h) { all.push({ k: ki, s: h.start, e: h.end }); }); });
    all.sort(function (a, b) { return a.s - b.s; });
    var group = kws.map(function (_, i) { return i; });
    var root = function (i) { while (group[i] !== i) i = group[i] = group[group[i]]; return i; };
    for (var i = 0; i < all.length; i++) {
      var chain = [all[i]], hasOr = false;
      for (var j = i + 1; j < all.length; j++) {
        var gap = text.slice(chain[chain.length - 1].e, all[j].s);
        if (!/^\s*(?:,|or|\/|,\s*or|either)\s*$/i.test(gap)) break;
        if (/or|\//i.test(gap)) hasOr = true;
        chain.push(all[j]);
      }
      if (hasOr && chain.length > 1) chain.forEach(function (c) { group[root(c.k)] = root(chain[0].k); });
    }
    kws.forEach(function (k, ki) { k.group = root(ki); });

    kws.sort(function (a, b) {
      return (a.weight === b.weight ? 0 : a.weight === "req" ? -1 : 1) || a.firstAt - b.firstAt;
    });
    kws = kws.slice(0, 30);
    // The job-description line each keyword came from (used by smart matching for context)
    kws.forEach(function (k) {
      var ls = text.lastIndexOf("\n", k.firstAt - 1) + 1, le = text.indexOf("\n", k.firstAt);
      var line = text.slice(ls, le < 0 ? text.length : le).replace(/^\s*[-•*●▪]\s*/, "").trim();
      if (line.length > 160) {
        var at = k.firstAt - ls;
        line = text.slice(Math.max(ls, ls + at - 70), Math.min(le < 0 ? text.length : le, ls + at + 90)).trim();
      }
      k.context = line;
    });

    var level = detectLevel(title && title.title, text, years);
    return {
      title: title, level: level, yearsNeeded: years,
      degree: DEGREE_RE.test(text),
      certs: kws.filter(function (k) { return k.cert; }),
      keywords: kws,
      required: kws.filter(function (k) { return k.weight === "req"; }).length,
      preferred: kws.filter(function (k) { return k.weight === "pref"; }).length
    };
  };

  /* -------------------------------------------------------------- resume */
  var SECTIONS = [
    ["experience", /^(work |professional |relevant |employment |career )?(experience|employment( history)?|work history|career history|experience and employment)$/i],
    ["education", /^(education|academic background|academic qualifications|education (and|&) training|qualifications)$/i],
    ["skills", /^((technical |core |key |relevant )?skills|skills? (and|&) (tools|technologies|expertise)|technologies|tools|competencies|core competencies|expertise|tech stack)$/i],
    ["certifications", /^(certifications?|certificates|licen[cs]es|licen[cs]es (and|&) certifications|certifications? (and|&) licen[cs]es|certifications? (and|&) training)$/i],
    ["summary", /^(summary|profile|professional summary|professional profile|about( me)?|objective|career objective|personal statement)$/i],
    ["projects", /^(projects|personal projects|selected projects|key projects)$/i],
    ["other", /^(awards|honours|honors|publications|languages|interests|hobbies|volunteering|volunteer experience|references|achievements|activities)$/i]
  ];
  function sectionOf(text) {
    var t = text.replace(/[:\s|]+$/, "").replace(/^[\s|]+/, "").trim();
    if (!t || t.split(/\s+/).length > 5) return null;
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i][1].test(t)) return SECTIONS[i][0];
    return null;
  }

  /* Dates. A single date can be written as:
       Jan 2020 · January, 2020 · Jan '20 · 01/2020 · 1.2020 · 2020-01 · 2020/01 · Summer 2021 · Q3 2022 · 2020
     A range joins two dates with - – — to until till → (or "since"/"from" + date, open-ended).
     The end can also be: present, now, current, today, ongoing, date, or a two-digit year ("2019–21"). */
  var MON = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  var SEASON = "(?:spring|summer|autumn|fall|winter)";
  var YEAR = "(?:19|20)\\d{2}";
  var ONE_DATE = "(?:(?:" + MON + "|" + SEASON + "|q[1-4])[\\s,]*(?:" + YEAR + "|'\\d{2})|\\d{1,2}[/.]" + YEAR + "|" + YEAR + "[/.-]\\d{1,2}(?!\\d)|" + YEAR + ")";
  var NOW_WORDS = "present|now|current|currently|today|ongoing|date|to date";
  var SEP = "\\s*(?:-|–|—|to|until|till|→|>)\\s*";
  var RANGE_RE = new RegExp("(" + ONE_DATE + ")" + SEP + "(" + ONE_DATE + "|" + NOW_WORDS + "|'?\\d{2}(?!\\d))", "gi");
  var SINCE_RE = new RegExp("\\b(?:since|from)\\s+(" + ONE_DATE + ")(?!" + SEP + ")", "gi");
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var SEASONS = { spring: 3, summer: 6, autumn: 9, fall: 9, winter: 0 };

  // Turn one written date into a month index (year * 12 + month), or null.
  function parseDate(s, isEnd, startYear) {
    s = s.trim().toLowerCase();
    var m;
    if ((m = s.match(/^'?(\d{2})$/)) && startYear) {               // "2019–21"
      var y2 = Math.floor(startYear / 100) * 100 + parseInt(m[1], 10);
      if (y2 < startYear) y2 += 100;
      return y2 * 12 + 11;
    }
    var yearOf = function (str) {
      var y = str.match(/(19|20)\d{2}/);
      if (y) return parseInt(y[0], 10);
      var a = str.match(/'(\d{2})/);
      return a ? 2000 + parseInt(a[1], 10) : null;
    };
    var year = yearOf(s);
    if (year === null) return null;
    if ((m = s.match(/^(\d{1,2})[/.](?:19|20)\d{2}$/)) || (m = s.match(/^(?:19|20)\d{2}[/.-](\d{1,2})$/))) {
      return year * 12 + Math.max(0, Math.min(11, parseInt(m[1], 10) - 1));
    }
    if ((m = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/))) return year * 12 + MONTHS[m[1]];
    if ((m = s.match(/^(spring|summer|autumn|fall|winter)/))) return year * 12 + SEASONS[m[1]];
    if ((m = s.match(/^q([1-4])/))) return year * 12 + (parseInt(m[1], 10) - 1) * 3 + (isEnd ? 2 : 0);
    return year * 12 + (isEnd ? 11 : 0);
  }

  function dateRanges(text) {
    var out = [], m, now = new Date(), nowIdx = now.getFullYear() * 12 + now.getMonth();
    var add = function (s, e, open) {
      if (s !== null && e !== null && e >= s && s <= nowIdx && e <= nowIdx + 12) out.push([s, Math.min(e, nowIdx), open]);
    };
    RANGE_RE.lastIndex = 0;
    while ((m = RANGE_RE.exec(text))) {
      var s = parseDate(m[1], false);
      var endWord = new RegExp("^(?:" + NOW_WORDS + ")$", "i").test(m[2].trim());
      var e = endWord ? nowIdx : parseDate(m[2], true, s === null ? null : Math.floor(s / 12));
      add(s, e, endWord);
    }
    SINCE_RE.lastIndex = 0;
    while ((m = SINCE_RE.exec(text))) add(parseDate(m[1], false), nowIdx, true);
    return out;
  }

  // "(3 years)", "2 yrs 6 mos", "18 months" written next to a role: returns months, or 0
  var DURATION_RE = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and\s*|,\s*)?(\d{1,2})\s*(?:months?|mos?))?|(\d{1,2})\s*(?:months?|mos?)\b/i;
  function durationMonths(line) {
    if (/\bexperience\b|\bover\b|\bmore than\b/i.test(line)) return 0;   // a claim, not a role's length
    var m = line.match(DURATION_RE);
    if (!m) return 0;
    if (m[3]) return parseInt(m[3], 10);
    return Math.round(parseFloat(m[1]) * 12) + (m[2] ? parseInt(m[2], 10) : 0);
  }
  // "6 years of experience", "over 8 years' experience": a stated total, in years, or 0
  var CLAIM_RE = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:'|’)?\s*(?:of\s+)?(?:\w+\s+){0,3}?experience/i;
  function claimedYears(text) {
    var m = text.match(CLAIM_RE);
    return m ? parseInt(m[1], 10) : 0;
  }

  function totalYears(ranges) {
    var r = ranges.map(function (x) { return [x[0], x[1]]; }).sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    r.forEach(function (x) {
      var last = merged[merged.length - 1];
      if (last && x[0] <= last[1] + 1) last[1] = Math.max(last[1], x[1]);
      else merged.push([x[0], x[1]]);
    });
    var months = merged.reduce(function (s, x) { return s + (x[1] - x[0] + 1); }, 0);
    return Math.round(months / 6) / 2; // nearest half year
  }

  var VERBS = ("achieved accelerated added administered advised analysed analyzed architected arranged assembled assessed audited " +
    "automated balanced boosted built calculated championed changed coached collaborated completed configured consolidated " +
    "contributed controlled converted coordinated created cut debugged decreased defined delivered deployed designed developed " +
    "diagnosed directed doubled drafted drove edited eliminated enabled engineered established evaluated executed expanded " +
    "facilitated fixed forecasted formed founded generated grew guided halved handled headed helped hired identified implemented " +
    "improved increased initiated installed instituted integrated introduced investigated launched led maintained managed " +
    "mentored migrated modernised modernized monitored negotiated optimised optimized orchestrated organised organized " +
    "oversaw owned partnered performed pioneered planned prepared presented prioritised prioritized produced programmed " +
    "promoted proposed prototyped provided published raised ran rebuilt recruited redesigned reduced refactored refined " +
    "replaced reported researched resolved restructured revamped reviewed rewrote saved scaled secured selected served set " +
    "shipped simplified sold solved spearheaded standardised standardized started streamlined strengthened supervised " +
    "supported surpassed taught tested tracked trained transformed tripled troubleshot tuned unified upgraded used validated " +
    "wrote won worked").split(" ");
  var VERBSET = {};
  VERBS.forEach(function (v) { VERBSET[v] = 1; });
  function startsWithVerb(b) {
    var w = (b.match(/^[A-Za-z-]+/) || [""])[0].toLowerCase();
    if (!w) return false;
    if (VERBSET[w]) return true;
    // present-tense forms of the same verbs (build, lead, manage…)
    if (VERBSET[w + "d"] || VERBSET[w + "ed"] || VERBSET[w.replace(/e$/, "") + "ed"]) return true;
    if (w === "lead" || w === "run" || w === "build" || w === "write" || w === "own" || w === "set") return true;
    return /^[a-z]{4,}ed$/.test(w) && !/^(need|seed|speed|feed|bred|shed|red|bed)$/.test(w);
  }
  function hasMetric(b) {
    var stripped = b.replace(/\b(19|20)\d{2}\b/g, "");
    return /\d/.test(stripped) || /%|£|\$|€/.test(b) || /\b(doubled|tripled|halved)\b/i.test(b);
  }

  function structure(model) {
    var lines = model.lines.map(function (l) { return { text: l.text, bullet: l.bullet, heading: l.heading, section: "none" }; });
    var current = "none", found = {};
    lines.forEach(function (l) {
      var s = sectionOf(l.text);
      if (s) { current = s; found[s] = true; l.isHeading = true; }
      l.section = current;
    });
    // Join wrapped bullet lines (PDF and pasted text break long bullets across lines)
    var bullets = [];
    lines.forEach(function (l, i) {
      if (l.isHeading) return;
      if (l.bullet) { bullets.push({ text: l.text, section: l.section }); return; }
      var prev = bullets[bullets.length - 1];
      var prevLine = lines[i - 1];
      if (prev && prevLine && (prevLine.bullet || prevLine.cont) && model.source !== "docx" &&
          l.section === prev.section && !dateRanges(l.text).length &&
          (/^[a-z(]/.test(l.text) || !/[.!?:]$/.test(prev.text)) && l.text.split(/\s+/).length > 1 &&
          l.text.toUpperCase() !== l.text) {
        prev.text += " " + l.text;
        l.cont = true;
      }
    });
    if (!bullets.length) {
      lines.forEach(function (l) {
        if (!l.isHeading && (l.section === "experience" || l.section === "projects") &&
            l.text.split(/\s+/).length >= 6 && !dateRanges(l.text).length) bullets.push({ text: l.text, section: l.section });
      });
    }
    return { lines: lines, bullets: bullets, sections: found };
  }

  /* --------------------------------------------------------------- score */
  var LEVEL_POINTS = { strong: 100, comp: 60, weak: 20 };
  var LEVEL_WORD = { strong: "Strong", comp: "Competitive", weak: "Needs work" };

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function clip(s, n) { return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function hash(s) {
    var h = 5381;
    s = s.replace(/\s+/g, " ").trim().toLowerCase();
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // smart (optional): { term: { score, text } } from scan-smart.js
  ATS.score = function (model, jd, jdText, prev, smart) {
    var st = structure(model);
    var all = st.lines.map(function (l) { return l.text; }).join("\n");
    var bodyText = st.lines.filter(function (l) { return l.section !== "skills" && l.section !== "certifications"; })
      .map(function (l) { return l.text; }).join("\n");
    var noSections = !Object.keys(st.sections).length;

    /* Keywords */
    var weights = 0, earned = 0;
    var keywords = jd.keywords.map(function (k) {
      var inBody = 0, inSkills = 0, inCerts = 0, inBullets = 0, alias = null;
      st.lines.forEach(function (l) {
        k.names.forEach(function (n, ni) {
          var c = findAll(l.text, n).length;
          if (!c) return;
          if (ni > 0 && !alias && n.toLowerCase() !== k.term.toLowerCase()) alias = findAll(l.text, n)[0].text;
          if (l.section === "skills") inSkills += c;
          else if (l.section === "certifications") { inSkills += c; inCerts += c; }
          else inBody += c;
        });
      });
      st.bullets.forEach(function (b) { if (k.names.some(function (n) { return has(b.text, n); })) inBullets++; });
      var status, where, note = "", related = null, smartLine = null;
      if (inBody || (k.cert && inSkills) || (noSections && inSkills)) {
        status = "ok";
        if (k.cert && inCerts) where = (alias ? 'As "' + alias + '", in ' : "In ") + "Certifications";
        else if (alias) where = 'As "' + alias + '", in ' + (inBullets ? plural(inBullets, "bullet") : "your resume");
        else if (inSkills && inBullets && !k.cert) where = "Skills and " + plural(inBullets, "bullet");
        else if (inBullets) where = "In " + plural(inBullets, "bullet");
        else if (k.cert) where = "Certifications";
        else where = "In your resume" + (inSkills ? " and Skills" : "");
        if (inBullets) note = "Backed by experience";
      } else if (inSkills) {
        status = "part"; note = "No bullet shows it used";
        where = inCerts === inSkills ? "Certifications only" : "Skills list only";
      } else {
        (ATS.related[k.term] || []).some(function (r) {
          var hit = findAll(all, r)[0];
          if (hit) { related = hit.text; return true; }
          return false;
        });
        var sm = smart && smart[k.term];
        if (related) { status = "part"; where = 'Related: "' + related + '"'; note = "Counts toward " + k.term; }
        else if (sm && !k.cert && sm.score >= ATS.smartThreshold) {
          // Smart matching: a line says the same thing in other words. Partial credit only.
          status = "part"; smartLine = sm.text;
          where = 'Similar: "' + clip(sm.text, 70) + '"'; note = "Smart match · check it's the same skill";
        }
        else { status = "miss"; where = "Not found"; }
      }
      var w = k.weight === "req" ? 2 : 1;
      return { term: k.term, names: k.names, weight: k.weight, count: k.count, status: status, where: where, note: note,
        related: related, cert: k.cert, w: w, inBullets: inBullets, certOnly: inSkills > 0 && inCerts === inSkills,
        group: k.group, smartLine: smartLine };
    });
    // Either/or: when the job accepts any one of several ("ACCA or CIMA") and you have one, the others are covered.
    keywords.forEach(function (k) {
      if (k.status === "ok") return;
      var mate = keywords.filter(function (o) { return o !== k && o.group === k.group && o.status === "ok"; })[0];
      if (!mate) return;
      k.status = "ok"; k.covered = true; k.related = null;
      k.where = "Covered by " + mate.term; k.note = "The job asks for either one";
    });
    keywords.forEach(function (k) {
      weights += k.w;
      earned += k.w * (k.status === "ok" ? 1 : k.status === "part" ? 0.5 : 0);
    });
    var hard = weights ? Math.round(40 * earned / weights) : 40;

    /* Job title */
    var titleScore = 10;
    if (jd.title) {
      var core = jd.title.title.replace(LEVEL_WORDS, " ").replace(/[^A-Za-z0-9+#/ ]/g, " ").split(/\s+/).filter(function (w) {
        return w.length > 1 && !STOPSET[w.toLowerCase()];
      });
      if (core.length) {
        var phrase = new RegExp(core.map(escapeRe).join("[\\s-]+"), "i");
        if (phrase.test(all)) titleScore = 10;
        else {
          var best = 0;
          st.lines.forEach(function (l) {
            var hits = core.filter(function (w) { return new RegExp("\\b" + escapeRe(w) + "\\b", "i").test(l.text); }).length;
            if (l.text.length < 120) best = Math.max(best, hits / core.length);
          });
          titleScore = Math.round(best * 8);
        }
      }
    }

    /* Experience and seniority */
    var expLines = st.lines.filter(function (l) { return st.sections.experience ? l.section === "experience" : l.section !== "education"; });
    var ranges = [], durMonths = 0;
    expLines.forEach(function (l) {
      var r = dateRanges(l.text);
      if (r.length) ranges = ranges.concat(r);
      else durMonths += durationMonths(l.text);   // a role written as "(3 years)" with no dates
    });
    durMonths = Math.min(durMonths, 480);
    var claimed = claimedYears(all);
    var anyDates = ranges.length > 0 || durMonths > 0 || dateRanges(all).length > 0;
    var have = 0, haveFrom = "none";
    if (ranges.length || durMonths) { have = totalYears(ranges) + Math.round(durMonths / 6) / 2; haveFrom = "dates"; }
    else if (claimed) { have = claimed; haveFrom = "claim"; }
    var dated = haveFrom !== "none";
    var need = jd.yearsNeeded;
    var expScore;
    if (!dated) expScore = need ? 6 : 10;
    else if (need) expScore = Math.round(20 * Math.min(1, have / need));
    else expScore = 20;
    var juniorTitles = /\b(junior|jr\.?|intern|graduate|trainee|apprentice)\b/i.test(expLines.map(function (l) { return l.text; }).join(" "));
    if (jd.level === "Senior" && juniorTitles) expScore = Math.max(0, expScore - 4);

    /* Education and certifications */
    var hasDegree = DEGREE_RE.test(all) || /\b(university|college)\b/i.test(all);
    // Start from 10 and take off for what the job asks for and the resume doesn't show:
    // a degree (6), required certifications (6, shared), preferred certifications (3, shared).
    var certKws = keywords.filter(function (k) { return k.cert; });
    var eduScore = 10;
    if (jd.degree && !hasDegree) eduScore -= 6;
    ["req", "pref"].forEach(function (wt) {
      var set = certKws.filter(function (k) { return k.weight === wt; });
      if (!set.length) return;
      var missing = set.filter(function (k) { return k.status !== "ok"; }).length;
      eduScore -= (wt === "req" ? 6 : 3) * missing / set.length;
    });
    if (!jd.degree && !certKws.length && !hasDegree && !st.sections.education) eduScore = 8;
    eduScore = Math.max(0, Math.round(eduScore));

    /* Parse quality */
    var email = ATS.patterns.email.test(all), phone = ATS.patterns.phone.test(all);
    var issues = [];
    if (model.flags.contactInHeader) issues.push({ id: "p-header", pts: 6, flag: "Contact details sit in the page header, which many ATSs skip.",
      fix: "<b>Your contact details are in the page header.</b> Many ATSs don't read headers, so your email and phone may be lost. Move them into the body, under your name.",
      loc: [["Your resume: header", "#resume-paper"]] });
    else if (!email && !phone) issues.push({ id: "p-contact", pts: 5, flag: "No email address or phone number found in the text.",
      fix: "<b>We couldn't find your email or phone.</b> Put them in plain text in the first lines of the page body.",
      loc: [["ATS view", "#parse-preview"]] });
    if (model.flags.columns || model.flags.tableLayout) issues.push({ id: "p-columns", pts: 6,
      flag: model.flags.tableLayout ? "Table layout: text from side-by-side cells is read across and mixed together." : "Two-column layout: text from one column is mixed into the other.",
      fix: "<b>Your resume uses " + (model.flags.tableLayout ? "a table to make columns" : "two columns") + ".</b> Many ATSs read straight across the page, so text from both columns gets mixed together. Use a single column.",
      loc: [["See ATS view", "#parse-preview"]] });
    if (model.flags.textBoxes) issues.push({ id: "p-textbox", pts: 4, flag: "Some text is in text boxes, which many ATSs skip.",
      fix: "<b>Some text is in text boxes.</b> Many ATSs skip text boxes. Move that text into the normal page body.",
      loc: [["See ATS view", "#parse-preview"]] });
    var core3 = ["experience", "education", "skills"].filter(function (s) { return st.sections[s]; });
    if (core3.length < 2) issues.push({ id: "p-sections", pts: 3, flag: "Few standard section headings found.",
      fix: "<b>Use standard section headings.</b> Headings like Experience, Education and Skills help an ATS sort your resume.",
      loc: [["See ATS view", "#parse-preview"]] });
    if (!anyDates) issues.push({ id: "p-dates", pts: 2, flag: "No dates found for your roles.",
      fix: "<b>Add dates to your roles.</b> Put a start and end date, like 2021–2023, next to each job title.",
      loc: [["Your resume: Experience", "#resume-paper"]] });
    var parse = Math.max(0, 20 - issues.reduce(function (s, x) { return s + x.pts; }, 0));
    var parseOk = anyDates && core3.length >= 2 ? "Dates and sections were read correctly." : "";

    var ats = hard + titleScore + expScore + eduScore + parse;

    /* Recruiter rubric */
    var B = st.bullets.map(function (b) { return b.text; });
    var n = B.length;
    var rub = [];
    var level = function (r, a, b) { return r >= a ? "strong" : r >= b ? "comp" : "weak"; };

    var withNum = B.filter(hasMetric);
    rub.push(n ? { key: "impact", name: "Measurable impact", level: level(withNum.length / n, 0.5, 0.25),
      text: withNum.length + " of " + plural(n, "bullet") + " show a result with a number.",
      quote: (withNum.length / n >= 0.5 ? withNum[0] : B.filter(function (b) { return !hasMetric(b); })[0]) || "" }
      : { key: "impact", name: "Measurable impact", level: "weak", text: "We couldn't find any bullet points to check.", quote: "" });

    var verbLed = B.filter(startsWithVerb);
    rub.push(n ? { key: "verbs", name: "Action-led bullets", level: level(verbLed.length / n, 0.8, 0.5),
      text: verbLed.length + " of " + plural(n, "bullet") + " start with a clear verb.",
      quote: (verbLed.length / n >= 0.8 ? verbLed[0] : B.filter(function (b) { return !startsWithVerb(b); })[0]) || "" }
      : { key: "verbs", name: "Action-led bullets", level: "weak", text: "We couldn't find any bullet points to check.", quote: "" });

    var roleLine = (expLines.filter(function (l) { return dateRanges(l.text).length || durationMonths(l.text); })[0] || {}).text || "";
    var haveText = haveFrom === "claim" ? "Your resume states about " + plural(have, "year") + " of experience, but your roles have no dates."
      : "Your relevant experience totals about " + plural(have, "year") + ".";
    var sen;
    if (!dated) sen = { level: need ? "weak" : "comp", text: "We couldn't find dates for your roles, so we can't tell how much experience you have." };
    else if (need) sen = { level: have >= need ? "strong" : (have >= need * 0.75 || have >= need - 1) ? "comp" : "weak",
      text: "The role asks for " + need + "+ years. " + haveText };
    else sen = { level: "strong", text: "The job description doesn't ask for a number of years. " + haveText };
    if (haveFrom === "claim" && sen.level === "strong") sen.level = "comp";
    if (jd.level === "Senior" && juniorTitles && sen.level === "strong") sen.level = "comp";
    rub.push({ key: "seniority", name: "Seniority fit", level: sen.level, text: sen.text, quote: clip(roleLine, 120) });

    var long = B.filter(function (b) { return b.split(/\s+/).length > 35; });
    rub.push(n ? { key: "length", name: "Concise bullets", level: level(1 - long.length / n, 0.9, 0.7),
      text: long.length ? plural(long.length, "bullet") + " of " + n + " run over 35 words." : "All " + plural(n, "bullet") + " are under 35 words.",
      quote: long.length ? clip(long[0], 140) : "" }
      : { key: "length", name: "Concise bullets", level: "comp", text: "We couldn't find any bullet points to check.", quote: "" });

    var listed = keywords.filter(function (k) { return !k.cert && !k.covered && !k.smartLine && (k.status === "ok" || (k.status === "part" && !k.related)); });
    var backed = listed.filter(function (k) { return k.status === "ok"; });
    rub.push(listed.length ? { key: "context", name: "Skills shown in context", level: level(backed.length / listed.length, 0.7, 0.4),
      text: backed.length + " of " + plural(listed.length, "skill") + " from the job description that you mention appear in your experience, not only a skills list.", quote: "" }
      : { key: "context", name: "Skills shown in context", level: "weak", text: "None of the job description's skills were found in your resume.", quote: "" });

    var names3 = { experience: "Experience", education: "Education", skills: "Skills" };
    var missing3 = ["experience", "education", "skills"].filter(function (s) { return !st.sections[s]; });
    rub.push({ key: "sections", name: "Clear sections", level: core3.length === 3 ? "strong" : core3.length === 2 ? "comp" : "weak",
      text: core3.length === 3 ? "Found Experience, Education and Skills headings."
        : "Found: " + (core3.length ? core3.map(function (s) { return names3[s]; }).join(", ") : "none") + ". Missing: " + missing3.map(function (s) { return names3[s]; }).join(", ") + ".",
      quote: "" });

    var rubricScore = Math.round(rub.reduce(function (s, r) { return s + LEVEL_POINTS[r.level]; }, 0) / rub.length);
    var band = rubricScore >= 75 ? "strong" : rubricScore >= 50 ? "comp" : "weak";
    var byPts = rub.slice().sort(function (a, b) { return LEVEL_POINTS[b.level] - LEVEL_POINTS[a.level]; });
    var strongest = byPts[0].name, weakest = byPts[byPts.length - 1].name;
    if (LEVEL_POINTS[byPts[0].level] === LEVEL_POINTS[byPts[byPts.length - 1].level]) {
      strongest = byPts[0].level === "weak" ? "None" : "All items";
      weakest = byPts[0].level === "strong" ? "None" : "All items";
    }

    /* Fixes, ranked by estimated gain */
    var fixes = [];
    keywords.forEach(function (k) {
      if (k.status === "ok") return;
      var gain = Math.max(1, Math.round(40 * k.w * (k.status === "part" ? 0.5 : 1) / weights));
      var word = k.weight === "req" ? "required" : "preferred";
      var times = k.count === 1 ? "once" : k.count === 2 ? "twice" : k.count + " times";
      var html;
      if (k.cert) {
        html = "<b>Add " + esc(k.term) + " if you hold it.</b> It's " + word + " in the job description and wasn't found in your resume. List it under Certifications.";
      } else if (k.smartLine) {
        html = "<b>Use the words \"" + esc(k.term) + "\".</b> It's " + word + " in the job description, and your line \"" + esc(clip(k.smartLine, 90)) +
          "\" looks like the same skill. An ATS search needs the exact words, so name it if it fits.";
      } else if (k.status === "part" && !k.related) {
        html = "<b>" + esc(cap(k.term)) + " is " + word + " and appears " + times + " in the job description.</b> You list it " +
          (k.certOnly ? "under Certifications" : "in Skills") + ", but no role mentions it. Add it to a bullet where you used it.";
      } else if (k.status === "part") {
        html = "<b>" + esc(cap(k.term)) + " is " + word + " in the job description.</b> You mention " + esc(k.related) + ", which is related. If you've used " + esc(k.term) + " itself, name it in a bullet.";
      } else {
        html = "<b>Show " + esc(k.term) + " if you have it.</b> \"" + esc(k.term) + "\" is " + word + " and wasn't found in your resume. If you've used it, say so in a bullet.";
      }
      fixes.push({ id: "kw-" + slug(k.term), html: html, gain: "ATS +" + gain, rank: gain,
        loc: (k.status === "part" && !k.related && !k.smartLine ? [["Your resume: Skills", "#resume-paper"]] : k.smartLine ? [["Your resume", "#resume-paper"]] : [])
          .concat([["Job description: " + (k.weight === "req" ? "Required" : "Preferred"), "#jd-highlighted"]]) });
    });
    if (jd.title && titleScore <= 8) {
      fixes.push({ id: "title", html: "<b>The job title is \"" + esc(jd.title.title) + "\".</b> If it describes what you do, use it in your headline or summary.",
        gain: "ATS +" + (10 - titleScore), rank: 10 - titleScore, loc: [["Job description", "#jd-highlighted"]] });
    }
    issues.forEach(function (x) { fixes.push({ id: x.id, html: x.fix, gain: "Parse +" + x.pts, rank: x.pts, loc: x.loc }); });
    rub.forEach(function (r) {
      if (r.level === "strong") return;
      var rank = r.level === "weak" ? 5 : 3;
      if (r.key === "impact" && n) fixes.push({ id: "r-impact", rank: rank, gain: "Recruiter: impact", loc: [["Your resume: Experience", "#resume-paper"]],
        html: "<b>Only " + withNum.length + " of " + plural(n, "bullet") + " show a measurable result.</b> Add a number to your three most recent bullets: time saved, money saved, or scale handled." });
      if (r.key === "verbs" && n) fixes.push({ id: "r-verbs", rank: rank, gain: "Recruiter: verbs", loc: [["Your resume: Experience", "#resume-paper"]],
        html: "<b>" + (n - verbLed.length) + " of " + plural(n, "bullet") + " don't start with a verb.</b> Lead with what you did: built, led, cut, launched." });
      if (r.key === "length" && n) fixes.push({ id: "r-length", rank: rank, gain: "Recruiter: length", loc: [["Your resume: Experience", "#resume-paper"]],
        html: "<b>" + plural(long.length, "bullet") + " run over 35 words.</b> Keep each to one or two lines so a recruiter can take it in at a glance." });
    });
    fixes.sort(function (a, b) { return b.rank - a.rank; });

    /* Change since the last scan of the same job description (this session only) */
    var jdHash = hash(jdText);
    var partsNow = { hard: hard, title: titleScore, exp: expScore, edu: eduScore, parse: parse };
    var delta = null, resolved = [], scanNo = 1, first = null;
    if (prev && prev.jd === jdHash) {
      scanNo = prev.n + 1;
      // Compare with the first scan of this job description, as the design shows
      first = prev.first || { ats: prev.ats, parts: prev.parts, fixes: prev.fixes };
      var ids = {};
      fixes.forEach(function (f) { ids[f.id] = 1; });
      resolved = (first.fixes || []).filter(function (f) { return !ids[f.id]; });
      var labels = { hard: "Hard skills", title: "job title", exp: "experience", edu: "education", parse: "parse quality" };
      var changes = Object.keys(partsNow).filter(function (k) { return partsNow[k] !== first.parts[k]; }).map(function (k) {
        var d = partsNow[k] - first.parts[k];
        return labels[k] + " " + (d > 0 ? "+" : "−") + Math.abs(d);
      });
      if (changes.length) changes[0] = changes[0].charAt(0).toUpperCase() + changes[0].slice(1);
      delta = { from: first.ats, to: ats, resolved: resolved.length, changes: changes };
    }
    var snapshot = { jd: jdHash, n: scanNo, ats: ats, parts: partsNow, first: first,
      fixes: fixes.map(function (f) { return { id: f.id, text: f.html.replace(/<[^>]+>/g, ""), gain: f.gain }; }) };

    return {
      jd: jd, jdHash: jdHash, scanNo: scanNo, keywords: keywords,
      ats: ats, parts: partsNow, hard: hard, titleScore: titleScore, expScore: expScore, eduScore: eduScore, parse: parse,
      issues: issues, parseOk: parseOk,
      rubric: rub, rubricScore: rubricScore, band: band, bandWord: LEVEL_WORD[band], strongest: strongest, weakest: weakest,
      levelWord: LEVEL_WORD, fixes: fixes, resolved: resolved, delta: delta, snapshot: snapshot,
      bulletCount: n, years: have
    };
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  ATS.esc = esc;
  ATS.findAll = findAll;
  ATS.sectionOf = sectionOf;
})();
