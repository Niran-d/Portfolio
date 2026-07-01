/* ============================================================
   play-stage.js — a small, self-contained pixel-crowd engine.

   A vendored, buildless port of the "Come touch grass" presenter
   stage. It loads detailed character sheets, chroma-keys their
   white backgrounds to transparent (flood fill from each frame's
   edges, so eye-whites and teeth survive), and drives a crowd of
   canvas avatars through a shared action vocabulary: idle, walk,
   cheer, clap, wave, raise-hand, floating emotes, and speech
   bubbles. The on-page control panel and per-avatar taps call into
   that same vocabulary.

   All motion is gated behind prefers-reduced-motion. Reduced-motion
   users get a static-but-interactive tableau (instant pose swaps,
   no rAF loop, no travel), and the field pauses when scrolled out
   of view.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var SHEET_DIR = "img/smallest-problem/sheets/";
  var FRAME = 128;           // source frame size (px)
  var COLS = 6;              // frames per pose row

  /* Shared pose rows. Matches the team-sheet composer layout. */
  var POSES = {
    idle:  { row: 0, fps: 4 },
    walk:  { row: 1, fps: 10 },
    cheer: { row: 2, fps: 9 },
    clap:  { row: 3, fps: 8 },
    wave:  { row: 4, fps: 6 }
  };
  /* Names the rest of the system uses, routed onto the five real rows. */
  var ALIASES = { handUp: "wave", jump: "cheer", dance: "cheer", point: "wave", heart: "cheer", laugh: "cheer", sit: "idle", talk: "idle", pet: "wave" };

  /* ----- anonymized crowd. Generic handles, no real names. The dog
     "Biscuit" stands in for the presenter's pet. Sheet ids are the
     pixel-art files only; nothing here identifies a real person. ----- */
  var ROSTER = [
    { sheet: "niran", handle: "niran", action: "idle",  flip: false, lines: ["ok let's do this", "thanks for coming"] },
    { sheet: "rae",   handle: "rae",   action: "wave",  flip: false, lines: ["hi from home \uD83D\uDC4B", "i can see the room!"] },
    { sheet: "wren",  handle: "wren",  action: "idle",  flip: false, lines: ["ok this is delightful", "present!"], opt: true },
    { sheet: "noor",  handle: "noor",  action: "cheer", flip: true,  lines: ["beats a muted tile", "we're all here"] },
    { sheet: "max",   handle: "max",   action: "clap",  flip: true,  lines: ["love this", "so good"], opt: true },
    { sheet: "ivy",   handle: "ivy",   action: "clap",  flip: false, lines: ["front row, kind of", "yes \uD83D\uDC4F"] },
    { sheet: "lou",   handle: "lou",   action: "wave",  flip: false, lines: ["hello from the couch", "\uD83D\uDE4C"], opt: true },
    { sheet: "kai",   handle: "kai",   action: "idle",  flip: false, lines: ["the meadow is cozy", "do this every talk"] },
    { sheet: "flo",   handle: "flo",   action: "idle",  flip: true,  lines: ["cozy little field", "here!"], opt: true },
    { sheet: "sage",  handle: "sage",  action: "wave",  flip: true,  lines: ["wait, this is live?", "\uD83D\uDC4B\uD83D\uDC4B\uD83D\uDC4B"] },
    { sheet: "ari",   handle: "ari",   action: "cheer", flip: false, lines: ["this rules", "\uD83D\uDC4F\uD83D\uDC4F"], opt: true },
    { sheet: "remy",  handle: "remy",  action: "cheer", flip: false, lines: ["best deck all year", "more of these please"] },
    { sheet: "fox",   handle: "fox",   action: "idle",  flip: false, lines: ["nice", "present"], opt: true }
  ];
  var PET = { sheet: "biscuit", handle: "biscuit", action: "idle", flip: true, pet: true, scale: 0.82 };

  var AMBIENT_LINES = [
    "hi from home \uD83D\uDC4B", "i can see the room!", "this beats a muted tile",
    "front row, kind of", "we're all here", "do this every talk",
    "the meadow is cozy", "wait, this is live?", "ok this is delightful",
    "\uD83D\uDC4B\uD83D\uDC4B\uD83D\uDC4B", "more of these please", "best seat in the house"
  ];

  /* =========================================================
     Sheet loading + chroma key (flood fill from frame edges).
     ========================================================= */
  var sheetCache = {};
  function loadSheet(id) {
    if (sheetCache[id]) return sheetCache[id];
    var entry = { canvas: null, ready: false };
    sheetCache[id] = entry;
    var img = new Image();
    img.onload = function () {
      try { entry.canvas = chromaKey(img); }
      catch (e) { entry.canvas = img; }   /* tainted/other failure: use raw */
      entry.w = img.naturalWidth;
      entry.h = img.naturalHeight;
      entry.ready = true;
      /* repaint once when a sheet arrives, in case the rAF loop is not
         running (reduced motion, or not yet revealed). */
      repaintAll();
    };
    img.onerror = function () { entry.ready = false; };
    img.src = SHEET_DIR + id + ".png";
    return entry;
  }

  function chromaKey(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var cx = c.getContext("2d");
    cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0);
    var data = cx.getImageData(0, 0, w, h);
    var px = data.data;
    var cols = Math.max(1, Math.floor(w / FRAME));
    var rows = Math.max(1, Math.floor(h / FRAME));
    for (var r = 0; r < rows; r++) {
      for (var cc = 0; cc < cols; cc++) {
        floodFrame(px, w, cc * FRAME, r * FRAME, FRAME, FRAME);
      }
    }
    cx.putImageData(data, 0, 0);
    return c;
  }

  var TH = 240; /* near-white threshold */
  function isBg(px, i) {
    return px[i + 3] > 0 && px[i] > TH && px[i + 1] > TH && px[i + 2] > TH;
  }
  function floodFrame(px, sheetW, x0, y0, fw, fh) {
    var visited = new Uint8Array(fw * fh);
    var stack = [];
    function seed(lx, ly) {
      if (lx < 0 || ly < 0 || lx >= fw || ly >= fh) return;
      var vi = ly * fw + lx;
      if (visited[vi]) return;
      var i = ((y0 + ly) * sheetW + (x0 + lx)) * 4;
      if (!isBg(px, i)) return;
      visited[vi] = 1; stack.push(lx, ly);
    }
    for (var lx = 0; lx < fw; lx++) { seed(lx, 0); seed(lx, fh - 1); }
    for (var ly = 0; ly < fh; ly++) { seed(0, ly); seed(fw - 1, ly); }
    while (stack.length) {
      var yy = stack.pop(), xx = stack.pop();
      var i = ((y0 + yy) * sheetW + (x0 + xx)) * 4;
      px[i + 3] = 0;
      tryPush(px, sheetW, x0, y0, fw, fh, visited, stack, xx + 1, yy);
      tryPush(px, sheetW, x0, y0, fw, fh, visited, stack, xx - 1, yy);
      tryPush(px, sheetW, x0, y0, fw, fh, visited, stack, xx, yy + 1);
      tryPush(px, sheetW, x0, y0, fw, fh, visited, stack, xx, yy - 1);
    }
  }
  function tryPush(px, sheetW, x0, y0, fw, fh, visited, stack, lx, ly) {
    if (lx < 0 || ly < 0 || lx >= fw || ly >= fh) return;
    var vi = ly * fw + lx;
    if (visited[vi]) return;
    var i = ((y0 + ly) * sheetW + (x0 + lx)) * 4;
    if (!isBg(px, i)) return;
    visited[vi] = 1; stack.push(lx, ly);
  }

  /* =========================================================
     Avatar — one DOM node (canvas + shadow + nametag + bubble).
     ========================================================= */
  var WALK_SPEED = 0.07; /* px per ms */

  function Avatar(stage, def) {
    this.stage = stage;
    this.def = def;
    this.handle = def.handle;
    this.sheetId = def.sheet;
    this.sheet = null;             /* loaded lazily, see ensureSheet() */
    this.scale = def.scale || 1;
    this.baseFacing = def.flip ? -1 : 1;
    this.facing = this.baseFacing;
    this.baseAction = def.action || "idle";
    this.anim = this.baseAction;
    this.frame = (Math.random() * COLS) | 0;
    this.acc = Math.random() * 220;
    this.phase = Math.random() * 6.28;
    this.y = 0;
    this.handRaised = false;
    this.walking = false;
    this.targetX = 0;
    this.lines = def.lines || [];
    this.li = 0;
    this.revertT = 0;
    this.bubT = 0;

    var tag = def.pet || def.interactive === false ? "div" : "button";
    var el = document.createElement(tag);
    el.className = "av" + (def.opt ? " opt" : "") + (def.pet ? " pet" : "");
    if (tag === "button") {
      el.type = "button";
      el.setAttribute("aria-label", def.handle + ", tap to react");
    }
    var shadow = document.createElement("span"); shadow.className = "shadow";
    var cv = document.createElement("canvas"); cv.className = "spr"; cv.width = FRAME; cv.height = FRAME;
    var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = def.handle;
    var bub = document.createElement("span"); bub.className = "bub";
    el.appendChild(shadow); el.appendChild(cv); el.appendChild(nm); el.appendChild(bub);
    stage.crowd.appendChild(el);

    this.el = el; this.cv = cv; this.ctx = cv.getContext("2d"); this.nmEl = nm; this.bubEl = bub;
    this.ctx.imageSmoothingEnabled = false;

    var self = this;
    if (tag === "button" || def.pet) {
      el.addEventListener("click", function () {
        if (def.pet) { self.playPose("cheer"); self.emote("\uD83D\uDC36"); return; }
        self.say(self.nextLine(), 2400);
        self.playPose("cheer");
      });
    }
  }

  Avatar.prototype.ensureSheet = function () {
    if (!this.sheet) { this.sheet = loadSheet(this.sheetId); }
  };

  Avatar.prototype.nextLine = function () {
    if (!this.lines.length) return AMBIENT_LINES[(Math.random() * AMBIENT_LINES.length) | 0];
    var l = this.lines[this.li % this.lines.length]; this.li++; return l;
  };

  Avatar.prototype.applyLayout = function (x, bottom, disp, z) {
    this.x = x; this.bottomPx = bottom; this.disp = disp;
    this.el.style.left = Math.round(x) + "px";
    this.el.style.bottom = Math.round(bottom) + "px";
    this.el.style.zIndex = String(z);
    this.cv.style.width = disp + "px";
    this.cv.style.height = disp + "px";
    this.render();
  };

  Avatar.prototype.resolvePose = function () {
    if (POSES[this.anim]) return this.anim;
    var a = ALIASES[this.anim];
    return a && POSES[a] ? a : "idle";
  };

  Avatar.prototype.setPose = function (name, holdMs) {
    if (this.anim !== name) { this.anim = name; this.frame = 0; this.acc = 0; }
    clearTimeout(this.revertT);
    if (holdMs) {
      var self = this;
      this.revertT = setTimeout(function () { self.revert(); }, holdMs);
    }
    if (reduce) this.render();
  };

  Avatar.prototype.revert = function () {
    this.anim = this.handRaised ? "handUp" : this.baseAction;
    this.frame = reduce ? 0 : this.frame;
    if (reduce) this.render();
  };

  Avatar.prototype.playPose = function (kind) {
    if (kind === "jump") { this.jumpArc(); return; }
    var hold = kind === "cheer" ? 1500 : kind === "wave" ? 1700 : kind === "clap" ? 1600 : 1500;
    if (reduce) { this.anim = kind; this.frame = 3; this.render(); var s = this; clearTimeout(this.revertT); this.revertT = setTimeout(function () { s.revert(); }, hold); return; }
    this.setPose(kind, hold);
  };

  Avatar.prototype.jumpArc = function () {
    if (reduce) { this.playPose("cheer"); return; }
    var self = this, start = performance.now(), dur = 600, h = 38;
    this.setPose("cheer");
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      self.y = h * 4 * t * (1 - t);
      if (t >= 1) { self.y = 0; self.revert(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  Avatar.prototype.setHand = function (raised) {
    this.handRaised = !!raised;
    this.setPose(this.handRaised ? "handUp" : this.baseAction);
    if (reduce) this.render();
  };

  Avatar.prototype.wander = function () {
    if (reduce) { this.playPose("wave"); return; }
    var b = this.stage.bounds();
    this.targetX = b.left + Math.random() * (b.right - b.left);
    this.walking = true;
    this.facing = this.targetX > this.x ? 1 : -1;
    this.setPose("walk");
  };

  Avatar.prototype.emote = function (symbol) {
    var e = document.createElement("span");
    e.className = "emote"; e.textContent = symbol;
    this.el.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, reduce ? 1100 : 1350);
  };

  Avatar.prototype.say = function (text, ms) {
    if (!text) return;
    this.bubEl.textContent = text;
    this.el.classList.add("say");
    clearTimeout(this.bubT);
    var self = this;
    this.bubT = setTimeout(function () { self.el.classList.remove("say"); }, ms || 3000);
  };

  Avatar.prototype.tick = function (dt, now) {
    if (this.freeze) { this.frame = this.freezeFrame || 0; this.bob = 0; this.render(); return; }
    if (this.walking) {
      var dir = this.targetX > this.x ? 1 : -1;
      this.x += dir * WALK_SPEED * dt;
      this.facing = dir;
      if (Math.abs(this.x - this.targetX) < 3) { this.walking = false; this.revert(); }
      this.el.style.left = Math.round(this.x) + "px";
    }
    var pose = POSES[this.resolvePose()] || POSES.idle;
    this.acc += dt;
    var fd = 1000 / pose.fps;
    while (this.acc >= fd) { this.acc -= fd; this.frame = (this.frame + 1) % COLS; }
    this.bob = (this.anim === "idle" && !this.walking) ? Math.sin(now / 600 + this.phase) * 1.8 : 0;
    this.render();
  };

  Avatar.prototype.render = function () {
    if (!this.sheet || !this.sheet.ready || !this.sheet.canvas) return;
    var pose = POSES[this.resolvePose()] || POSES.idle;
    var sx = this.frame * FRAME, sy = pose.row * FRAME;
    var ctx = this.ctx;
    ctx.clearRect(0, 0, FRAME, FRAME);
    ctx.save();
    if (this.facing === -1) { ctx.translate(FRAME, 0); ctx.scale(-1, 1); }
    try { ctx.drawImage(this.sheet.canvas, sx, sy, FRAME, FRAME, 0, 0, FRAME, FRAME); } catch (e) {}
    ctx.restore();
    var lift = (this.y || 0) + (this.bob || 0);
    this.cv.style.transform = "translateY(" + (-lift).toFixed(2) + "px)";
  };

  /* =========================================================
     Stage — builds the crowd, lays it out, runs scenes.
     ========================================================= */
  function Stage(root) {
    this.root = root;                                   /* .room */
    this.frame = root.querySelector(".room-frame");
    this.crowd = root.querySelector(".room-crowd");
    this.panel = root.querySelector(".room-panel");
    this.avatars = [];
    this.pet = null;
    this.active = false;
    this.live = false;
    this.ambientT = 0;
    this.ambientPtr = 0;

    var self = this;
    ROSTER.forEach(function (d) { self.avatars.push(new Avatar(self, d)); });
    this.pet = new Avatar(this, PET);

    /* stable depth jitter per avatar (0 = front .. 1 = back) */
    this.avatars.concat([this.pet]).forEach(function (a, i) { a.depth = ((i * 0.61803) % 1); });

    this.layout();
    var ro;
    window.addEventListener("resize", function () { clearTimeout(ro); ro = setTimeout(function () { self.layout(); }, 150); });
  }

  Stage.prototype.loadSheets = function () {
    if (this._sheetsRequested) return;
    this._sheetsRequested = true;
    this.avatars.forEach(function (a) { a.ensureSheet(); });
    if (this.pet) this.pet.ensureSheet();
  };

  Stage.prototype.dims = function () {
    var r = this.frame.getBoundingClientRect();
    return { w: r.width || 760, h: r.height || 360 };
  };

  Stage.prototype.bounds = function () {
    var d = this.dims();
    var margin = d.w * 0.08;
    return { left: margin, right: d.w - margin };
  };

  Stage.prototype.visibleHumans = function () {
    return this.avatars.filter(function (a) { return a.el.offsetParent !== null; });
  };

  Stage.prototype.layout = function () {
    var d = this.dims();
    var disp = Math.max(74, Math.min(116, Math.round(d.h * 0.30)));
    var jitter = Math.min(26, d.h * 0.07);
    var vis = this.visibleHumans();
    var n = vis.length;
    var left = d.w * 0.06, right = d.w * 0.82;   /* leave the far right for the dog */
    vis.forEach(function (a, i) {
      var frac = n <= 1 ? 0.45 : i / (n - 1);
      var x = left + frac * (right - left);
      var bottom = d.h * 0.05 + a.depth * jitter;
      var z = 100 - Math.round(a.depth * 40);
      a.applyLayout(x, bottom, disp, z);
    });
    if (this.pet) {
      var pdisp = Math.round(disp * (PET.scale || 0.82));
      this.pet.applyLayout(d.w * 0.93, d.h * 0.045, pdisp, 105);
    }
  };

  /* ----- crowd-wide helpers ----- */
  Stage.prototype.everyone = function (fn) { this.visibleHumans().forEach(fn); };
  Stage.prototype.some = function (ratio, fn) {
    this.visibleHumans().forEach(function (a) { if (Math.random() < ratio) fn(a); });
  };
  Stage.prototype.randomOne = function () {
    var v = this.visibleHumans();
    return v.length ? v[(Math.random() * v.length) | 0] : null;
  };

  /* ----- control actions (called by the panel + taps) ----- */
  Stage.prototype.action = function (kind) {
    if (!this.live) this.reveal();
    var self = this;
    switch (kind) {
      case "cheer": this.everyone(function (a) { a.playPose("cheer"); }); break;
      case "clap":  this.everyone(function (a) { a.playPose("clap"); }); break;
      case "wave":  this.everyone(function (a) { a.playPose("wave"); }); break;
      case "hand":
        this.everyone(function (a) { a.setHand(true); });
        clearTimeout(this._handT);
        this._handT = setTimeout(function () { self.everyone(function (a) { a.setHand(false); }); }, 3400);
        break;
      case "love":  this.some(0.7, function (a) { a.emote("\u2764\uFE0F"); }); this.some(0.4, function (a) { a.playPose("cheer"); }); break;
      case "laugh": this.some(0.75, function (a) { a.emote("\uD83D\uDE02"); }); break;
      case "hype":  this.everyone(function (a) { a.emote("\uD83C\uDF89"); }); this.some(0.5, function (a) { a.playPose("cheer"); }); break;
      case "say":   var a = this.randomOne(); if (a) { a.say(a.nextLine(), 2800); a.playPose("wave"); } break;
      case "wander": var picked = 0; this.everyone(function (av) { if (picked < 3 && Math.random() < 0.5) { av.wander(); picked++; } }); break;
      case "summon": this.summon(); break;
      case "reset": this.reset(); break;
    }
  };

  Stage.prototype.summon = function () {
    if (this.pet) { this.pet.playPose("cheer"); this.pet.emote("\uD83D\uDC36"); }
    this.some(0.5, function (a) { a.emote("\u2764\uFE0F"); a.playPose("wave"); });
  };

  Stage.prototype.reset = function () {
    clearTimeout(this._handT);
    this.everyone(function (a) {
      a.handRaised = false; a.walking = false;
      a.anim = a.baseAction; a.frame = 0; a.el.classList.remove("say");
      clearTimeout(a.revertT); clearTimeout(a.bubT);
      a.render();
    });
  };

  /* ----- reveal: dead room -> living meadow, in scripted beats ----- */
  Stage.prototype.reveal = function (instant) {
    if (this.live) return;
    this.loadSheets();
    this.live = true;
    this.frame.classList.add("live");
    this.active = true;
    ensureTicker();
    var self = this;
    if (reduce || instant) {
      /* frozen, interactive tableau: representative frame + two bubbles */
      this.avatars.forEach(function (a) { a.frame = a.baseAction === "idle" ? 0 : 3; a.render(); });
      var v = this.visibleHumans();
      if (v[1]) v[1].say(v[1].nextLine(), 600000);
      if (v[Math.min(4, v.length - 1)]) v[Math.min(4, v.length - 1)].say("we're all here", 600000);
      return;
    }
    /* narrative beat: the room wakes up */
    setTimeout(function () { self.some(0.5, function (a) { a.playPose("wave"); }); }, 250);
    setTimeout(function () { self.everyone(function (a) { a.playPose("cheer"); }); self.some(0.6, function (a) { a.emote("\uD83C\uDF89"); }); }, 950);
    setTimeout(function () { self.startAmbient(); }, 1900);
  };

  Stage.prototype.startAmbient = function () {
    var self = this;
    clearTimeout(this.ambientT);
    function nextBubble() {
      if (self.active && self.live && !reduce) {
        var v = self.visibleHumans();
        if (v.length) {
          var a = v[self.ambientPtr % v.length];
          self.ambientPtr++;
          a.say(a.nextLine(), 3000);
        }
      }
      self.ambientT = setTimeout(nextBubble, 1850);
    }
    this.ambientT = setTimeout(nextBubble, 600);
  };

  Stage.prototype.tick = function (dt, now) {
    for (var i = 0; i < this.avatars.length; i++) this.avatars[i].tick(dt, now);
    if (this.pet) this.pet.tick(dt, now);
  };
  Stage.prototype.repaint = function () {
    for (var i = 0; i < this.avatars.length; i++) this.avatars[i].render();
    if (this.pet) this.pet.render();
  };

  /* =========================================================
     Demo — a standalone, looping single-avatar feature card.
     Reuses Avatar + the shared ticker; lives in its own .fdemo box.
     ========================================================= */
  function Demo(el) {
    this.el = el;
    this.active = false;
    this._started = false;
    this.pose = el.getAttribute("data-pose") || "idle";
    this.behavior = el.getAttribute("data-behavior") || "";   /* '', say, emote, walk, hold */
    this.emoteSym = el.getAttribute("data-emote") || "\u2764\uFE0F";
    this.line = el.getAttribute("data-line") || "";
    var isPet = el.hasAttribute("data-pet");
    this.host = {
      crowd: el,
      dims: function () { return { w: el.clientWidth || 180, h: el.clientHeight || 170 }; },
      bounds: function () { var w = el.clientWidth || 180; return { left: w * 0.24, right: w * 0.76 }; }
    };
    this.av = new Avatar(this.host, {
      sheet: el.getAttribute("data-sheet") || "rae",
      handle: "", action: this.pose, interactive: false,
      flip: el.hasAttribute("data-flip"), pet: isPet,
      scale: parseFloat(el.getAttribute("data-scale")) || 1
    });
    this.av.depth = 0;
    if (this.behavior === "hold") { this.av.freeze = true; this.av.freezeFrame = 3; this.av.anim = this.pose; }
    this.beatT = 0;
    this.layout();
    var self = this;
    window.addEventListener("resize", function () { clearTimeout(self._ro); self._ro = setTimeout(function () { self.layout(); }, 150); });
  }
  Demo.prototype.layout = function () {
    var h = this.el.clientHeight || 170, w = this.el.clientWidth || 180;
    var disp = Math.max(72, Math.min(124, Math.round(h * 0.66)));
    if (this.av.def.pet) disp = Math.round(disp * 0.9);
    this.av.applyLayout(w / 2, Math.round(h * 0.05), disp, 10);
  };
  Demo.prototype.start = function () {
    this.av.ensureSheet();
    if (this._started) return;
    this._started = true;
    if (reduce) {
      this.av.frame = this.behavior === "hold" ? (this.av.freezeFrame || 3) : (this.pose === "idle" ? 0 : 3);
      this.av.render();
      if (this.behavior === "say" && this.line) this.av.say(this.line, 600000);
      else if (this.behavior === "emote") this.av.emote(this.emoteSym);
      return;
    }
    this.scheduleBeat();
  };
  Demo.prototype.scheduleBeat = function () {
    var self = this;
    clearTimeout(this.beatT);
    function run() {
      if (self.active && !reduce) {
        if (self.behavior === "say" && self.line) self.av.say(self.line, 2600);
        else if (self.behavior === "emote") self.av.emote(self.emoteSym);
        else if (self.behavior === "walk" && !self.av.walking) self.av.wander();
      }
      self.beatT = setTimeout(run, self.behavior === "emote" ? 1500 : self.behavior === "walk" ? 400 : 2900);
    }
    this.beatT = setTimeout(run, 500);
  };
  Demo.prototype.tick = function (dt, now) { this.av.tick(dt, now); };
  Demo.prototype.repaint = function () { this.av.render(); };

  /* =========================================================
     Global ticker — one rAF loop drives every active tickable
     (the room stage and each feature demo).
     ========================================================= */
  var tickables = [];
  var rafId = 0, lastT = 0;
  function tickAll(now) {
    var dt = lastT ? Math.min(64, now - lastT) : 16;
    lastT = now;
    for (var i = 0; i < tickables.length; i++) if (tickables[i].active) tickables[i].tick(dt, now);
    rafId = requestAnimationFrame(tickAll);
  }
  function ensureTicker() {
    if (reduce) return;
    if (!rafId) { lastT = 0; rafId = requestAnimationFrame(tickAll); }
  }
  function pauseTicker() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  function repaintAll() {
    for (var i = 0; i < tickables.length; i++) { if (tickables[i].repaint) tickables[i].repaint(); }
  }

  /* =========================================================
     Boot.
     ========================================================= */
  function boot() {
    buildFeatureDemos();
    var root = document.getElementById("room");
    if (!root) return;
    var frameEl = root.querySelector(".room-frame");
    var stage = new Stage(root);
    tickables.push(stage);
    if (frameEl) frameEl.classList.add("is-ready");

    /* wire the controls */
    var panel = root.querySelector(".room-panel");
    if (panel) {
      panel.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("[data-room]") : null;
        if (!btn) return;
        stage.action(btn.getAttribute("data-room"));
      });
    }

    /* reveal button */
    var revive = document.getElementById("reviveBtn");
    if (revive) revive.addEventListener("click", function () { stage.reveal(); });

    /* build the dead-room tiles */
    buildZoomTiles();

    if (reduce) {
      /* skip the dead-room drama; show the living meadow directly */
      stage.reveal(true);
    } else {
      /* lazy-load sheets on first view; pause/resume with viewport + tab */
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) stage.loadSheets();   /* warm up before reveal */
            stage.active = en.isIntersecting && stage.live;
            if (stage.active) ensureTicker();
          });
        }, { threshold: 0.05 }).observe(frameEl);
      } else {
        stage.loadSheets();
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { stage.active = false; }
        else if (stage.live) { stage.active = true; ensureTicker(); }
      });
    }
  }

  function buildFeatureDemos() {
    var els = document.querySelectorAll(".fdemo");
    if (!els.length) return;
    var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var demo = en.target.__demo;
        if (!demo) return;
        if (en.isIntersecting) demo.start();
        demo.active = en.isIntersecting && !reduce;
        if (demo.active) ensureTicker();
      });
    }, { threshold: 0.25 }) : null;
    Array.prototype.forEach.call(els, function (el) {
      var demo = new Demo(el);
      el.__demo = demo;
      tickables.push(demo);
      if (io) io.observe(el);
      else { demo.start(); demo.active = !reduce; ensureTicker(); }
    });
  }

  function buildZoomTiles() {
    var wrap = document.getElementById("zoomTiles");
    if (!wrap) return;
    var initials = ["RG", "KM", "NO", "IV", "AL", "SG", "MX", "FX", "LO", "WR", "AR", "FL"];
    for (var i = 0; i < initials.length; i++) {
      var t = document.createElement("div");
      t.className = "zoom-tile";
      var s = document.createElement("span");
      s.textContent = initials[i];
      t.appendChild(s);
      wrap.appendChild(t);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
