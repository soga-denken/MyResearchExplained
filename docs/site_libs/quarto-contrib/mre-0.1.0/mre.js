/*! mre.js — "My Research Explained" topic panels for Quarto's sidebar.
 *
 * - Each top-level sidebar section becomes a panel: article count, an optional
 *   one-line note, and (by default) only one panel open at a time.
 * - Sections nested inside a panel become always-open labelled groups.
 * - The open panel is remembered per browser.
 * - Figure/table captions get a small "Figure 1" / "Table 1" label and wide
 *   tables scroll inside their own box.
 *
 * Options come from `mre:` in _quarto.yml (passed in as window.MRE_CONFIG):
 *   mre:
 *     accordion: true          # one panel open at a time
 *     remember: true           # remember the open panel
 *     topics:
 *       "Seismic PRA":
 *         note: "One-line description shown inside the panel."
 */
(function () {
  "use strict";
  var DEFAULTS = { accordion: true, remember: true, storageKey: "mre:open-topics", topics: {} };
  var cfg = DEFAULTS;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var hasBootstrap = function () { return !!(window.bootstrap && window.bootstrap.Collapse); };

  function readConfig() {
    var user = window.MRE_CONFIG;
    if (!user || Array.isArray(user)) user = {};
    cfg = Object.assign({}, DEFAULTS, user);
    if (!cfg.topics || Array.isArray(cfg.topics)) cfg.topics = {};
    cfg.accordion = cfg.accordion !== false && cfg.accordion !== "false";
    cfg.remember = cfg.remember !== false && cfg.remember !== "false";
  }

  function store(keys) {
    if (!cfg.remember) return;
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(keys)); } catch (e) { /* storage unavailable */ }
  }
  function recall() {
    if (!cfg.remember) return [];
    try { var v = JSON.parse(localStorage.getItem(cfg.storageKey) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  function topics() {
    return Array.prototype.filter.call(
      document.querySelectorAll("#quarto-sidebar li.sidebar-item-section"),
      function (li) { var b = li.querySelector(":scope > .sidebar-section"); return b && b.classList.contains("depth1"); }
    );
  }
  function bodyOf(li) { return li.querySelector(":scope > .sidebar-section"); }
  function keyOf(li) { var t = li.querySelector(":scope > .sidebar-item-container .menu-text"); return t ? t.textContent.trim() : ""; }
  function isOpen(li) { return bodyOf(li).classList.contains("show"); }
  function togglesOf(li) { return li.querySelectorAll(':scope > .sidebar-item-container [data-bs-toggle="collapse"]'); }

  function markState(li, open) {
    li.classList.toggle("mre-open", open);
    Array.prototype.forEach.call(togglesOf(li), function (t) {
      t.setAttribute("aria-expanded", open ? "true" : "false");
      t.classList.toggle("collapsed", !open);
    });
  }
  function saveState() { store(topics().filter(isOpen).map(keyOf)); }

  /* --- open/close without Bootstrap (mirrors Bootstrap's .collapsing) --- */
  function animate(el, open, done) {
    if (!el.isConnected || (reduceMotion && reduceMotion.matches)) {
      el.classList.toggle("show", open);
      if (done) done();
      return;
    }
    var timer;
    var finish = function () {
      clearTimeout(timer);
      el.removeEventListener("transitionend", onEnd);
      el.classList.remove("collapsing");
      el.classList.add("collapse");
      el.classList.toggle("show", open);
      el.style.height = "";
      if (done) done();
    };
    var onEnd = function (e) { if (e.target === el) finish(); };
    if (open) {
      el.classList.remove("collapse");
      el.classList.add("collapsing");
      el.style.height = "0px";
      el.addEventListener("transitionend", onEnd);
      requestAnimationFrame(function () { el.style.height = el.scrollHeight + "px"; });
    } else {
      el.style.height = el.getBoundingClientRect().height + "px";
      void el.offsetHeight;
      el.classList.add("collapsing");
      el.classList.remove("collapse", "show");
      el.addEventListener("transitionend", onEnd);
      requestAnimationFrame(function () { el.style.height = "0px"; });
    }
    timer = setTimeout(finish, 420);
  }

  function setOpen(li, open, opts) {
    opts = opts || {};
    var body = bodyOf(li);
    if (isOpen(li) === open && !body.classList.contains("collapsing")) { markState(li, open); return; }
    markState(li, open);
    if (opts.instant) { body.classList.toggle("show", open); return; }
    if (hasBootstrap()) {
      var inst = window.bootstrap.Collapse.getOrCreateInstance(body, { toggle: false });
      if (open) inst.show(); else inst.hide();
      return;
    }
    animate(body, open, saveState);
  }

  function closeOthers(except, opts) {
    if (!cfg.accordion) return;
    topics().forEach(function (li) { if (li !== except && isOpen(li)) setOpen(li, false, opts); });
  }

  function enhance(li) {
    if (li.dataset.mreReady) return;
    li.dataset.mreReady = "1";
    li.classList.add("mre-topic");
    var body = bodyOf(li);
    var key = keyOf(li);

    // article count
    var n = body.querySelectorAll("a.sidebar-link[href]").length;
    var label = li.querySelector(":scope > .sidebar-item-container > .sidebar-item-text");
    if (label && n) {
      var c = document.createElement("span");
      c.className = "mre-count";
      c.title = n + (n === 1 ? " article" : " articles");
      c.innerHTML = n + '<span class="visually-hidden">' + (n === 1 ? " article" : " articles") + "</span>";
      // Quarto >= 1.6 puts the chevron inside the header button; keep the count before it
      label.insertBefore(c, label.querySelector(":scope > i.bi"));
    }

    // one-line topic note
    var t = cfg.topics[key];
    var note = t && (typeof t === "string" ? t : t.note);
    if (note && !body.querySelector(":scope > .mre-topic-note")) {
      var p = document.createElement("li");
      p.className = "mre-topic-note";
      p.textContent = note;
      body.insertBefore(p, body.firstChild);
    }

    // nested sections become static, always-open groups inside the panel
    Array.prototype.forEach.call(body.querySelectorAll("li.sidebar-item-section"), function (g) {
      g.classList.add("mre-group");
      var head = g.querySelector(":scope > .sidebar-item-container");
      var text = head && head.querySelector(".menu-text");
      if (head && text) {
        var title = document.createElement("div");
        title.className = "mre-group-title";
        title.textContent = text.textContent.trim();
        head.replaceChildren(title);
      }
      var gb = g.querySelector(":scope > .sidebar-section");
      if (gb) {
        gb.classList.add("show");
        if (title) { title.id = gb.id + "-title"; gb.setAttribute("aria-labelledby", title.id); }
      }
    });

    // keyboard + ARIA for the panel toggles. Quarto >= 1.6 uses one <button>;
    // older versions use two <a> elements without href.
    Array.prototype.forEach.call(togglesOf(li), function (tg) {
      tg.setAttribute("aria-controls", body.id);
      if (tg.tagName === "A" && !tg.hasAttribute("href")) {
        var separateChevron = tg.classList.contains("sidebar-item-toggle") && !tg.classList.contains("sidebar-item-text");
        tg.setAttribute("role", "button");
        tg.setAttribute("tabindex", separateChevron ? "-1" : "0");
        tg.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tg.click(); }
        });
      }
    });

    // Bootstrap path: accordion + state on Bootstrap's own events
    body.addEventListener("show.bs.collapse", function (e) { if (e.target !== body) return; markState(li, true); closeOthers(li); });
    body.addEventListener("hide.bs.collapse", function (e) { if (e.target !== body) return; markState(li, false); });
    body.addEventListener("shown.bs.collapse", function (e) { if (e.target === body) saveState(); });
    body.addEventListener("hidden.bs.collapse", function (e) { if (e.target === body) saveState(); });
  }

  // fallback click handling (only when Bootstrap is not on the page)
  document.addEventListener("click", function (e) {
    if (hasBootstrap()) return;
    var t = e.target.closest && e.target.closest('#quarto-sidebar [data-bs-toggle="collapse"]');
    if (!t) return;
    var li = t.closest("li.sidebar-item-section");
    if (!li || !li.classList.contains("mre-topic")) return;
    e.preventDefault();
    var open = !isOpen(li);
    if (open) closeOthers(li);
    setOpen(li, open);
  });

  function activeTopic() {
    var a = document.querySelector("#quarto-sidebar a.sidebar-link.active[href]");
    return a ? a.closest("li.mre-topic") : null;
  }

  /* Sync the panels to the current page. */
  function refresh(opts) {
    opts = opts || {};
    var list = topics();
    list.forEach(enhance);
    var instant = !opts.animate;
    var active = activeTopic();
    var target = active;
    if (!target) {
      var saved = recall();
      target = list.filter(function (li) { return saved.indexOf(keyOf(li)) !== -1; })[0] || null;
      if (!target) target = list.filter(isOpen)[0] || list[0] || null;
    }
    if (target) { closeOthers(target, { instant: instant }); setOpen(target, true, { instant: instant }); }
    if (!cfg.accordion && !active) {
      var keep = recall();
      list.forEach(function (li) { if (keep.indexOf(keyOf(li)) !== -1) setOpen(li, true, { instant: true }); });
    }
    list.forEach(function (li) { markState(li, isOpen(li)); });
    if (!instant) saveState();
  }

  /* Caption labels ("Figure 1", "Table 1") and scrollable tables. */
  function decorate(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll("main figcaption, main caption"), function (fc) {
      if (fc.querySelector(".mre-float-label")) return;
      var t = fc.firstChild;
      if (!t || t.nodeType !== 3) return;
      var m = t.data.match(/^\s*((?:Figure|Table|Listing|Fig\.|図|表)\s*[\d.]+)\s*[:：]\s*/);
      if (!m) return;
      var s = document.createElement("span");
      s.className = "mre-float-label";
      s.textContent = m[1].replace(/\s+/g, " ");
      t.data = t.data.slice(m[0].length);
      fc.insertBefore(s, t);
    });
    Array.prototype.forEach.call(root.querySelectorAll("main table"), function (tb) {
      if (tb.parentElement.classList.contains("mre-table-scroll")) return;
      var w = document.createElement("div");
      w.className = "mre-table-scroll";
      tb.parentNode.insertBefore(w, tb);
      w.appendChild(tb);
    });
  }

  window.MRE = {
    refresh: refresh,
    decorate: decorate,
    open: function (li) { closeOthers(li); setOpen(li, true); },
    close: function (li) { setOpen(li, false); }
  };

  function boot() { readConfig(); refresh(); decorate(document); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
