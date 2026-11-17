/* ATS_Breaker scan: file readers. Everything runs in the browser; nothing is uploaded.
   ATS.readResume(file | null, pastedText) resolves to a "resume model":
   {
     source: "pdf" | "docx" | "text", fileName, pageCount,
     lines:  [{ text, bullet, heading, page }]   // reading order used for analysis
     ats:    [{ segs: [{ t, cls }] }]            // what a simple ATS extracts, line by line
     headerText, flags: { columns, tableLayout, textBoxes, contactInHeader },
     preview: { kind: "pdf", pdf, columnBox } | { kind: "doc", header, blocks }
   }
   Errors are thrown with err.code: "scanned" | "encrypted" | "unreadable" | "nodocx". */
(function () {
  "use strict";
  var ATS = window.ATS = window.ATS || {};

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  var PDFJS_BASE = SCRIPT_SRC ? SCRIPT_SRC.replace(/[^/]*$/, "") + "vendor/pdfjs/" : "js/vendor/pdfjs/";
  var BULLET_RE = /^\s*(?:[•●▪■◦‣∙·*–—-]|o(?=\s)|•||)\s*/;
  var EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  var PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

  function fail(code, cause) {
    var e = new Error(code);
    e.code = code;
    if (cause) e.cause = cause;
    return e;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(fail("unreadable")); };
      document.head.appendChild(s);
    });
  }

  function splitBullet(text) {
    var m = text.match(BULLET_RE);
    // Avoid treating "-5%" or a lone hyphenated word as a bullet: require text after the glyph
    if (m && text.slice(m[0].length).trim().length > 1 && !/^\s*-\d/.test(text)) {
      return { text: text.slice(m[0].length).trim(), bullet: true };
    }
    return { text: text.trim(), bullet: false };
  }

  /* ------------------------------------------------------------------ text */
  function readText(text) {
    var lines = [];
    var ats = [];
    text.replace(/\r\n?/g, "\n").split("\n").forEach(function (raw) {
      if (!raw.trim()) return;
      var b = splitBullet(raw);
      lines.push({ text: b.text, bullet: b.bullet, heading: false, page: 1 });
      ats.push({ segs: [{ t: raw.trim(), cls: "" }] });
    });
    return {
      source: "text", fileName: "Pasted text", pageCount: 1, lines: lines, ats: ats, headerText: "",
      flags: { columns: false, tableLayout: false, textBoxes: false, contactInHeader: false },
      preview: { kind: "doc", header: "", blocks: lines.map(function (l) { return { text: l.text, bullet: l.bullet, flag: "" }; }) }
    };
  }

  /* ------------------------------------------------------------------ DOCX */
  async function inflateRaw(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buf, wanted) {
    var v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
    var eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw fail("unreadable");
    var count = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), out = {};
    for (var n = 0; n < count; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
      var nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
      var off = v.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (!wanted(name)) continue;
      var start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
      var data = u8.subarray(start, start + csize);
      if (method === 0) out[name] = data;
      else if (method === 8) out[name] = await inflateRaw(data);
    }
    return out;
  }

  function readDocxXml(files) {
    var W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    var dec = new TextDecoder();
    var parse = function (bytes) { return new DOMParser().parseFromString(dec.decode(bytes), "application/xml"); };
    var doc = parse(files["word/document.xml"]);
    var body = doc.getElementsByTagNameNS(W, "body")[0];
    if (!body) throw fail("unreadable");

    var inTextBox = function (el, stop) {
      for (var a = el.parentNode; a && a !== stop; a = a.parentNode) {
        if (a.localName === "txbxContent") return true;
      }
      return false;
    };
    var paraText = function (p) {
      var s = "";
      var walk = function (node) {
        for (var c = node.firstChild; c; c = c.nextSibling) {
          if (c.nodeType !== 1) continue;
          var ln = c.localName;
          if (ln === "txbxContent" || ln === "Fallback") continue; // text boxes are handled separately
          if (ln === "t") s += c.textContent;
          else if (ln === "tab") s += "\t";
          else if (ln === "br" || ln === "cr") s += "\n";
          else walk(c);
        }
      };
      walk(p);
      return s.replace(/\s+\n/g, "\n").trim();
    };
    var paraInfo = function (p) {
      var pPr = p.getElementsByTagNameNS(W, "pPr")[0];
      var style = "";
      var isList = false;
      if (pPr && pPr.parentNode === p) {
        var ps = pPr.getElementsByTagNameNS(W, "pStyle")[0];
        if (ps) style = ps.getAttributeNS(W, "val") || ps.getAttribute("w:val") || "";
        isList = pPr.getElementsByTagNameNS(W, "numPr").length > 0 || /list/i.test(style);
      }
      return { style: style, isList: isList };
    };

    var lines = [], ats = [], blocks = [];
    var flags = { columns: false, tableLayout: false, textBoxes: false, contactInHeader: false };

    var addPara = function (p, flag) {
      var text = paraText(p);
      if (!text) return;
      var info = paraInfo(p);
      text.split("\n").forEach(function (t) {
        if (!t.trim()) return;
        var b = splitBullet(t);
        var bullet = info.isList || b.bullet;
        var heading = /heading|title/i.test(info.style);
        lines.push({ text: b.text, bullet: bullet, heading: heading, page: 1 });
        blocks.push({ text: b.text, bullet: bullet, heading: heading, flag: flag || "" });
      });
    };

    var visit = function (container) {
      for (var c = container.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        if (c.localName === "p") {
          addPara(c);
          var t = paraText(c);
          if (t) t.split("\n").forEach(function (x) { if (x.trim()) ats.push({ segs: [{ t: x.trim(), cls: "" }] }); });
        } else if (c.localName === "tbl") {
          visitTable(c);
        } else if (c.localName === "sdt" || c.localName === "sdtContent" || c.localName === "customXml") {
          visit(c);
        }
      }
    };
    var visitTable = function (tbl) {
      var rows = Array.prototype.filter.call(tbl.getElementsByTagNameNS(W, "tr"), function (tr) {
        for (var a = tr.parentNode; a; a = a.parentNode) if (a.localName === "tbl") return a === tbl;
        return false;
      });
      rows.forEach(function (tr) {
        var cells = Array.prototype.filter.call(tr.childNodes, function (n) { return n.localName === "tc"; });
        var cellTexts = cells.map(function (tc) {
          return Array.prototype.map.call(tc.getElementsByTagNameNS(W, "p"), paraText).filter(Boolean).join(" ");
        });
        var filled = cellTexts.filter(function (t) { return t.length > 2; });
        if (filled.length >= 2 && filled.join(" ").length > 40) flags.tableLayout = true;
        cells.forEach(function (tc) {
          Array.prototype.forEach.call(tc.getElementsByTagNameNS(W, "p"), function (p) { addPara(p, filled.length >= 2 ? "TABLE" : ""); });
        });
        // A simple ATS reads a table row straight across, mixing the cells together.
        if (filled.length) {
          ats.push({ segs: filled.length >= 2
            ? filled.map(function (t, i) { return { t: t + (i < filled.length - 1 ? "  " : ""), cls: i === 0 ? "bad" : "" }; })
            : [{ t: filled[0], cls: "" }] });
        }
      });
    };
    visit(body);

    // Text boxes: many ATSs skip them entirely.
    var boxes = Array.prototype.filter.call(doc.getElementsByTagNameNS(W, "txbxContent"), function (tb) {
      for (var a = tb.parentNode; a; a = a.parentNode) if (a.localName === "Fallback") return false;
      return true;
    });
    boxes.forEach(function (tb) {
      Array.prototype.forEach.call(tb.getElementsByTagNameNS(W, "p"), function (p) {
        if (inTextBox(p, tb)) return;
        var before = lines.length;
        addPara(p, "TEXT BOX");
        if (lines.length > before) flags.textBoxes = true;
      });
    });
    if (flags.textBoxes) ats.push({ segs: [{ t: "[text box not extracted]", cls: "gone" }] });

    // Multi-column sections
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, "cols"), function (cols) {
      var num = parseInt(cols.getAttributeNS(W, "num") || cols.getAttribute("w:num") || "1", 10);
      if (num >= 2) flags.columns = true;
    });

    // Headers: text a lot of ATSs never read
    var headerText = Object.keys(files).filter(function (n) { return /^word\/header\d*\.xml$/.test(n); })
      .map(function (n) {
        var hd = parse(files[n]);
        return Array.prototype.map.call(hd.getElementsByTagNameNS(W, "p"), paraText).filter(Boolean).join("\n");
      }).filter(Boolean).join("\n").trim();
    var bodyText = lines.map(function (l) { return l.text; }).join("\n");
    if (headerText && (EMAIL_RE.test(headerText) || PHONE_RE.test(headerText)) && !EMAIL_RE.test(bodyText)) {
      flags.contactInHeader = true;
    }
    if (headerText) ats.unshift({ segs: [{ t: "[header not extracted]", cls: "gone" }] });

    return { lines: lines, ats: ats, flags: flags, headerText: headerText, blocks: blocks };
  }

  async function readDocx(file) {
    if (!("DecompressionStream" in window)) throw fail("nodocx");
    var files;
    try {
      files = await unzip(await file.arrayBuffer(), function (n) {
        return /^word\/(document|header\d*|footer\d*)\.xml$/.test(n);
      });
    } catch (e) { throw e.code ? e : fail("unreadable", e); }
    if (!files["word/document.xml"]) throw fail("unreadable");
    var r = readDocxXml(files);
    if (r.lines.map(function (l) { return l.text; }).join("").length < 40) throw fail("unreadable");
    return {
      source: "docx", fileName: file.name, pageCount: null, lines: r.lines, ats: r.ats, headerText: r.headerText,
      flags: r.flags, preview: { kind: "doc", header: r.headerText, blocks: r.blocks }
    };
  }

  /* ------------------------------------------------------------------ PDF */
  var pdfReady = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (!pdfReady) {
      // From file:// a Worker can't start, so load the worker code on the page and pdf.js uses it in place.
      var pre = location.protocol === "file:" ? loadScript(PDFJS_BASE + "pdf.worker.min.js") : Promise.resolve();
      pdfReady = pre.then(function () { return loadScript(PDFJS_BASE + "pdf.min.js"); }).then(function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js";
      });
    }
    return pdfReady;
  }

  // Group positioned text items into visual lines.
  function buildLines(items) {
    items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var lines = [];
    items.forEach(function (it) {
      var line = lines[lines.length - 1];
      if (line && Math.abs(line.y - it.y) <= Math.max(2, Math.min(line.h, it.h) * 0.45)) line.items.push(it);
      else lines.push({ y: it.y, h: it.h, items: [it] });
    });
    lines.forEach(function (l) { l.items.sort(function (a, b) { return a.x - b.x; }); });
    return lines;
  }

  function joinItems(items) {
    var s = "";
    items.forEach(function (it, i) {
      if (i > 0) {
        var prev = items[i - 1];
        var gap = it.x - (prev.x + prev.w);
        if (gap > prev.h * 0.15 && !/\s$/.test(s) && !/^\s/.test(it.s)) s += " ";
      }
      s += it.s;
    });
    return s.replace(/\s+/g, " ").trim();
  }

  // Find a vertical gutter that splits many lines and that almost nothing crosses.
  function findColumns(lines, pageWidth) {
    if (lines.length < 8) return null;
    var best = null;
    for (var cx = pageWidth * 0.15; cx <= pageWidth * 0.85; cx += 4) {
      var split = 0, cross = 0, left = 0, right = 0;
      lines.forEach(function (l) {
        var hasL = false, hasR = false, crosses = false;
        l.items.forEach(function (it) {
          if (it.x + it.w <= cx - 2) hasL = true;
          else if (it.x >= cx + 2) hasR = true;
          else crosses = true;
        });
        if (crosses) cross++;
        else if (hasL && hasR) split++;
        else if (hasL) left++;
        else if (hasR) right++;
      });
      var ok = (split + left) >= 4 && (split + right) >= 4 && (split >= 3 || (left >= 4 && right >= 4)) &&
        cross <= Math.max(2, (split + left + right) * 0.12);
      var score = split * 2 + Math.min(left, right) - cross * 3;
      if (ok && (!best || score > best.score)) best = { cx: cx, score: score };
    }
    return best ? best.cx : null;
  }

  async function readPdf(file) {
    await loadPdfJs();
    var pdf;
    try {
      pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    } catch (e) {
      throw fail(e && e.name === "PasswordException" ? "encrypted" : "unreadable", e);
    }
    var lines = [], ats = [], textLen = 0, columns = false, columnBox = null;
    var pages = Math.min(pdf.numPages, 6);
    for (var pn = 1; pn <= pages; pn++) {
      var page = await pdf.getPage(pn);
      var vp = page.getViewport({ scale: 1 });
      var tc = await page.getTextContent();
      var items = tc.items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
        var h = Math.abs(i.transform[3]) || Math.abs(i.transform[0]) || i.height || 10;
        return { s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: h };
      });
      items.forEach(function (i) { textLen += i.s.trim().length; });
      var vLines = buildLines(items);
      var cx = findColumns(vLines, vp.width);
      if (cx !== null) {
        columns = true;
        // ATS view: lines read straight across, left column text mixed into the right
        vLines.forEach(function (l) {
          var L = l.items.filter(function (it) { return it.x + it.w <= cx; });
          var R = l.items.filter(function (it) { return it.x + it.w > cx; });
          var segs = [];
          if (L.length && R.length) segs = [{ t: joinItems(L) + " ", cls: "bad" }, { t: joinItems(R), cls: "" }];
          else segs = [{ t: joinItems(l.items), cls: "" }];
          ats.push({ segs: segs });
        });
        // Analysis order: left column, then right column
        var leftLines = [], rightLines = [];
        vLines.forEach(function (l) {
          var L = l.items.filter(function (it) { return it.x + it.w <= cx; });
          var R = l.items.filter(function (it) { return it.x + it.w > cx; });
          if (L.length) leftLines.push({ text: joinItems(L), y: l.y, x: L[0].x });
          if (R.length) rightLines.push({ text: joinItems(R), y: l.y, x: R[0].x });
        });
        if (pn === 1) {
          // Only the part of the left column that sits beside the right column (not a full-width name or header)
          var rightTop = -Infinity;
          vLines.forEach(function (l) { l.items.forEach(function (it) { if (it.x >= cx) rightTop = Math.max(rightTop, it.y + it.h); }); });
          var LI = [];
          vLines.forEach(function (l) { l.items.forEach(function (it) { if (it.x + it.w <= cx && it.y <= rightTop + 1) LI.push(it); }); });
          if (!LI.length) vLines.forEach(function (l) { l.items.forEach(function (it) { if (it.x + it.w <= cx) LI.push(it); }); });
          var minX = Math.min.apply(null, LI.map(function (i) { return i.x; }));
          var maxX = Math.max.apply(null, LI.map(function (i) { return i.x + i.w; }));
          var maxY = Math.max.apply(null, LI.map(function (i) { return i.y + i.h; }));
          var minY = Math.min.apply(null, LI.map(function (i) { return i.y; }));
          columnBox = { left: minX / vp.width, top: 1 - maxY / vp.height, width: (maxX - minX) / vp.width, height: (maxY - minY) / vp.height };
        }
        leftLines.concat(rightLines).forEach(function (l) {
          var b = splitBullet(l.text);
          lines.push({ text: b.text, bullet: b.bullet, heading: false, page: pn });
        });
      } else {
        vLines.forEach(function (l) {
          var t = joinItems(l.items);
          var b = splitBullet(t);
          lines.push({ text: b.text, bullet: b.bullet, heading: false, page: pn });
          ats.push({ segs: [{ t: t, cls: "" }] });
        });
      }
    }
    if (textLen < 80) throw fail("scanned");
    return {
      source: "pdf", fileName: file.name, pageCount: pdf.numPages, lines: lines, ats: ats, headerText: "",
      flags: { columns: columns, tableLayout: false, textBoxes: false, contactInHeader: false },
      preview: { kind: "pdf", pdf: pdf, columnBox: columnBox }
    };
  }

  ATS.readResume = function (file, pastedText) {
    if (!file) return Promise.resolve(readText(pastedText || ""));
    if (/\.docx$/i.test(file.name)) return readDocx(file);
    return readPdf(file);
  };
  ATS.patterns = { email: EMAIL_RE, phone: PHONE_RE };
})();
