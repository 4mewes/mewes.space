(function () {
  "use strict";

  if (window.__PIGEON_WEBRING_LOADED__) return;
  window.__PIGEON_WEBRING_LOADED__ = true;

  var existingApi = window.PigeonWebring || {};
  var existingConfig = existingApi.config || window.PigeonWebringConfig || {};
  var currentScript = document.currentScript;
  var scriptUrl = currentScript && currentScript.src ? currentScript.src : "";
  var baseUrl = scriptUrl ? new URL(".", scriptUrl).href : new URL(".", window.location.href).href;

  var defaults = {
    cssHref: "pigeon-webring.css",
    sitesScript: "pigeon-sites.js",
    assetBase: "assets/",
    intervalMs: 60000,
    initialDelayMs: 60000,
    durationMs: 15000,
    spawnChance: 1,
    speedPxPerSecond: 58,
    frameMs: 115,
    hoverStopRadius: 64,
    hoverIdleFrameMs: 850,
    hoverIdleSwitchMinMs: 1400,
    hoverIdleSwitchMaxMs: 3000,
    peckChance: 0.28,
    peckMinMs: 900,
    peckMaxMs: 1800,
    peckFrameMs: 130,
    pauseChance: 0.22,
    pauseMinMs: 900,
    pauseMaxMs: 2200,
    pauseFrameMs: 650,
    spriteWidth: 96,
    spriteHeight: 72,
    infoHref: "pigeon-info.html",
    infoIcon: "app-icon-image.png",
    infoLabel: "Web Pigeons",
    infoText: "I am a web pigeon",
    linkPrefix: "",
    linkTarget: "_blank",
    linkRel: "noopener noreferrer",
    frames: [
      "walk1_0003.png",
      "walk1_0007.png",
      "walk1_0008.png",
      "walk1_0009.png",
      "walk1_0010.png"
    ],
    peckFrames: [
      "peck_0001.png",
      "peck_0023.png",
      "peck_0027.png",
      "peck_0032.png",
      "peck_0027.png",
      "peck_0049.png",
      "peck_0027.png",
      "peck_0032.png",
      "peck_0027.png",
      "peck_0023.png",
      "peck_0001.png"
    ],
    pauseFrames: [
      "pause1_0017.png",
      "pause1_0018.png"
    ]
  };

  var NATIVE_FACING = {
    walking: -1,
    pausing: -1,
    pecking: 1
  };

  var config = assign(assign({}, defaults), existingConfig);
  var state = {
    activePigeon: null,
    frameUrls: [],
    peckFrameUrls: [],
    pauseFrameUrls: [],
    initialized: false,
    pointer: {
      active: false,
      x: 0,
      y: 0
    },
    pointerTrackingInstalled: false,
    sites: [],
    timerId: null,
    running: false
  };

  var api = assign(existingApi, {
    version: "0.1.0",
    config: config,
    sites: state.sites,
    start: start,
    stop: stop,
    spawn: spawn,
    destroy: stop
  });

  window.PigeonWebring = api;

  function assign(target) {
    for (var i = 1; i < arguments.length; i += 1) {
      var source = arguments[i] || {};
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  }

  function resolveUrl(path) {
    if (/^(https?:)?\/\//i.test(path) || /^data:/i.test(path)) return path;
    return new URL(path, baseUrl).href;
  }

  function resolveAsset(path) {
    if (/^(https?:)?\/\//i.test(path) || /^data:/i.test(path)) return path;
    var assetBase = resolveUrl(config.assetBase);
    if (!/\/$/.test(assetBase)) assetBase += "/";
    return new URL(path, assetBase).href;
  }

  function onReady(callback) {
    if (document.body) {
      callback();
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      window.setTimeout(callback, 0);
    }
  }

  function loadStylesheet() {
    var href = resolveUrl(config.cssHref);
    var existing = document.querySelector('link[data-pigeon-webring-css="true"]');
    if (existing) return;

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.type = "text/css";
    link.media = "all";
    link.setAttribute("data-pigeon-webring-css", "true");
    document.head.appendChild(link);
  }

  function loadSites(callback) {
    if (Array.isArray(config.sites)) {
      callback(config.sites);
      return;
    }

    if (Array.isArray(window.PigeonWebringSites)) {
      callback(window.PigeonWebringSites);
      return;
    }

    var script = document.createElement("script");
    script.src = resolveUrl(config.sitesScript);
    script.async = true;
    script.onload = function () {
      callback(Array.isArray(window.PigeonWebringSites) ? window.PigeonWebringSites : []);
    };
    script.onerror = function () {
      callback([]);
    };
    document.head.appendChild(script);
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    loadStylesheet();
    createInfoLink();
    installPointerTracking();
    state.frameUrls = config.frames.map(resolveAsset);
    state.peckFrameUrls = config.peckFrames.map(resolveAsset);
    state.pauseFrameUrls = config.pauseFrames.map(resolveAsset);
    preloadFrames(state.frameUrls.concat(state.peckFrameUrls).concat(state.pauseFrameUrls));

    loadSites(function (sites) {
      state.sites = normalizeSites(sites);
      api.sites = state.sites;
      start();
    });
  }

  function preloadFrames(frameUrls) {
    frameUrls.forEach(function (src) {
      var img = new Image();
      img.src = src;
    });
  }

  function installPointerTracking() {
    if (state.pointerTrackingInstalled) return;
    state.pointerTrackingInstalled = true;

    var moveEvent = "PointerEvent" in window ? "pointermove" : "mousemove";
    window.addEventListener(moveEvent, function (event) {
      state.pointer.active = true;
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
    }, { passive: true });

    window.addEventListener("blur", function () {
      state.pointer.active = false;
    });

    document.addEventListener("mouseleave", function () {
      state.pointer.active = false;
    });
  }

  function createInfoLink() {
    if (document.querySelector('[data-pigeon-webring-info="true"]')) return;

    var menu = document.createElement("div");
    var text = document.createElement("span");
    var link = document.createElement("a");
    var icon = document.createElement("img");

    menu.className = "pigeon-webring-info";
    menu.setAttribute("data-pigeon-webring-info", "true");

    text.className = "pigeon-webring-info__text";
    text.textContent = config.infoText;

    link.className = "pigeon-webring-info__button";
    link.href = resolveUrl(config.infoHref);
    link.target = "_self";
    link.setAttribute("aria-label", config.infoLabel);
    link.setAttribute("title", config.infoLabel);

    icon.className = "pigeon-webring-info__icon";
    icon.src = resolveAsset(config.infoIcon);
    icon.alt = "";
    icon.decoding = "async";
    icon.draggable = false;

    link.appendChild(icon);
    if (config.infoText) {
      menu.appendChild(text);
    }
    menu.appendChild(link);
    document.body.appendChild(menu);
  }

  function normalizeSites(sites) {
    return sites
      .map(function (site) {
        if (typeof site === "string") {
          return siteToEntry(site, site);
        }

        if (site && typeof site.url === "string") {
          return siteToEntry(site.url, site.label || site.name || site.url);
        }

        return null;
      })
      .filter(Boolean);
  }

  function siteToEntry(url, label) {
    var normalized = normalizeUrl(url);
    if (!normalized) return null;

    return {
      url: normalized.href,
      hostname: normalized.hostname,
      normalizedHostname: normalizeHostname(normalized.hostname),
      label: cleanLabel(label, normalized.hostname)
    };
  }

  function normalizeUrl(value) {
    var trimmed = String(value || "").trim();
    if (!trimmed) return null;

    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      trimmed = "https://" + trimmed;
    }

    try {
      return new URL(trimmed);
    } catch (error) {
      return null;
    }
  }

  function normalizeHostname(hostname) {
    return String(hostname || "")
      .toLowerCase()
      .replace(/^www\./, "");
  }

  function cleanLabel(label, fallbackHostname) {
    var text = String(label || "").trim();
    if (!text) text = fallbackHostname;
    return text.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  }

  function getRandomTarget() {
    var currentHost = normalizeHostname(window.location.hostname);
    var candidates = state.sites.filter(function (site) {
      return site.normalizedHostname !== currentHost;
    });

    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function start() {
    if (state.running) return;
    state.running = true;
    scheduleNext(config.initialDelayMs);
  }

  function stop() {
    state.running = false;
    if (state.timerId) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    if (state.activePigeon) {
      state.activePigeon.destroy();
      state.activePigeon = null;
    }
  }

  function scheduleNext(delayMs) {
    if (!state.running) return;

    if (state.timerId) {
      window.clearTimeout(state.timerId);
    }

    state.timerId = window.setTimeout(function () {
      maybeSpawn();
      scheduleNext(config.intervalMs);
    }, Math.max(0, delayMs));
  }

  function maybeSpawn() {
    if (!state.running || state.activePigeon) return;
    if (document.hidden) return;
    if (Math.random() > config.spawnChance) return;

    spawn();
  }

  function spawn() {
    if (state.activePigeon) return state.activePigeon;

    var target = getRandomTarget();
    if (!target || !state.frameUrls.length) return null;

    state.activePigeon = new PigeonWebringPigeon(target, function () {
      state.activePigeon = null;
    });
    return state.activePigeon;
  }

  function PigeonWebringPigeon(target, onDestroy) {
    this.target = target;
    this.onDestroy = onDestroy;
    this.el = null;
    this.birdEl = null;
    this.img = null;
    this.frameIndex = 0;
    this.lastFrameAt = 0;
    this.lastTickAt = 0;
    this.startedAt = 0;
    this.leaving = false;
    this.mode = "walking";
    this.rafId = 0;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.nextDecisionAt = 0;
    this.peckUntilAt = 0;
    this.pauseUntilAt = 0;
    this.hoverStoppedAt = 0;
    this.hoverFrameIndex = 0;
    this.hoverFrameUrls = null;
    this.hoverIdleKind = "";
    this.hoverLastFrameAt = 0;
    this.hoverIdleSwitchAt = 0;
    this.visualFacingDir = 1;
    this.hoverFacingDir = 1;
    this.destroyed = false;

    this.createDom();
    this.pickStart();
    this.tick = this.tick.bind(this);
    this.startedAt = performance.now();
    this.lastTickAt = this.startedAt;
    this.lastFrameAt = this.startedAt;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  PigeonWebringPigeon.prototype.createDom = function () {
    var el = document.createElement("div");
    var bird = document.createElement("div");
    var link = document.createElement("a");
    var spriteLink = document.createElement("a");
    var img = document.createElement("img");

    el.className = "pigeon-webring";
    el.style.setProperty("--pigeon-webring-sprite-width", config.spriteWidth + "px");
    el.style.setProperty("--pigeon-webring-sprite-height", config.spriteHeight + "px");
    el.style.setProperty("--pigeon-webring-fly-drift", (Math.random() < 0.5 ? -90 : 90) + "px");

    bird.className = "pigeon-webring__bird";

    link.className = "pigeon-webring__link";
    link.href = this.target.url;
    link.target = config.linkTarget;
    link.rel = config.linkRel;
    link.textContent = config.linkPrefix ? config.linkPrefix + " " + this.target.label : this.target.label;

    spriteLink.className = "pigeon-webring__sprite-link";
    spriteLink.href = this.target.url;
    spriteLink.target = config.linkTarget;
    spriteLink.rel = config.linkRel;
    spriteLink.setAttribute("aria-label", this.target.label);

    img.className = "pigeon-webring__sprite";
    img.src = state.frameUrls[0];
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;

    bird.appendChild(link);
    spriteLink.appendChild(img);
    bird.appendChild(spriteLink);
    el.appendChild(bird);
    document.body.appendChild(el);

    this.el = el;
    this.birdEl = bird;
    this.img = img;
  };

  PigeonWebringPigeon.prototype.pickStart = function () {
    var rect = this.getRect();
    var maxX = Math.max(0, window.innerWidth - rect.width - 12);
    var maxY = Math.max(0, window.innerHeight - rect.height - 12);
    var side = Math.floor(Math.random() * 3);

    if (side === 0) {
      this.x = 12;
      this.y = randomBetween(window.innerHeight * 0.35, maxY);
      this.pickDirection("right");
    } else if (side === 1) {
      this.x = maxX;
      this.y = randomBetween(window.innerHeight * 0.35, maxY);
      this.pickDirection("left");
    } else {
      this.x = randomBetween(12, maxX);
      this.y = maxY;
      this.pickDirection();
    }

    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.pickDirection = function (bias) {
    var angle;
    if (bias === "right") {
      angle = (Math.random() - 0.5) * Math.PI;
    } else if (bias === "left") {
      angle = Math.PI + (Math.random() - 0.5) * Math.PI;
    } else {
      angle = Math.random() * Math.PI * 2;
    }

    this.vx = Math.cos(angle);
    this.vy = Math.sin(angle) * 0.55;
    this.syncFacingWithVelocity();
    this.nextDecisionAt = performance.now() + randomBetween(1200, 2800);
  };

  PigeonWebringPigeon.prototype.syncFacingWithVelocity = function () {
    if (Math.abs(this.vx) < 0.001) return;
    this.visualFacingDir = this.vx >= 0 ? 1 : -1;
  };

  PigeonWebringPigeon.prototype.getRect = function () {
    var rect = this.el.getBoundingClientRect();
    return {
      width: rect.width || config.spriteWidth,
      height: rect.height || config.spriteHeight + 32
    };
  };

  PigeonWebringPigeon.prototype.tick = function (now) {
    var dt = Math.min(64, now - this.lastTickAt) / 1000;
    this.lastTickAt = now;

    if (!this.leaving && this.isPointerClose()) {
      if (!this.hoverStoppedAt) {
        this.beginHoverIdle(now);
      }
      this.updateHoverIdle(now);
      this.rafId = window.requestAnimationFrame(this.tick);
      return;
    }

    if (this.hoverStoppedAt) {
      this.resumeAfterHoverStop(now);
    }

    if (!this.leaving && now - this.startedAt >= config.durationMs) {
      this.beginLeaving();
    }

    if (!this.leaving && this.mode === "pecking") {
      this.updatePeck(now);
      this.rafId = window.requestAnimationFrame(this.tick);
    } else if (!this.leaving && this.mode === "pausing") {
      this.updatePause(now);
      this.rafId = window.requestAnimationFrame(this.tick);
    } else if (!this.leaving) {
      this.updateWalk(now, dt);
      this.rafId = window.requestAnimationFrame(this.tick);
    }
  };

  PigeonWebringPigeon.prototype.isPointerClose = function () {
    if (!state.pointer.active || !this.el) return false;

    var rect = this.el.getBoundingClientRect();
    var closestX = Math.max(rect.left, Math.min(state.pointer.x, rect.right));
    var closestY = Math.max(rect.top, Math.min(state.pointer.y, rect.bottom));
    var dx = state.pointer.x - closestX;
    var dy = state.pointer.y - closestY;

    return Math.sqrt(dx * dx + dy * dy) <= config.hoverStopRadius;
  };

  PigeonWebringPigeon.prototype.resumeAfterHoverStop = function (now) {
    var stoppedMs = now - this.hoverStoppedAt;

    this.startedAt += stoppedMs;
    this.nextDecisionAt += stoppedMs;
    if (this.peckUntilAt) this.peckUntilAt += stoppedMs;
    if (this.pauseUntilAt) this.pauseUntilAt += stoppedMs;
    this.lastFrameAt = now;
    this.hoverStoppedAt = 0;
    this.hoverFrameIndex = 0;
    this.hoverFrameUrls = null;
    this.hoverIdleKind = "";
    this.hoverLastFrameAt = 0;
    this.hoverIdleSwitchAt = 0;
    this.restoreCurrentSprite();
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.beginHoverIdle = function (now) {
    this.hoverStoppedAt = now;
    this.hoverFacingDir = this.visualFacingDir;
    this.pickHoverIdle(now);
  };

  PigeonWebringPigeon.prototype.pickHoverIdle = function (now) {
    var options = [];

    if (state.pauseFrameUrls.length) options.push({ kind: "pausing", frames: state.pauseFrameUrls });
    if (!options.length) options.push({ kind: "walking", frames: state.frameUrls });

    var picked = options[Math.floor(Math.random() * options.length)];
    this.hoverIdleKind = picked.kind;
    this.hoverFrameUrls = picked.frames;
    this.hoverFrameIndex = 0;
    this.hoverLastFrameAt = now;
    this.hoverIdleSwitchAt = now + randomBetween(config.hoverIdleSwitchMinMs, config.hoverIdleSwitchMaxMs);
    this.img.src = this.hoverFrameUrls[0];
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.updateHoverIdle = function (now) {
    if (!this.hoverFrameUrls || now >= this.hoverIdleSwitchAt) {
      this.pickHoverIdle(now);
      return;
    }

    if (now - this.hoverLastFrameAt >= config.hoverIdleFrameMs) {
      this.hoverLastFrameAt = now;
      this.hoverFrameIndex = (this.hoverFrameIndex + 1) % this.hoverFrameUrls.length;
      this.img.src = this.hoverFrameUrls[this.hoverFrameIndex];
    }
  };

  PigeonWebringPigeon.prototype.restoreCurrentSprite = function () {
    if (this.mode === "pecking" && state.peckFrameUrls.length) {
      this.img.src = state.peckFrameUrls[this.frameIndex % state.peckFrameUrls.length];
      return;
    }

    if (this.mode === "pausing" && state.pauseFrameUrls.length) {
      this.img.src = state.pauseFrameUrls[this.frameIndex % state.pauseFrameUrls.length];
      return;
    }

    this.img.src = state.frameUrls[this.frameIndex % state.frameUrls.length];
  };

  PigeonWebringPigeon.prototype.updateWalk = function (now, dt) {
    if (now >= this.nextDecisionAt) {
      var roll = Math.random();

      if (state.peckFrameUrls.length && roll < config.peckChance) {
        this.beginPeck(now);
        return;
      }

      if (state.pauseFrameUrls.length && roll < config.peckChance + config.pauseChance) {
        this.beginPause(now);
        return;
      }

      this.pickDirection();
    }

    this.x += this.vx * config.speedPxPerSecond * dt;
    this.y += this.vy * config.speedPxPerSecond * dt;
    this.handleBounds();

    if (now - this.lastFrameAt >= config.frameMs) {
      this.lastFrameAt = now;
      this.frameIndex = (this.frameIndex + 1) % state.frameUrls.length;
      this.img.src = state.frameUrls[this.frameIndex];
    }

    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.beginPeck = function (now) {
    this.mode = "pecking";
    this.peckUntilAt = now + randomBetween(config.peckMinMs, config.peckMaxMs);
    this.frameIndex = 0;
    this.lastFrameAt = now;
    this.img.src = state.peckFrameUrls[0];
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.updatePeck = function (now) {
    if (now >= this.peckUntilAt) {
      this.resumeWalking(now);
      return;
    }

    if (now - this.lastFrameAt >= config.peckFrameMs) {
      this.lastFrameAt = now;
      this.frameIndex = (this.frameIndex + 1) % state.peckFrameUrls.length;
      this.img.src = state.peckFrameUrls[this.frameIndex];
    }
  };

  PigeonWebringPigeon.prototype.beginPause = function (now) {
    this.mode = "pausing";
    this.pauseUntilAt = now + randomBetween(config.pauseMinMs, config.pauseMaxMs);
    this.frameIndex = 0;
    this.lastFrameAt = now;
    this.img.src = state.pauseFrameUrls[0];
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.updatePause = function (now) {
    if (now >= this.pauseUntilAt) {
      this.resumeWalking(now);
      return;
    }

    if (now - this.lastFrameAt >= config.pauseFrameMs) {
      this.lastFrameAt = now;
      this.frameIndex = (this.frameIndex + 1) % state.pauseFrameUrls.length;
      this.img.src = state.pauseFrameUrls[this.frameIndex];
    }
  };

  PigeonWebringPigeon.prototype.resumeWalking = function (now) {
    this.mode = "walking";
    this.frameIndex = 0;
    this.lastFrameAt = now;
    this.img.src = state.frameUrls[0];
    this.pickDirection();
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.handleBounds = function () {
    var rect = this.getRect();
    var maxX = Math.max(0, window.innerWidth - rect.width - 12);
    var maxY = Math.max(0, window.innerHeight - rect.height - 12);

    if (this.x < 12) {
      this.x = 12;
      this.vx = Math.abs(this.vx);
      this.syncFacingWithVelocity();
    } else if (this.x > maxX) {
      this.x = maxX;
      this.vx = -Math.abs(this.vx);
      this.syncFacingWithVelocity();
    }

    if (this.y < 12) {
      this.y = 12;
      this.vy = Math.abs(this.vy);
    } else if (this.y > maxY) {
      this.y = maxY;
      this.vy = -Math.abs(this.vy);
    }
  };

  PigeonWebringPigeon.prototype.applyPosition = function () {
    var facingKind = this.hoverStoppedAt ? this.hoverIdleKind : this.mode;
    var desiredFacingDir = this.hoverStoppedAt ? this.hoverFacingDir : this.visualFacingDir;
    var facing = this.getFacingScale(facingKind, desiredFacingDir);

    this.el.style.transform = "translate3d(" + Math.round(this.x) + "px, " + Math.round(this.y) + "px, 0)";
    this.el.style.setProperty("--pigeon-webring-facing", facing);
  };

  PigeonWebringPigeon.prototype.getFacingScale = function (kind, desiredFacingDir) {
    var nativeFacing = NATIVE_FACING[kind] || NATIVE_FACING.walking;
    return nativeFacing === desiredFacingDir ? "1" : "-1";
  };

  PigeonWebringPigeon.prototype.beginLeaving = function () {
    this.leaving = true;
    this.img.src = state.frameUrls[0];
    this.el.classList.add("pigeon-webring--leaving");

    window.setTimeout(this.destroy.bind(this), 950);
  };

  PigeonWebringPigeon.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }

    this.el = null;
    if (typeof this.onDestroy === "function") {
      this.onDestroy();
    }
  };

  function randomBetween(min, max) {
    if (max < min) return min;
    return min + Math.random() * (max - min);
  }

  onReady(init);
})();
