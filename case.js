/* ============================================================
   case.js — case-study behavior
   Reading progress, side-nav scrollspy, rolling-number metric
   counters, and autoplaying demo videos (all with a
   reduced-motion fallback).
   ============================================================ */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- reading progress ---- */
  (function () {
    var bar = document.getElementById("readingProgress");
    if (!bar) { return; }
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var p = max > 0 ? (window.scrollY || doc.scrollTop) / max : 0;
      bar.style.width = (Math.min(Math.max(p, 0), 1) * 100).toFixed(2) + "%";
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  })();

  /* ---- side-nav scrollspy ---- */
  (function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.case-nav a[href^="#"]'));
    if (!links.length) { return; }
    var sections = [];
    links.forEach(function (a) {
      var s = document.getElementById(a.getAttribute("href").slice(1));
      if (s) { sections.push(s); }
    });
    function onScroll() {
      var probe = window.scrollY + 130;
      var currentId = sections.length ? sections[0].id : null;
      sections.forEach(function (s) { if (s.offsetTop <= probe) { currentId = s.id; } });
      links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + currentId); });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  })();

  /* ---- rolling-number counters for metric cards ---- */
  (function counters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll(".metric .num"));
    if (!nums.length) { return; }
    var items = [];
    nums.forEach(function (el) {
      var raw = (el.textContent || "").trim();
      var m = raw.match(/^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
      if (!m) { return; }
      var numStr = m[2].replace(/,/g, "");
      var dec = numStr.indexOf(".") >= 0 ? numStr.split(".")[1].length : 0;
      items.push({
        el: el, prefix: m[1], suffix: m[3], target: parseFloat(numStr),
        dec: dec, comma: m[2].indexOf(",") >= 0
      });
    });
    if (!items.length) { return; }
    function render(it, val) {
      var n = it.dec ? val.toFixed(it.dec) : String(Math.round(val));
      if (it.comma) { n = Number(n).toLocaleString("en-US"); }
      it.el.textContent = it.prefix + n + it.suffix;
    }
    if (reduceMotion || !("IntersectionObserver" in window)) { return; } /* leave final values */
    items.forEach(function (it) { it.el.__c = it; render(it, 0); });
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        var it = e.target.__c; io.unobserve(e.target);
        var dur = 1150, start = null;
        function step(ts) {
          if (start === null) { start = ts; }
          var t = Math.min((ts - start) / dur, 1);
          render(it, it.target * ease(t));
          if (t < 1) { requestAnimationFrame(step); } else { render(it, it.target); }
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    items.forEach(function (it) { io.observe(it.el); });
  })();

  /* ---- demo videos: autoplay in view, with reduced-motion fallback ---- */
  (function () {
    var videos = Array.prototype.slice.call(document.querySelectorAll(".fig-img video"));
    if (!videos.length) { return; }
    if (reduceMotion) {
      videos.forEach(function (v) { v.setAttribute("controls", ""); try { v.pause(); } catch (e) {} });
      return;
    }
    videos.forEach(function (v) {
      v.muted = true; v.playsInline = true;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.removeAttribute("controls");
    });
    function tryPlay(v) { var p = v.play(); if (p && p.catch) { p.catch(function () { v.setAttribute("controls", ""); }); } }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { tryPlay(e.target); } else { try { e.target.pause(); } catch (err) {} }
        });
      }, { threshold: 0.25 });
      videos.forEach(function (v) { io.observe(v); });
    } else {
      videos.forEach(tryPlay);
    }
  })();
})();
