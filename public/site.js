/* ============================================================
   site.js — shared behavior for all pages
   Nav (sticky shadow, dropdowns, mobile menu), sound (always on),
   copy-email, work marquee, scroll reveal, animated text highlight.
   ============================================================ */
(function () {
  "use strict";

  var EMAIL = "you@email.com"; // TODO: replace with real address
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = REDUCE.matches;

  /* ---------- Sticky header shadow ---------- */
  (function stickyShadow() {
    var nav = document.querySelector("[data-nav]");
    if (!nav) { return; }
    function onScroll() { nav.classList.toggle("is-stuck", window.scrollY > 4); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  })();

  /* ---------- Dropdowns (hover via CSS; this adds click/touch + a11y) ---------- */
  (function dropdowns() {
    var items = document.querySelectorAll("[data-dropdown]");
    items.forEach(function (item) {
      var trigger = item.querySelector(".nav-trigger");
      if (!trigger) { return; }
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        var isOpen = item.classList.toggle("open");
        trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        items.forEach(function (other) {
          if (other !== item) { other.classList.remove("open"); other.querySelector(".nav-trigger").setAttribute("aria-expanded", "false"); }
        });
      });
    });
    document.addEventListener("click", function (e) {
      items.forEach(function (item) {
        if (!item.contains(e.target)) {
          item.classList.remove("open");
          var t = item.querySelector(".nav-trigger"); if (t) { t.setAttribute("aria-expanded", "false"); }
        }
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") { return; }
      items.forEach(function (item) {
        item.classList.remove("open");
        var t = item.querySelector(".nav-trigger"); if (t) { t.setAttribute("aria-expanded", "false"); }
      });
    });
  })();

  /* ---------- Mobile menu toggle ---------- */
  (function mobileMenu() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) { return; }
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
  })();

  /* ---------- Sound (always on) ---------- */
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) { return null; }
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") { audioCtx.resume(); }
    return audioCtx;
  }
  function playClick(weight) {
    var ctx = ensureAudio();
    if (!ctx) { return; }
    var now = ctx.currentTime;
    var amount = typeof weight === "number" ? weight : 1;
    var gain = ctx.createGain();
    var osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(460 + amount * 30, now);
    osc.frequency.exponentialRampToValueAtTime(310 + amount * 20, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03 * amount, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.09);
  }
  window.__playClick = playClick;
  document.addEventListener("click", function (e) {
    var t = e.target.closest("a, button");
    if (!t || t.hasAttribute("data-copy-email")) { return; }
    playClick(t.classList.contains("card") || t.classList.contains("menu-item") ? 1.15 : 0.85);
  });

  /* ---------- Copy email ---------- */
  function flash(btn, text) {
    var el = btn.querySelector("[data-copy-label]") || btn.querySelector(".menu-sub") || btn;
    var original = el.textContent;
    el.textContent = text; btn.classList.add("is-confirmed");
    setTimeout(function () { el.textContent = original; btn.classList.remove("is-confirmed"); }, 1500);
  }
  document.querySelectorAll("[data-copy-email]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      playClick(0.8);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(EMAIL).then(function () { flash(btn, btn.getAttribute("data-copied") || "Copied to clipboard"); })
          .catch(function () { window.location.href = "mailto:" + EMAIL; flash(btn, "Email opened"); });
      } else { window.location.href = "mailto:" + EMAIL; flash(btn, "Email opened"); }
    });
  });

  /* ---------- Work marquee (home) ---------- */
  (function marquee() {
    var marquee = document.querySelector("[data-marquee]");
    var track = document.querySelector("[data-track]");
    if (!marquee || !track) { return; }
    Array.prototype.slice.call(track.children).forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      clone.classList.add("is-clone");
      track.appendChild(clone);
    });
    var setWidth = 0;
    function measure() { setWidth = track.scrollWidth / 2; }
    measure();
    window.addEventListener("resize", measure);
    if (reduceMotion) { marquee.style.overflowX = "auto"; return; }

    var offset = 0, speed = 0.22, hovering = false, dragging = false;
    var startX = 0, startOffset = 0, moved = 0;
    function normalize() { if (setWidth > 0) { offset = ((offset % setWidth) + setWidth) % setWidth; } }
    function apply() { track.style.transform = "translateX(" + (-offset).toFixed(2) + "px)"; }
    function tick() { if (!hovering && !dragging) { offset += speed; normalize(); apply(); } requestAnimationFrame(tick); }

    marquee.addEventListener("mouseenter", function () { hovering = true; });
    marquee.addEventListener("mouseleave", function () { hovering = false; });
    marquee.addEventListener("focusin", function () { hovering = true; });
    marquee.addEventListener("focusout", function () { hovering = false; });

    function onMove(e) {
      if (!dragging) { return; }
      var dx = e.clientX - startX; moved = Math.abs(dx);
      offset = startOffset - dx; normalize(); apply();
    }
    function endDrag() {
      if (!dragging) { return; }
      dragging = false; marquee.classList.remove("dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    }
    marquee.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) { return; }
      dragging = true; startX = e.clientX; startOffset = offset; moved = 0;
      marquee.classList.add("dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    });
    track.addEventListener("click", function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    requestAnimationFrame(tick);
  })();

  /* ---------- Home work videos (autoplay loops: case figures + any cards) ---------- */
  (function cardVideos() {
    var vids = Array.prototype.slice.call(document.querySelectorAll(".card-media video, .cs-media video"));
    if (!vids.length) { return; }
    vids.forEach(function (v) {
      v.muted = true; v.playsInline = true;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    });
    if (reduceMotion) { return; }   /* leave the poster frame in place, no motion */
    vids.forEach(function (v) { var p = v.play(); if (p && p.catch) { p.catch(function () {}); } });
  })();

  /* ---------- Scroll reveal ---------- */
  (function reveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!els.length) { return; }
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-revealed"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- Animated text highlight (right-to-left sweep on reveal) ---------- */
  (function highlights() {
    var els = Array.prototype.slice.call(document.querySelectorAll(".hl"));
    if (!els.length) { return; }
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("lit"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("lit"); io.unobserve(e.target); } });
    }, { threshold: 0.9, rootMargin: "0px 0px -4% 0px" });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- Dev-only layout grid overlay (localhost only; press G to toggle) ----------
     Never renders on the deployed site: it bails unless the page is served from a
     local host. Draws the content-column edges + inner padding (the alignment refs
     everything anchors to) and the 58px module grid that the hero background uses. */
  (function devGrid() {
    var host = location.hostname;
    var isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "" || location.protocol === "file:";
    if (!isLocal) { return; }

    var MODULE = 58; /* matches the hero background grid module */
    var overlay = null, on = false;

    function pickColumn() {
      return document.querySelector(".home-col") ||
             document.querySelector(".case-main") ||
             document.querySelector(".shell") ||
             document.querySelector("main");
    }

    function build() {
      overlay = document.createElement("div");
      overlay.id = "devGridOverlay";
      overlay.setAttribute("aria-hidden", "true");

      var style = document.createElement("style");
      style.textContent = [
        "#devGridOverlay{position:fixed;inset:0;z-index:99999;pointer-events:none;}",
        "#devGridOverlay .dg-mod{position:absolute;inset:0;background-image:" +
          "linear-gradient(to right,rgba(255,0,90,.08) 1px,transparent 1px)," +
          "linear-gradient(to bottom,rgba(255,0,90,.08) 1px,transparent 1px);" +
          "background-size:" + MODULE + "px " + MODULE + "px;}",
        "#devGridOverlay .dg-col{position:absolute;top:0;bottom:0;background:rgba(47,74,107,.05);" +
          "border-left:1px solid rgba(47,74,107,.5);border-right:1px solid rgba(47,74,107,.5);}",
        "#devGridOverlay .dg-pad{position:absolute;top:0;bottom:0;" +
          "border-left:1px dashed rgba(255,105,15,.7);border-right:1px dashed rgba(255,105,15,.7);}",
        "#devGridOverlay .dg-center{position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(0,0,0,.22);}",
        "#devGridOverlay .dg-hint{position:fixed;bottom:12px;left:12px;font:600 11px/1.4 ui-monospace,SFMono-Regular,monospace;" +
          "color:#fff;background:rgba(20,22,28,.92);padding:6px 10px;border-radius:8px;letter-spacing:.02em;white-space:nowrap;}"
      ].join("");
      overlay.appendChild(style);

      var mod = document.createElement("div"); mod.className = "dg-mod"; overlay.appendChild(mod);
      var center = document.createElement("div"); center.className = "dg-center"; overlay.appendChild(center);
      var col = document.createElement("div"); col.className = "dg-col"; overlay.appendChild(col);
      var pad = document.createElement("div"); pad.className = "dg-pad"; overlay.appendChild(pad);
      var hint = document.createElement("div"); hint.className = "dg-hint"; overlay.appendChild(hint);
      overlay._mod = mod; overlay._col = col; overlay._pad = pad; overlay._hint = hint;

      document.body.appendChild(overlay);
      position();
    }

    function position() {
      if (!overlay) { return; }
      var el = pickColumn();
      if (!el) { return; }
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      var pl = parseFloat(cs.paddingLeft) || 0;
      var pr = parseFloat(cs.paddingRight) || 0;
      var innerW = Math.max(0, r.width - pl - pr);

      overlay._col.style.left = r.left + "px";
      overlay._col.style.width = r.width + "px";
      overlay._pad.style.left = (r.left + pl) + "px";
      overlay._pad.style.width = innerW + "px";
      /* line the module grid up with the content column's left edge (same trick the hero grid uses) */
      overlay._mod.style.backgroundPositionX = (r.left + pl) + "px";
      overlay._hint.textContent = "GRID · G to hide · content " + Math.round(innerW) + "px · module " + MODULE + "px · vw " + Math.round(window.innerWidth);
    }

    function toggle() {
      on = !on;
      if (on) {
        if (!overlay) { build(); } else { overlay.style.display = ""; position(); }
      } else if (overlay) {
        overlay.style.display = "none";
      }
    }

    window.addEventListener("keydown", function (e) {
      if (e.key !== "g" && e.key !== "G") { return; }
      if (e.metaKey || e.ctrlKey || e.altKey) { return; }
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) { return; }
      toggle();
    });
    window.addEventListener("resize", function () { if (on) { position(); } });
    window.addEventListener("scroll", function () { if (on) { position(); } }, { passive: true });
  })();
})();
