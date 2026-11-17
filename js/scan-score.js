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

  function nameRe(name) {
    var cs = !!ATS.caseSensitive[name];
    var p = escapeRe(name).replace(/-|\s+/g, "[\\s-]?");
    if (/[a-z]$/i.test(name) && name.length > 2) p += "(?:s|es)?";
    return new RegExp("(^|[^A-Za-z0-9+#&@])(" + p + ")(?![A-Za-z0-9+#&])", cs ? "g" : "gi");
  }
  var reCache = {};
  function re(name) { return reCache[name] || (reCache[name] = nameRe(name)); }

  function findAll(text, name) {
    var r = re(name), out = [], m;
    r.lastIndex = 0;
    while ((m = r.exec(text))) {
      out.push({ start: m.index + m[1].length, end: m.index + m[1].length + m[2].length, text: m[2] });
      if (m[0].length === 0) r.lastIndex++;
    }
    return out;
  }
  function has(text, name) { return findAll(text, name).length > 0; }

  /* ------------------------------------------------------ job description */
  var MARKER_RE = /(^|\n|[.;]\s+)\s*(?:[-•*]\s*)?(required|requirements|minimum qualifications|must[- ]haves?|essential(?: skills| criteria)?|what you(?:'|’)ll need|you(?:'|’)ll need|you will need|qualifications|you have|about you|skills|preferred(?: qualifications)?|nice[- ]to[- ]haves?|bonus(?: points)?|desirable|good to have|responsibilities|what you(?:'|’)ll do|the role|about (?:us|the company|the role)|benefits|what we offer|perks)\s*(?::|\n|—|–)/gi;
  var PREF_RE = /preferred|nice|bonus|desirable|good to have/i;
  var REQ_RE = /required|requirement|must|essential|need|qualification|you have|about you|skills/i;

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

  function detectYears(text) {
    var r = /(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?(?:years?|yrs?)\b/gi, m;
    while ((m = r.exec(text))) {
      var n = parseInt(m[1], 10);
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
      var word = m[2];
      var kind = PREF_RE.test(word) ? "pref" : REQ_RE.test(word) ? "req" : "other";
      marks.push({ at: m.index + m[1].length, kind: kind });
    }
    return marks;
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
      var kinds = positions.map(function (p) { return regionAt(marks, p); });
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
    // Drop hits that sit inside a longer known term (e.g. "AWS" inside "AWS Certified Solutions Architect")
    found.forEach(function (f) {
      f.hits = f.hits.filter(function (h) {
        return !found.some(function (o) {
          return o !== f && o.hits.some(function (g) { return g.start <= h.start && g.end >= h.end && (g.end - g.start) > (h.end - h.start); });
        });
      });
    });
    found.forEach(function (f) {
      if (!f.hits.length) return;
      var kw = { term: f.t.term, names: f.names, cert: f.t.cert, count: f.hits.length, generic: false };
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
        var kw = { term: phrase, names: [phrase], cert: false, count: hits.length, generic: true };
        place(kw, hits.map(function (h) { return h.start; }));
        kws.push(kw);
        generic++;
      });
    });

    kws.sort(function (a, b) {
      return (a.weight === b.weight ? 0 : a.weight === "req" ? -1 : 1) || a.firstAt - b.firstAt;
    });
    kws = kws.slice(0, 30);

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

  var MON = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  var DATE = "(?:(" + MON + ")\\s+)?((?:19|20)\\d{2})|(\\d{1,2})\\s*/\\s*((?:19|20)\\d{2})";
  var RANGE_RE = new RegExp("(?:" + DATE + ")\\s*(?:-|–|—|to|until|till)\\s*(?:(?:" + DATE + ")|(present|now|current|currently|today|ongoing|date))", "gi");
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function monthIndex(mon, year, num, numYear, isEnd) {
    if (year) return parseInt(year, 10) * 12 + (mon ? MONTHS[mon.slice(0, 3).toLowerCase()] : (isEnd ? 11 : 0));
    if (numYear) return parseInt(numYear, 10) * 12 + Math.max(0, Math.min(11, parseInt(num, 10) - 1));
    return null;
  }
  function dateRanges(text) {
    var out = [], m, now = new Date(), nowIdx = now.getFullYear() * 12 + now.getMonth();
    RANGE_RE.lastIndex = 0;
    while ((m = RANGE_RE.exec(text))) {
      var s = monthIndex(m[1], m[2], m[3], m[4], false);
      var e = m[9] ? nowIdx : monthIndex(m[5], m[6], m[7], m[8], true);
      if (s !== null && e !== null && e >= s && e <= nowIdx + 1) out.push([s, Math.min(e, nowIdx), !!m[9]]);
    }
    return out;
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

  ATS.score = function (model, jd, jdText, prev) {
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
      var status, where, note = "", related = null;
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
        if (related) { status = "part"; where = 'Related: "' + related + '"'; note = "Counts toward " + k.term; }
        else { status = "miss"; where = "Not found"; }
      }
      var w = k.weight === "req" ? 2 : 1;
      weights += w;
      earned += w * (status === "ok" ? 1 : status === "part" ? 0.5 : 0);
      return { term: k.term, names: k.names, weight: k.weight, count: k.count, status: status, where: where, note: note,
        related: related, cert: k.cert, w: w, inBullets: inBullets, certOnly: inSkills > 0 && inCerts === inSkills };
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
    var ranges = [];
    expLines.forEach(function (l) { ranges = ranges.concat(dateRanges(l.text)); });
    var anyDates = ranges.length > 0 || dateRanges(all).length > 0;
    var have = totalYears(ranges);
    var need = jd.yearsNeeded;
    var expScore;
    if (!ranges.length) expScore = need ? 6 : 10;
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

    var roleLine = (expLines.filter(function (l) { return dateRanges(l.text).length; })[0] || {}).text || "";
    var sen;
    if (!ranges.length) sen = { level: need ? "weak" : "comp", text: "We couldn't find dates for your roles, so we can't tell how much experience you have." };
    else if (need) sen = { level: have >= need ? "strong" : (have >= need * 0.75 || have >= need - 1) ? "comp" : "weak",
      text: "The role asks for " + need + "+ years. Your relevant experience totals about " + plural(have, "year") + "." };
    else sen = { level: "strong", text: "The job description doesn't ask for a number of years. We found about " + plural(have, "year") + " of dated experience." };
    if (jd.level === "Senior" && juniorTitles && sen.level === "strong") sen.level = "comp";
    rub.push({ key: "seniority", name: "Seniority fit", level: sen.level, text: sen.text, quote: clip(roleLine, 120) });

    var long = B.filter(function (b) { return b.split(/\s+/).length > 35; });
    rub.push(n ? { key: "length", name: "Concise bullets", level: level(1 - long.length / n, 0.9, 0.7),
      text: long.length ? plural(long.length, "bullet") + " of " + n + " run over 35 words." : "All " + plural(n, "bullet") + " are under 35 words.",
      quote: long.length ? clip(long[0], 140) : "" }
      : { key: "length", name: "Concise bullets", level: "comp", text: "We couldn't find any bullet points to check.", quote: "" });

    var listed = keywords.filter(function (k) { return !k.cert && (k.status === "ok" || (k.status === "part" && !k.related)); });
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
      } else if (k.status === "part" && !k.related) {
        html = "<b>" + esc(cap(k.term)) + " is " + word + " and appears " + times + " in the job description.</b> You list it " +
          (k.certOnly ? "under Certifications" : "in Skills") + ", but no role mentions it. Add it to a bullet where you used it.";
      } else if (k.status === "part") {
        html = "<b>" + esc(cap(k.term)) + " is " + word + " in the job description.</b> You mention " + esc(k.related) + ", which is related. If you've used " + esc(k.term) + " itself, name it in a bullet.";
      } else {
        html = "<b>Show " + esc(k.term) + " if you have it.</b> \"" + esc(k.term) + "\" is " + word + " and wasn't found in your resume. If you've used it, say so in a bullet.";
      }
      fixes.push({ id: "kw-" + slug(k.term), html: html, gain: "ATS +" + gain, rank: gain,
        loc: (k.status === "part" && !k.related ? [["Your resume: Skills", "#resume-paper"]] : [])
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
