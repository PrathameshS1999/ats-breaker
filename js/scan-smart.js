/* ATS_Breaker scan: optional "Smart matching".
   Finds job-description keywords that your resume describes in other words
   ("led a team of 8" ≈ "people management") using the BGE small English
   embedding model (BAAI/bge-small-en-v1.5, MIT) run by Transformers.js in the
   browser. Only runs when the visitor ticks the switch.
   - The library (jsDelivr) and model (Hugging Face) are downloaded once, then
     cached by the browser. The resume itself never leaves the device.
   - Smart matches only ever earn Partial credit, never Matched: an ATS keyword
     search still needs the exact words. */
(function () {
  "use strict";
  var ATS = window.ATS = window.ATS || {};

  var LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
  var MODEL = "Xenova/bge-small-en-v1.5";
  // BGE v1.5 recommends this prefix on short queries matched against passages.
  var QUERY = "Represent this sentence for searching relevant passages: ";
  // Cosine similarity at or above this counts as "describes the same thing". Calibrated on two
  // hand-made resume/job pairs (11 reworded skills, 2 absent ones), querying with the job line and
  // one keyword per resume line: 7/11 caught with no wrong or false matches anywhere from 0.58 to
  // 0.65; at 0.55 a wrong line slipped in. 0.62 sits in the middle. Precision over recall.
  ATS.smartThreshold = 0.62;

  var extractor = null, loading = null;

  function load(onProgress) {
    if (extractor) return Promise.resolve(extractor);
    if (!loading) {
      loading = import(LIB).then(function (t) {
        t.env.allowLocalModels = false;
        return t.pipeline("feature-extraction", MODEL, { dtype: "q8", progress_callback: onProgress });
      }).then(function (p) {
        extractor = p;
        return p;
      }).catch(function (e) {
        loading = null;
        throw e;
      });
    }
    return loading;
  }

  async function embed(texts) {
    var out = await extractor(texts, { pooling: "cls", normalize: true });
    return out.tolist();
  }
  function dot(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  /* Start the download early (when the switch is ticked) so a scan doesn't wait. */
  ATS.smartWarm = function (onProgress) { return load(onProgress); };
  ATS.smartReady = function () { return !!extractor; };

  /* For each job keyword, the resume line that means the most similar thing.
     Returns { "<keyword term>": { score: 0..1, text: "<resume line>" } }. */
  ATS.smartMatch = async function (jd, model, onProgress) {
    await load(onProgress);
    var seen = {};
    var lines = model.lines.map(function (l) { return l.text.trim(); }).filter(function (t) {
      var k = t.toLowerCase();
      if (seen[k] || t.split(/\s+/).length < 3 || t.length > 400 || ATS.sectionOf(t)) return false;
      // Role headers ("Operations Coordinator, Parcel Co, 2017 – 2020") name a job, they don't show a skill
      if (/\b(19|20)\d{2}\b/.test(t) && t.split(/\s+/).length <= 12) return false;
      seen[k] = 1;
      return true;
    }).slice(0, 120);
    var terms = jd.keywords.map(function (k) { return k.term; });
    if (!lines.length || !terms.length) return {};
    var L = await embed(lines);
    // Search with the job description's own line ("Incident response for system outages"),
    // which carries far more meaning than the bare keyword.
    var K = await embed(jd.keywords.map(function (k) { return QUERY + (k.context || k.term); }));
    var S = K.map(function (kv) { return L.map(function (lv) { return dot(kv, lv); }); });
    // Each resume line can only support the keyword it fits best, so one line
    // about complaints can't also "prove" incident response.
    var lineTop = lines.map(function (_, j) {
      var bi = 0;
      for (var i = 1; i < S.length; i++) if (S[i][j] > S[bi][j]) bi = i;
      return bi;
    });
    var result = {};
    terms.forEach(function (term, i) {
      var best = { score: -1, text: "" };
      S[i].forEach(function (s, j) { if (lineTop[j] === i && s > best.score) best = { score: s, text: lines[j] }; });
      result[term] = best;
    });
    return result;
  };
})();
