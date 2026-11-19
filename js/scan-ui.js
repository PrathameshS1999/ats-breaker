/* ATS_Breaker scan: runs a scan from the home page form and renders the results
   with the same components as example-report.html. Nothing leaves the browser.
   Only a small score snapshot (no resume text) is kept in sessionStorage so a
   rescan of the same job description can show what changed. */
(function () {
  "use strict";
  var ATS = window.ATS = window.ATS || {};
  var esc = function (s) { return ATS.esc(s); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var I = {
    ok: '<i class="ic ok" aria-hidden="true">✓</i>',
    part: '<i class="ic part" aria-hidden="true">◐</i>',
    miss: '<i class="ic miss" aria-hidden="true">✕</i>'
  };
  var LEVEL_IC = { strong: "ok", comp: "part", weak: "miss" };
  var STORE_KEY = "ats-last-scan";

  var store = {
    get: function () { try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; } },
    set: function (v) { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };

  /* ------------------------------------------------------------ render */
  function fixItem(f, key, done) {
    var loc = done ? '<span>Resolved on rescan</span>'
      : (f.loc || []).map(function (l) { return '<a class="link" href="' + l[1] + '">' + esc(l[0]) + "</a>"; }).join("");
    var label = done ? "Done: " + f.text : "Done: " + f.html.replace(/<[^>]+>/g, "").split(".")[0];
    return '<li class="fix' + (done ? " done" : "") + '"><input class="chk" type="checkbox" name="fixes_done" value="' + esc(f.id) + '"' +
      (done ? " checked disabled" : ' data-fix="' + esc(key + "-" + f.id) + '"') + ' aria-label="' + esc(label) + '">' +
      "<div><p>" + (done ? esc(f.text) : f.html) + '</p><div class="loc">' + loc + "</div></div>" +
      '<span class="gain">' + esc(f.gain) + "</span></li>";
  }

  function highlightJD(text, keywords) {
    var marks = [];
    keywords.forEach(function (k) {
      var cls = k.status === "ok" ? "hl-ok" : k.status === "part" ? "hl-part" : "hl-miss";
      k.names.forEach(function (n) {
        ATS.findAll(text, n).forEach(function (h) { marks.push({ s: h.start, e: h.end, cls: cls }); });
      });
    });
    marks.sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var out = "", pos = 0;
    marks.forEach(function (m) {
      if (m.s < pos) return;
      out += esc(text.slice(pos, m.s)) + '<span class="' + m.cls + '">' + esc(text.slice(m.s, m.e)) + "</span>";
      pos = m.e;
    });
    out += esc(text.slice(pos));
    return out.replace(/\n/g, "<br>");
  }

  function atsView(model) {
    var lines = model.ats.map(function (row) {
      var whole = row.segs.map(function (s) { return s.t; }).join("");
      if (row.segs.length === 1 && !row.segs[0].cls && ATS.sectionOf(whole)) {
        return '<span class="sec-t">' + esc(whole) + "</span>";
      }
      return row.segs.map(function (s) { return s.cls ? '<span class="' + s.cls + '">' + esc(s.t) + "</span>" : esc(s.t); }).join("");
    });
    var all = model.lines.map(function (l) { return l.text; }).join("\n");
    if (!ATS.patterns.email.test(all) && !ATS.patterns.phone.test(all)) {
      lines.push('<span class="sec-t">CONTACT</span>  <span class="gone">— not found</span>');
    }
    return lines.join("\n");
  }

  function resumePane(model) {
    var p = model.preview;
    var lab = model.source === "pdf" ? esc(model.fileName) + " · page 1" : esc(model.fileName);
    var inner;
    if (p.kind === "pdf") {
      var box = p.columnBox;
      inner = '<div class="paper-pdf" role="img" aria-label="Page 1 of ' + esc(model.fileName) + (box ? ", with the left column flagged" : "") + '">' +
        "<canvas></canvas>" +
        (box ? '<div class="flagbox" data-flag="COLUMN" style="left:' + (box.left * 100).toFixed(2) + "%;top:" + (box.top * 100).toFixed(2) +
          "%;width:" + (box.width * 100).toFixed(2) + "%;height:" + (box.height * 100).toFixed(2) + '%"></div>' : "") + "</div>";
    } else {
      var hd = p.header ? '<div class="hd' + (model.flags.contactInHeader ? ' flagbox" data-flag="HEADER' : "") + '">' + esc(p.header).replace(/\n/g, "<br>") + "</div>" : "";
      var body = p.blocks.map(function (b) {
        var cls = b.heading || ATS.sectionOf(b.text) ? "ph" : b.bullet ? "li" : "";
        var flag = b.flag ? ' data-flagged="' + esc(b.flag) + '"' : "";
        return "<p" + (cls ? ' class="' + cls + '"' : "") + flag + ">" + (b.bullet ? "• " : "") + esc(b.text) + "</p>";
      }).join("");
      inner = '<div class="paper-doc" tabindex="0" role="region" aria-label="Text of your resume">' + hd + body + "</div>";
    }
    return '<div class="pane" id="resume-paper"><div class="pane-h"><b>Your resume</b><span class="lab">' + lab + "</span></div>" + inner + "</div>";
  }

  var ISSUE_TITLE = { "p-header": "Contact details in the header", "p-contact": "No contact details found", "p-columns": "Two columns",
    "p-textbox": "Text boxes", "p-sections": "Section headings", "p-dates": "Dates" };

  function render(r, model, jdText) {
    var jd = r.jd;
    var heading = jd.title ? jd.title.display : "your job description";
    var lab = r.scanNo > 1 ? "Scan " + r.scanNo + " of " + r.scanNo + " · same job description" : "Scan 1";
    var seg = function (v, max) { return '<i style="--wt:' + max + ";--f:" + Math.round(100 * v / max) + '%"></i>'; };
    var counts = { ok: 0, part: 0, miss: 0 };
    r.keywords.forEach(function (k) { counts[k.status]++; });
    var key = r.jdHash;

    var h = "";
    /* Summary */
    h += '<section class="wrap sec" aria-labelledby="results-title">' +
      '<div class="sec-h"><h2 id="results-title" tabindex="-1">Results: ' + esc(heading) + '</h2><span class="lab">' + lab + "</span></div>" +
      '<p class="est">Scores are estimates of fit. They don\'t reproduce any employer\'s system. <a class="link" href="how-scoring-works.html">How scoring works</a></p>' +
      '<div class="sum">' +
      '<div class="card"><div class="card-h"><b>ATS match</b><a class="why" href="how-scoring-works.html#ats-match">Why ' + r.ats + '?</a></div>' +
      '<div class="score"><b>' + r.ats + '</b><span>/ 100</span></div>' +
      '<div class="segs" aria-hidden="true">' + seg(r.hard, 40) + seg(r.titleScore, 10) + seg(r.expScore, 20) + seg(r.eduScore, 10) + seg(r.parse, 20) + "</div>" +
      '<div class="comp"><div>Hard skills<b>' + r.hard + ' / 40</b></div><div>Job title<b>' + r.titleScore + ' / 10</b></div><div>Experience and seniority<b>' + r.expScore +
      ' / 20</b></div><div>Education and certifications<b>' + r.eduScore + ' / 10</b></div><div>Parse quality<b>' + r.parse + " / 20</b></div></div></div>" +
      '<div class="card"><div class="card-h"><b>Recruiter readiness</b><a class="why" href="how-scoring-works.html#recruiter-readiness">Why?</a></div>' +
      '<div class="score word"><b>' + r.bandWord + "</b></div>" +
      '<div class="band" role="img" aria-label="Band: ' + r.bandWord + '">' + ["weak", "comp", "strong"].map(function (b) {
        return "<span" + (b === r.band ? ' class="on"' : "") + ">" + r.levelWord[b] + "</span>";
      }).join("") + "</div>" +
      '<div class="comp"><div>Rubric score<b>' + r.rubricScore + ' / 100</b></div><div>Strongest<b>' + esc(r.strongest) + "</b></div><div>Weakest<b>" + esc(r.weakest) + "</b></div></div></div>" +
      '<div class="card"><div class="card-h"><b>Parse status</b><a class="why" href="#parse-preview">See ATS view</a></div>' +
      (r.issues.length ? '<div class="status">' + I.part + r.issues.length + " issue" + (r.issues.length === 1 ? "" : "s") + " to fix</div>"
        : '<div class="status">' + I.ok + "No issues found</div>") +
      '<ul class="flags">' + r.issues.map(function (x) { return "<li>" + I.part + "<span>" + esc(x.flag) + "</span></li>"; }).join("") +
      (r.parseOk ? "<li>" + I.ok + "<span>" + esc(r.parseOk) + "</span></li>" : "") + "</ul></div>" +
      "</div>";
    if (r.delta) {
      var d = r.delta.to - r.delta.from;
      h += '<div class="delta" aria-label="Rescan change"><span class="lab">Since your first scan</span><span class="from">' + r.delta.from +
        '</span><span class="arrow" aria-hidden="true">→</span><span class="to">' + r.delta.to + '</span><span class="up' + (d < 0 ? " down" : "") + '">' +
        (d < 0 ? "▼ −" + Math.abs(d) : "▲ +" + d) + "</span><p>" +
        (r.delta.resolved ? r.delta.resolved + " fix" + (r.delta.resolved === 1 ? "" : "es") + " resolved. " : "") +
        (r.delta.changes.length ? esc(r.delta.changes.join(", ")) + "." : "No part of the score changed.") + "</p></div>";
    }
    if (r.fixes.length) {
      h += '<div class="sec-h sub"><h3>Top ' + Math.min(3, r.fixes.length) + " fix" + (r.fixes.length === 1 ? "" : "es") + "</h3>" +
        (r.fixes.length > 3 ? '<a class="link" href="#all-fixes">See all ' + r.fixes.length + "</a>" : "") + "</div>" +
        '<ol class="fixes">' + r.fixes.slice(0, 3).map(function (f, i) {
          return '<li class="fix"><span class="n">' + (i + 1) + "</span><div><p>" + f.html + '</p><div class="loc">' +
            (f.loc || []).map(function (l) { return '<a class="link" href="' + l[1] + '">' + esc(l[0]) + "</a>"; }).join("") +
            '</div></div><span class="gain">' + esc(f.gain) + "</span></li>";
        }).join("") + "</ol>";
    }
    h += "</section>";

    /* Parse preview */
    var nSections = model.ats.filter(function (row) {
      return row.segs.length === 1 && ATS.sectionOf(row.segs[0].t);
    }).length;
    h += '<section class="wrap sec" id="parse-preview" aria-labelledby="parse-title">' +
      '<div class="sec-h"><h2 id="parse-title">Parse preview</h2><span class="lab">How an ATS reads your file</span></div>' +
      '<div class="parse">' + resumePane(model) +
      '<div class="pane"><div class="pane-h"><b>ATS view</b><span class="lab">extracted text · ' + nSections + " section" + (nSections === 1 ? "" : "s") + "</span></div>" +
      '<pre class="xray scroll" tabindex="0" aria-label="Text as an ATS extracts it">' + atsView(model) + "</pre></div></div>";
    if (r.issues.length) {
      h += '<div class="parse-flags">' + r.issues.map(function (x) {
        return '<div class="pf">' + I.part + "<div><b>" + esc(x.title || ISSUE_TITLE[x.id] || "Issue") + "</b><p>" + esc(x.fix.replace(/<[^>]+>/g, "").replace(/^[^.]*\.\s*/, "")) + "</p></div></div>";
      }).join("") + "</div>";
    }
    h += "</section>";

    /* Keywords */
    h += '<section class="wrap sec" id="keywords" aria-labelledby="kw-title">' +
      '<div class="sec-h"><h2 id="kw-title">Keywords</h2><span class="lab">' + r.keywords.length + " found in the job description</span></div>";
    if (r.keywords.length) {
      h += '<div class="kw-tools" role="group" aria-label="Filter keywords">' +
        '<button type="button" class="ft" data-filter="all" aria-pressed="true">All ' + r.keywords.length + "</button>" +
        '<button type="button" class="ft" data-filter="ok" aria-pressed="false">Matched ' + counts.ok + "</button>" +
        '<button type="button" class="ft" data-filter="part" aria-pressed="false">Partial ' + counts.part + "</button>" +
        '<button type="button" class="ft" data-filter="miss" aria-pressed="false">Missing ' + counts.miss + "</button>" +
        '<button type="button" class="ft" data-filter="req" aria-pressed="false">Required only</button></div>';
    }
    h += '<div class="kw"><div class="table-scroll" tabindex="0" role="region" aria-label="Keywords table">' +
      '<table class="kwt"><thead><tr><th scope="col">Keyword</th><th scope="col">Weight</th><th scope="col">Status</th><th scope="col">Where it appears</th></tr></thead><tbody>' +
      (r.keywords.length ? r.keywords.map(function (k) {
        var word = k.status === "ok" ? "Matched" : k.status === "part" ? "Partial" : "Missing";
        return '<tr data-status="' + k.status + '" data-weight="' + k.weight + '"><td class="w">' + esc(k.term) + "</td><td>" +
          (k.weight === "req" ? "Required" : "Preferred") + '</td><td><span class="status">' + I[k.status] + word + "</span></td><td>" +
          esc(k.where) + (k.note ? "<small>" + esc(k.note) + "</small>" : "") + "</td></tr>";
      }).join("") : '<tr><td colspan="4">We couldn\'t pick out skills from this job description. Paste the full listing, including its requirements.</td></tr>') +
      "</tbody></table></div>" +
      '<div class="jdhl" id="jd-highlighted"><span class="lab">Job description, highlighted</span>' +
      '<div class="jd-text scroll" tabindex="0" role="region" aria-label="Job description, highlighted"><p>' + highlightJD(jdText.trim(), r.keywords) + "</p></div>" +
      '<div class="legend"><span>' + I.ok + "Matched</span><span>" + I.part + "Partial</span><span>" + I.miss + "Missing</span></div></div></div></section>";

    /* Recruiter review */
    h += '<section class="wrap sec" aria-labelledby="rub-title">' +
      '<div class="sec-h"><h2 id="rub-title">Recruiter review</h2><span class="lab">' + r.rubric.length + ' rubric items · published on <a class="link" href="how-scoring-works.html#recruiter-readiness">How scoring works</a></span></div>' +
      '<div class="rub">' + r.rubric.map(function (x) {
        var cls = x.level === "strong" ? "strong" : x.level === "comp" ? "comp" : "weak";
        return '<div class="card"><div class="card-h"><b>' + esc(x.name) + '</b><span class="bl ' + cls + '">' + I[LEVEL_IC[x.level]] + r.levelWord[x.level] + "</span></div>" +
          "<p>" + esc(x.text) + "</p>" + (x.quote ? "<blockquote>\"" + esc(x.quote) + "\"</blockquote>" : "") + "</div>";
      }).join("") + "</div></section>";

    /* All fixes */
    h += '<section class="wrap sec" id="all-fixes" aria-labelledby="fixes-title">' +
      '<div class="sec-h"><h2 id="fixes-title">All fixes, ranked by estimated gain</h2><span class="lab">Tick them off as you go · this session only</span></div>';
    if (r.fixes.length || r.resolved.length) {
      h += '<ul class="fixes" id="all-fixes-list">' + r.resolved.map(function (f) { return fixItem(f, key, true); }).join("") +
        r.fixes.map(function (f) { return fixItem(f, key, false); }).join("") + "</ul>";
    } else {
      h += '<div class="pf">' + I.ok + "<div><b>Nothing to fix</b><p>We didn't find anything to change for this job description.</p></div></div>";
    }
    h += '<div class="acts"><a class="btn btn-p" href="#scan" data-rescan>Rescan with edited resume</a><a class="btn btn-s" href="#job_description">Swap job description</a>' +
      '<button type="button" class="btn btn-s" data-print>Download report (PDF)</button>' +
      (r.fixes.length ? '<button type="button" class="btn btn-s" data-copy="#all-fixes-list">Copy fix list</button>' : "") + "</div>" +
      '<p class="visually-hidden" role="status" data-copy-status></p>' +
      '<form class="fb" name="feedback" method="post" data-no-handler data-pending-msg="Feedback isn\'t connected yet, so nothing was sent." ' +
      'data-success-msg="Thanks for the feedback." data-error-msg="That didn\'t send. Check your connection and try again.">' +
      '<span id="fb-q">Was this result accurate?</span><input type="hidden" name="report" value="scan">' +
      '<input type="hidden" name="ats" value="' + r.ats + '">' +
      '<button class="btn btn-s btn-sm" type="submit" name="accurate" value="yes" aria-describedby="fb-q">Yes</button>' +
      '<a class="btn btn-s btn-sm" href="report.html">No, report it</a></form>' +
      '<div class="form-msg" data-form-msg data-for="feedback" role="status" hidden></div></section>';
    return h;
  }

  async function drawPdf(model, root) {
    if (model.preview.kind !== "pdf") return;
    var canvas = $(".paper-pdf canvas", root);
    if (!canvas) return;
    try {
      var page = await model.preview.pdf.getPage(1);
      var vp1 = page.getViewport({ scale: 1 });
      var scale = Math.min(2.5, Math.max(1.5, 1200 / vp1.width));
      var vp = page.getViewport({ scale: scale });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    } catch (e) {
      canvas.parentNode.setAttribute("aria-label", "Preview unavailable");
    }
  }

  /* ------------------------------------------------------------ run */
  var current = null;

  function steps(state) {
    var els = document.querySelectorAll("[data-scanning] .stp");
    state.forEach(function (s, i) {
      var el = els[i];
      if (!el) return;
      el.className = "stp " + s;
      el.querySelector("i").textContent = s === "done" ? "✓" : s === "now" ? "" : String(i + 1);
    });
  }
  var frame = function () { return new Promise(function (r) { setTimeout(r, 30); }); };

  var ERR = {
    encrypted: "This PDF is password-protected. Remove the password, or paste the text instead. Your file wasn't stored.",
    nodocx: "This browser can't open DOCX files. Export your resume as a PDF, or paste the text instead.",
    unreadable: "We couldn't read this file. Export it again as a PDF or DOCX, or paste the text instead. Your file wasn't stored."
  };

  ATS.runScan = async function (form, ui) {
    var file = form.resume.files && form.resume.files[0];
    var text = form.resume_text.value.trim();
    var pasteOpen = !$("#resume-text-field").hidden;
    var usePaste = (pasteOpen && text) || !file;
    var jdText = form.job_description.value;
    var scanning = $("[data-scanning]");
    var errorPanel = $("[data-error]");
    var token = { cancelled: false };
    current = token;

    errorPanel.hidden = true;
    ui.busy(true);
    steps(["now", "wait", "wait"]);
    scanning.hidden = false;
    try {
      var model = await ATS.readResume(usePaste ? null : file, text);
      if (token.cancelled) return;
      steps(["done", "now", "wait"]);
      await frame();
      var jd = ATS.analyseJD(jdText);
      // Optional smart matching: never blocks a scan; if it can't load, standard matching is used.
      var smart = null, smartFailed = false;
      if (form.smart_matching && form.smart_matching.checked && ATS.smartMatch) {
        var lab = $("[data-scanning] .lab");
        if (!ATS.smartReady()) lab.textContent = "Scanning · loading smart matching";
        try { smart = await ATS.smartMatch(jd, model); } catch (err) { smartFailed = true; }
        lab.textContent = "Scanning";
      }
      if (token.cancelled) return;
      steps(["done", "done", "now"]);
      await frame();
      var r = ATS.score(model, jd, jdText, store.get(), smart);
      if (token.cancelled) return;
      store.set(r.snapshot);
      steps(["done", "done", "done"]);

      var root = $("#results");
      root.innerHTML = render(r, model, jdText);
      root.hidden = false;
      document.body.classList.add("has-results");
      var fb = $('form[name="feedback"]', root);
      if (fb && ATS.bindForm) ATS.bindForm(fb);
      if (ATS.restoreFixes) ATS.restoreFixes(root);
      drawPdf(model, root);
      if (smartFailed) ui.say("part", "Scan complete, but smart matching couldn't load, so this scan used standard matching. Your results are below.");
      else ui.say("ok", "Scan complete" + (smart ? " with smart matching" : "") + ". Your results are below.");
      var head = $("#results-title");
      head.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      head.focus({ preventScroll: true });
    } catch (e) {
      if (token.cancelled) return;
      // Don't leave an older result on screen under a failed scan
      var old = $("#results");
      old.hidden = true;
      old.innerHTML = "";
      document.body.classList.remove("has-results");
      if (e && e.code === "scanned") {
        errorPanel.hidden = false;
        var h2 = $("h2", errorPanel);
        h2.setAttribute("tabindex", "-1");
        h2.focus();
      } else {
        ui.say("miss", ERR[e && e.code] || ERR.unreadable);
        if (window.console) console.warn("Scan failed:", e);
      }
    } finally {
      if (current === token) {
        scanning.hidden = true;
        ui.busy(false);
        current = null;
      }
    }
  };

  ATS.cancelScan = function () {
    if (!current) return false;
    current.cancelled = true;
    $("[data-scanning]").hidden = true;
    current = null;
    return true;
  };

  /* Smart matching switch: remember the choice (this browser only) and start the
     model download as soon as it's ticked, so a scan doesn't wait for it. */
  var smartBox = document.getElementById("smart_matching");
  var smartStatus = $("[data-smart-status]");
  if (smartBox && ATS.smartWarm) {
    var KEY = "ats-smart-matching";
    var warm = function () {
      if (ATS.smartReady()) { smartStatus.textContent = "Smart matching is ready."; smartStatus.hidden = false; return; }
      smartStatus.textContent = "Downloading the model…";
      smartStatus.hidden = false;
      ATS.smartWarm(function (p) {
        if (p && p.status === "progress" && /\.onnx$/.test(p.file || "") && p.progress) {
          smartStatus.textContent = "Downloading the model… " + Math.round(p.progress) + "%";
        }
      }).then(function () {
        smartStatus.textContent = "Smart matching is ready.";
      }, function () {
        smartStatus.textContent = "Couldn't download the model. Scans will use standard matching.";
      });
    };
    smartBox.addEventListener("change", function () {
      try { localStorage.setItem(KEY, smartBox.checked ? "1" : "0"); } catch (e) { /* storage blocked */ }
      if (smartBox.checked) warm();
      else smartStatus.hidden = true;
    });
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (saved === "1") { smartBox.checked = true; warm(); }
  }

  /* Live "We detected" row under the job description */
  var jdBox = document.getElementById("job_description");
  var detect = $("[data-detected]");
  if (jdBox && detect) {
    var timer = null;
    var update = function () {
      var v = jdBox.value.trim();
      if (v.length < 60) { detect.hidden = true; return; }
      var jd = ATS.analyseJD(v);
      var tags = [];
      if (jd.title) tags.push(jd.title.title);
      if (jd.level) tags.push(jd.level);
      tags.push(jd.required + " required · " + jd.preferred + " preferred");
      detect.innerHTML = "<span>We detected:</span>" + tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") +
        '<button type="button" class="link link-btn" data-detect-edit>Edit</button>';
      detect.hidden = false;
    };
    jdBox.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(update, 350); });
    detect.addEventListener("click", function (e) {
      if (e.target.closest("[data-detect-edit]")) jdBox.focus();
    });
    update();
  }
})();
