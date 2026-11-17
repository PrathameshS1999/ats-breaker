/* ATS_Breaker: shared page behaviour. Every page still renders and navigates without this file.
   Sections: helpers · forms (validation + submit states) · scan form · delegated controls
   (keyword filters, fix tick-off, print, copy) · hash focus. The scan itself is in scan-*.js. */
(function () {
  "use strict";

  var ATS = window.ATS = window.ATS || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var ICON = { ok: "✓", part: "◐", miss: "✕" };

  function iconEl(kind) {
    var i = document.createElement("i");
    i.className = "ic " + kind;
    i.setAttribute("aria-hidden", "true");
    i.textContent = ICON[kind];
    return i;
  }

  /* Write "icon + words" into an element and show it. */
  function say(el, kind, text) {
    if (!el) return;
    el.textContent = "";
    el.appendChild(iconEl(kind));
    var span = document.createElement("span");
    span.textContent = text;
    el.appendChild(span);
    el.hidden = false;
  }

  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked: ignore */ } }
  };

  /* ======================================================================
     Forms
     - Each form names a validator below (by its name attribute).
     - data-local-scan: the scan runs in the browser (scan-ui.js).
     - data-no-handler: validate, then say plainly that nothing was sent.
     - Otherwise (handler connected): POST to the form's action with fetch,
       disable the buttons while sending, then show success or failure.
     ====================================================================== */

  function errEl(field) {
    var id = field.id === "resume_text" ? "resume" : field.id;
    return document.getElementById(id + "-err");
  }

  function clearError(field) {
    var el = errEl(field);
    if (el) { el.hidden = true; el.textContent = ""; }
    field.removeAttribute("aria-invalid");
    if (field.id === "resume" || field.id === "resume_text") {
      $$("#resume, #resume_text").forEach(function (f) { f.removeAttribute("aria-invalid"); });
      var drop = $("[data-drop]");
      if (drop) drop.classList.remove("is-invalid");
    }
  }

  function showError(field, msg) {
    say(errEl(field), "miss", msg);
    field.setAttribute("aria-invalid", "true");
    if (field.id === "resume") {
      var drop = $("[data-drop]");
      if (drop) drop.classList.add("is-invalid");
    }
  }

  var MAX_BYTES = 5 * 1024 * 1024;
  function fileProblem(file) {
    if (!/\.(pdf|docx)$/i.test(file.name)) return "This file isn't a PDF or DOCX. Export it as a PDF, or paste the text instead.";
    if (file.size > MAX_BYTES) return "This file is over 5 MB. Export a smaller PDF, or paste the text instead.";
    if (file.size === 0) return "This file is empty. Choose another file, or paste the text instead.";
    return "";
  }

  var validators = {
    scan: function (form) {
      var errs = [];
      var file = form.resume.files && form.resume.files[0];
      var text = form.resume_text.value.trim();
      var pasteOpen = !$("#resume-text-field").hidden;
      if (pasteOpen && text) {
        if (text.length < 100) errs.push([form.resume_text, "That's too short to scan. Paste the full text of your resume."]);
      } else if (file) {
        var p = fileProblem(file);
        if (p) errs.push([form.resume, p]);
      } else {
        errs.push([pasteOpen ? form.resume_text : form.resume, "Add your resume: choose a PDF or DOCX, or paste the text."]);
      }
      var jd = form.job_description.value.trim();
      if (!jd) errs.push([form.job_description, "Paste the job description."]);
      else if (jd.length < 100) errs.push([form.job_description, "That's too short to scan. Paste the full job description, including its requirements."]);
      return errs;
    },
    report: function (form) {
      var errs = [];
      if (!form.check.value) errs.push([form.check, "Choose which check was wrong."]);
      if (!form.details.value.trim()) errs.push([form.details, "Tell us what it got wrong."]);
      return errs;
    },
    feedback: function () { return []; }
  };

  function msgEl(form) {
    return $("[data-form-msg]", form) || $('[data-form-msg][data-for="' + form.getAttribute("name") + '"]');
  }

  function setBusy(form, busy) {
    form.toggleAttribute("aria-busy", busy);
    $$("button", form).forEach(function (b) { b.disabled = busy; });
  }

  var sendAbort = null;

  function send(form, submitter) {
    var msg = msgEl(form);
    var data;
    try { data = new FormData(form, submitter || undefined); }
    catch (e) {
      data = new FormData(form);
      if (submitter && submitter.name) data.append(submitter.name, submitter.value);
    }
    var ctrl = "AbortController" in window ? new AbortController() : null;
    sendAbort = ctrl;
    setBusy(form, true);
    if (msg) msg.hidden = true;

    fetch(form.action, {
      method: (form.getAttribute("method") || "post").toUpperCase(),
      body: data,
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      say(msg, "ok", form.getAttribute("data-success-msg"));
      if (form.hasAttribute("data-reset-on-success")) form.reset();
    }).catch(function (err) {
      if (err && err.name === "AbortError") { if (msg) msg.hidden = true; return; }
      say(msg, "miss", form.getAttribute("data-error-msg"));
    }).then(function () {
      setBusy(form, false);
      sendAbort = null;
    });
  }

  function bindForm(form) {
    var validate = validators[form.getAttribute("name")];
    if (!validate || form.hasAttribute("data-bound")) return;
    form.setAttribute("data-bound", "");
    form.noValidate = true; // our messages replace the browser's bubbles

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.hasAttribute("aria-busy")) return; // no double submits
      $$("[aria-invalid]", form).forEach(clearError);
      var errs = validate(form);
      var msg = msgEl(form);
      if (msg) msg.hidden = true;
      if (errs.length) {
        errs.forEach(function (pair) { showError(pair[0], pair[1]); });
        errs[0][0].focus();
        return;
      }
      if (form.hasAttribute("data-local-scan") && ATS.runScan) {
        ATS.runScan(form, {
          busy: function (b) { setBusy(form, b); },
          say: function (kind, text) { say(msg, kind, text); }
        });
        return;
      }
      if (form.hasAttribute("data-no-handler") || form.hasAttribute("data-local-scan") || !form.getAttribute("action")) {
        // No destination yet: say so honestly. Nothing is cleared.
        say(msg, "part", form.getAttribute("data-pending-msg") || "This form isn't connected yet, so nothing was sent.");
        return;
      }
      send(form, e.submitter);
    });

    // Clear a field's error as soon as it's edited.
    $$("input, textarea, select", form).forEach(function (field) {
      field.addEventListener(field.tagName === "SELECT" || field.type === "file" ? "change" : "input", function () {
        if (field.getAttribute("aria-invalid")) clearError(field);
      });
    });
  }
  ATS.bindForm = bindForm;
  $$("form[name]").forEach(bindForm);

  /* ======================================================================
     Scan form (index.html): file chip, drag-over, paste toggle, counter
     ====================================================================== */
  var fileInput = document.getElementById("resume");
  if (fileInput) {
    var drop = $("[data-drop]");
    var chip = $("[data-file]");
    var pasteField = document.getElementById("resume-text-field");
    var pasteToggle = $("[data-paste-toggle]");
    var resumeText = document.getElementById("resume_text");

    var showFile = function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) { chip.hidden = true; return; }
      var problem = fileProblem(f);
      if (problem) { chip.hidden = true; showError(fileInput, problem); return; }
      clearError(fileInput);
      $("[data-file-name]", chip).textContent = f.name;
      $("[data-file-size]", chip).textContent = Math.max(1, Math.round(f.size / 1024)) + " KB";
      $("[data-file-type]", chip).textContent = /\.docx$/i.test(f.name) ? "DOCX" : "PDF";
      chip.hidden = false;
      // A chosen file takes over from pasted text
      if (!pasteField.hidden && !resumeText.value.trim()) {
        pasteField.hidden = true;
        pasteToggle.setAttribute("aria-expanded", "false");
      }
    };
    fileInput.addEventListener("change", showFile);

    ["dragenter", "dragover"].forEach(function (t) {
      drop.addEventListener(t, function () { drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (t) {
      drop.addEventListener(t, function () { drop.classList.remove("is-over"); });
    });
    // Fallback focus ring for browsers without :has()
    fileInput.addEventListener("focus", function () { drop.classList.add("is-focus"); });
    fileInput.addEventListener("blur", function () { drop.classList.remove("is-focus"); });

    var openPaste = function () {
      pasteField.hidden = false;
      pasteToggle.setAttribute("aria-expanded", "true");
      resumeText.focus();
    };
    pasteToggle.addEventListener("click", function () {
      if (pasteField.hidden) { openPaste(); }
      else { pasteField.hidden = true; pasteToggle.setAttribute("aria-expanded", "false"); }
    });

    var jd = document.getElementById("job_description");
    var count = $("[data-count]");
    var updateCount = function () { count.textContent = jd.value.length.toLocaleString("en") + " characters"; };
    jd.addEventListener("input", updateCount);
    updateCount();

    var cancel = $("[data-cancel]");
    if (cancel) cancel.addEventListener("click", function () {
      if (ATS.cancelScan && ATS.cancelScan()) {
        setBusy($("#scan"), false);
        return;
      }
      if (sendAbort) sendAbort.abort();
      $("[data-scanning]").hidden = true;
    });
    var choose = $("[data-choose-file]");
    if (choose) choose.addEventListener("click", function () {
      $("[data-error]").hidden = true;
      fileInput.value = "";
      chip.hidden = true;
      fileInput.click();
    });
    var pasteInstead = $("[data-paste-instead]");
    if (pasteInstead) pasteInstead.addEventListener("click", function () {
      $("[data-error]").hidden = true;
      openPaste();
    });
  }

  /* ======================================================================
     Delegated controls (work for the example report and for live results)
     ====================================================================== */
  document.addEventListener("click", function (e) {
    // Keyword filters
    var btn = e.target.closest("[data-filter]");
    if (btn) {
      var scope = btn.closest("section") || document;
      var f = btn.getAttribute("data-filter");
      $$("[data-filter]", scope).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      $$(".kwt tbody tr[data-status]", scope).forEach(function (row) {
        row.hidden = !(f === "all" ||
          (f === "req" ? row.getAttribute("data-weight") === "req" : row.getAttribute("data-status") === f));
      });
      return;
    }
    // Download report (PDF): the browser's print dialog, which saves as PDF
    if (e.target.closest("[data-print]")) { window.print(); return; }
    // Copy fix list
    var copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) copyList(copyBtn);
  });

  // Fix tick-off: kept for this browser session only
  function restoreFixes(root) {
    $$("input[data-fix]", root || document).forEach(function (box) {
      var saved = store.get("ats-" + box.getAttribute("data-fix"));
      if (saved !== null) box.checked = saved === "1";
      box.closest(".fix").classList.toggle("done", box.checked);
    });
  }
  ATS.restoreFixes = restoreFixes;
  restoreFixes();
  document.addEventListener("change", function (e) {
    var box = e.target.closest && e.target.closest("input[data-fix]");
    if (!box) return;
    store.set("ats-" + box.getAttribute("data-fix"), box.checked ? "1" : "0");
    box.closest(".fix").classList.toggle("done", box.checked);
  });

  function copyList(btn) {
    var list = $(btn.getAttribute("data-copy"));
    if (!list) return;
    var section = btn.closest("section") || document;
    var live = $("[data-copy-status]", section);
    var label = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", label);
    var report = function (ok) {
      if (live) live.textContent = ok ? "Fix list copied." : "Copy didn't work. Select the list and copy it.";
      if (!ok) return;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = label; }, 1600);
    };
    var text = $$(".fix", list).map(function (li) {
      var box = $("input[type=checkbox]", li);
      return (box && box.checked ? "[x] " : "[ ] ") + $("p", li).textContent.trim();
    }).join("\n");
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "absolute"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      btn.focus();
      report(ok);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { report(true); }, fallback);
    } else {
      fallback();
    }
  }

  /* ======================================================================
     Links like index.html#job_description or #scan: focus the field
     ====================================================================== */
  function focusHash(hash) {
    hash = typeof hash === "string" ? hash : location.hash;
    if (hash.length < 2) return;
    var id = decodeURIComponent(hash.slice(1));
    var target = document.getElementById(id === "scan" ? "resume" : id);
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
      setTimeout(function () { target.focus({ preventScroll: id === "scan" }); }, 0);
    }
  }
  focusHash();
  window.addEventListener("hashchange", function () { focusHash(); });
  // Same-page links to a field (e.g. "Swap job description") also work when the hash is unchanged
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && a.getAttribute("href") === location.hash) focusHash(a.getAttribute("href"));
  });
})();
