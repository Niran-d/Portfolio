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

  /* ---- Framework B: interactive prompt router ----
     Injects example-prompt chips above the intent branch. Clicking one
     lights the route it infers to. Injected in JS so there is no dead
     control when scripting is unavailable. */
  (function () {
    var branch = document.getElementById("intentBranch");
    if (!branch || !branch.parentNode) { return; }
    var rows = {};
    Array.prototype.slice.call(branch.querySelectorAll(".br-row[data-intent]")).forEach(function (r) {
      rows[r.getAttribute("data-intent")] = r;
    });
    var prompts = [
      { t: "Cheap flights to Tokyo in May", i: "search" },
      { t: "Where should I go this summer?", i: "explore" },
      { t: "Is my flight delayed?", i: "ask" },
      { t: "Plan a 5-day trip to Italy", i: "plan" }
    ];
    var pr = document.createElement("div");
    pr.className = "pr";
    var k = document.createElement("p");
    k.className = "pr-k";
    k.textContent = "Try a prompt — see where it routes";
    pr.appendChild(k);
    var chips = document.createElement("div");
    chips.className = "pr-chips";
    var btns = [];
    function clearAll() {
      Object.keys(rows).forEach(function (key) { rows[key].classList.remove("lit"); });
      btns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    }
    prompts.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p.t;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        var wasActive = b.getAttribute("aria-pressed") === "true";
        clearAll();
        if (!wasActive && rows[p.i]) {
          rows[p.i].classList.add("lit");
          b.setAttribute("aria-pressed", "true");
        }
      });
      chips.appendChild(b);
      btns.push(b);
    });
    pr.appendChild(chips);
    branch.parentNode.insertBefore(pr, branch);
  })();

  /* ---- Framework A: "add a vertical" exponential demo ----
     Appends a control that multiplies the scenario grid to make the
     combinatorial blow-up tangible. */
  (function () {
    var matrix = document.getElementById("classifierMatrix");
    if (!matrix || !matrix.closest) { return; }
    var fw = matrix.closest(".fw");
    if (!fw) { return; }
    var base = 2, dims = base, cap = 7;
    var wrap = document.createElement("div");
    wrap.className = "mx-explode";
    var btn = document.createElement("button");
    btn.type = "button";
    var count = document.createElement("span");
    count.className = "mx-count";
    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "mx-reset";
    reset.textContent = "Reset";
    reset.hidden = true;
    function render() {
      var total = Math.pow(3, dims), expr = [];
      for (var i = 0; i < dims; i++) { expr.push("3"); }
      count.innerHTML = expr.join(" &times; ") + " = <b>" + total.toLocaleString("en-US") + "</b> scenarios";
      reset.hidden = dims === base;
      btn.disabled = dims >= cap;
      btn.textContent = dims >= cap ? "…and it keeps going" : "Add a vertical +";
    }
    btn.addEventListener("click", function () { if (dims < cap) { dims++; render(); } });
    reset.addEventListener("click", function () { dims = base; render(); });
    wrap.appendChild(btn);
    wrap.appendChild(count);
    wrap.appendChild(reset);
    fw.appendChild(wrap);
    render();
  })();

  /* ---- image lightbox: click any figure image to expand & read ---- */
  (function () {
    var main = document.querySelector(".case-main") || document;
    var imgs = Array.prototype.slice.call(main.querySelectorAll(".fig-img img"));
    if (!imgs.length) { return; }

    var EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
    var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    /* build the overlay once */
    var lb = document.createElement("div");
    lb.className = "cs-lb";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Image viewer");
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cs-lb-close";
    closeBtn.setAttribute("aria-label", "Close image viewer");
    closeBtn.innerHTML = CLOSE;
    var wrap = document.createElement("div");
    wrap.className = "cs-lb-imgwrap";
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-label", "Image, scrollable when zoomed");
    var lbImg = document.createElement("img");
    lbImg.alt = "";
    wrap.appendChild(lbImg);
    var cap = document.createElement("p");
    cap.className = "cs-lb-cap";
    var hint = document.createElement("p");
    hint.className = "cs-lb-hint";
    lb.appendChild(closeBtn);
    lb.appendChild(wrap);
    lb.appendChild(cap);
    lb.appendChild(hint);
    document.body.appendChild(lb);

    var lastFocus = null;

    function captionFor(img) {
      var fig = img.closest("figure");
      if (fig) { var fc = fig.querySelector("figcaption"); if (fc) { return fc.innerHTML; } }
      var c = img.closest(".cmp-item");
      if (c) {
        var cc = c.querySelector(".cmp-cap"), cd = c.querySelector(".cmp-desc");
        return (cc ? "<b>" + cc.textContent.trim() + "</b> " : "") + (cd ? cd.textContent.trim() : "");
      }
      var g = img.closest(".glance-item");
      if (g) {
        var gn = g.querySelector(".gi-name"), gd = g.querySelector(".glance-desc");
        return (gn ? "<b>" + gn.textContent.trim() + "</b> " : "") + (gd ? gd.textContent.trim() : "");
      }
      return img.getAttribute("alt") || "";
    }

    function open(img) {
      lastFocus = document.activeElement;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.getAttribute("alt") || "";
      cap.innerHTML = captionFor(img);
      wrap.classList.remove("zoomed");
      wrap.scrollTop = 0; wrap.scrollLeft = 0;
      /* only offer pixel-zoom when the image is bigger than what fits */
      var canZoom = img.naturalWidth > wrap.clientWidth * 1.05 || img.naturalHeight > window.innerHeight * 0.9;
      hint.textContent = canZoom ? "Click image to zoom · Esc to close" : "Esc to close";
      wrap.dataset.canzoom = canZoom ? "1" : "";
      document.body.classList.add("cs-lb-open");
      lb.classList.add("open");
      closeBtn.focus();
    }
    function close() {
      lb.classList.remove("open");
      document.body.classList.remove("cs-lb-open");
      wrap.classList.remove("zoomed");
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    /* wire every figure image */
    imgs.forEach(function (img) {
      var holder = img.closest(".fig-img");
      if (!holder) { return; }
      holder.classList.add("zoomable");
      img.addEventListener("click", function () { open(img); });
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fig-expand";
      btn.setAttribute("aria-label", "Expand image" + (img.alt ? ": " + img.alt.slice(0, 60) : ""));
      btn.innerHTML = EXPAND;
      btn.addEventListener("click", function (e) { e.stopPropagation(); open(img); });
      holder.appendChild(btn);
    });

    /* zoom toggle */
    wrap.addEventListener("click", function () {
      if (!wrap.dataset.canzoom) { return; }
      wrap.classList.toggle("zoomed");
    });
    /* backdrop click (outside the image) closes */
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target === cap || e.target === hint) { close(); }
    });
    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) { return; }
      if (e.key === "Escape") { close(); }
      else if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); } /* trap focus */
    });
  })();

  /* ---- "signal of opportunity" chart (Chart.js, graceful fallback) ---- */
  (function () {
    var canvas = document.getElementById("ctrChart");
    if (!canvas) { return; }
    var table = document.getElementById("ctrChartData");
    /* CDN failed or blocked: reveal the data table so numbers are still readable */
    if (!window.Chart) {
      if (table) { table.classList.add("show"); }
      canvas.style.display = "none";
      return;
    }
    var INK = "rgba(0,0,0,0.88)", ACCENT = "#2f4a6b", LABEL = "#5b5b5b",
        GRID = "rgba(0,0,0,0.07)", AXIS = "rgba(0,0,0,0.16)";
    var FONT = "'Source Sans 3', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.family = FONT;
    Chart.defaults.font.size = 13;
    Chart.defaults.color = LABEL;

    var valueLabels = {
      id: "valueLabels",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = "600 13px " + FONT;
        ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        chart.data.datasets.forEach(function (ds, di) {
          var meta = chart.getDatasetMeta(di);
          if (meta.hidden) { return; }
          meta.data.forEach(function (bar, i) { ctx.fillText("~" + ds.data[i] + "%", bar.x, bar.y - 6); });
        });
        ctx.restore();
      }
    };

    new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["KAYAK.com", "KAYAK.ai"],
        datasets: [
          { label: "Total traffic", data: [50, 7], backgroundColor: INK, borderRadius: 6, maxBarThickness: 66 },
          { label: "Click-through rate", data: [10, 45], backgroundColor: ACCENT, borderRadius: 6, maxBarThickness: 66 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 900, easing: "easeOutQuart" },
        layout: { padding: { top: 26 } },
        scales: {
          y: {
            beginAtZero: true, max: 100,
            ticks: { stepSize: 25, color: LABEL, callback: function (v) { return v + "%"; } },
            grid: { color: GRID }, border: { display: false }
          },
          x: {
            ticks: { color: INK, font: { weight: "600", size: 14 } },
            grid: { display: false }, border: { color: AXIS }
          }
        },
        plugins: {
          legend: { position: "top", align: "end", labels: { boxWidth: 12, boxHeight: 12, color: LABEL, padding: 16, font: { size: 13 } } },
          tooltip: {
            backgroundColor: "rgba(20,22,26,0.95)", padding: 10, cornerRadius: 8,
            callbacks: { label: function (ctx) { return ctx.dataset.label + ": ~" + ctx.parsed.y + "%"; } }
          }
        }
      },
      plugins: [valueLabels]
    });
  })();
})();
