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
    sitesEndpoint: "",
    heartbeatEndpoint: "https://jhufnopbeulclqelxgyo.supabase.co/functions/v1/heartbeat",
    canonicalUrl: "",
    assetBase: "assets/",
    initialDelayMinMs: 10000,
    initialDelayMaxMs: 30000,
    walkDurationMinMs: 20000,
    walkDurationMaxMs: 40000,
    respawnDelayMinMs: 30000,
    respawnDelayMaxMs: 60000,
    intervalMs: 60000,
    initialDelayMs: 60000,
    durationMs: 15000,
    spawnChance: 1,
    speedPxPerSecond: 58,
    frameMs: 115,
    flyFrameMs: 115,
    landingFrameMs: 50,
    flyStartFrameCount: 3,
    flyLoopFrameCount: 3,
    flySpeedPxPerSecond: 500,
    flySpriteWidth: 120,
    flySpriteHeight: 120,
    landingYOffset: 27,
    landingFinishOffsetX: null,
    landingFinishOffsetY: 0,
    flightEdgePadding: 140,
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
    infoHref: "https://mewes-space.xyz/pages/webring",
    infoIcon: "app-icon-image.png",
    infoLabel: "Web Pigeons",
    infoText: "this page is inhabited by pigeons",
    showInfoLink: true,
    linkPrefix: "",
    linkTarget: "_blank",
    linkRel: "noopener noreferrer",
    linkEnabled: true,
    leaveEnabled: true,
    labelMessages: [],
    labelMessageIntervalMs: 0,
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
    ],
    flyFrames: [
      "pigeon-soar_0034.png",
      "pigeon-soar_0047.png",
      "pigeon-soar_0049.png",
      "pigeon-soar_0052.png",
      "pigeon-soar_0053.png",
      "pigeon-soar_0054.png",
      "pigeon-soar_0055.png",
      "pigeon-soar_0056.png",
      "pigeon-soar_0057.png"
    ]
  };

  var NATIVE_FACING = {
    walking: -1,
    pausing: -1,
    pecking: 1,
    landing: 1,
    flying: 1
  };

  var config = assign(assign({}, defaults), existingConfig);
  var state = {
    activePigeon: null,
    frameUrls: [],
    peckFrameUrls: [],
    pauseFrameUrls: [],
    flyFrameUrls: [],
    initialized: false,
    pointer: {
      active: false,
      x: 0,
      y: 0
    },
    pointerTrackingInstalled: false,
    sites: [],
    shownTargetKeys: [],
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

    var sitesEndpoint = getSitesEndpoint();
    if (sitesEndpoint) {
      loadSitesEndpoint(sitesEndpoint, callback);
      return;
    }

    if (Array.isArray(window.PigeonWebringSites)) {
      callback(window.PigeonWebringSites);
      return;
    }

    loadSitesScriptFallback(callback);
  }

  function getSitesEndpoint() {
    var configuredEndpoint = typeof config.sitesEndpoint === "string" ? config.sitesEndpoint.trim() : "";
    var scriptEndpoint = typeof window.PigeonWebringSitesEndpoint === "string" ? window.PigeonWebringSitesEndpoint.trim() : "";

    return configuredEndpoint || scriptEndpoint;
  }

  function loadSitesEndpoint(endpoint, callback) {
    if (typeof window.fetch !== "function") {
      loadSitesScriptFallback(callback);
      return;
    }

    window.fetch(resolveUrl(endpoint), {
      method: "GET",
      credentials: "omit",
      cache: "no-store"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Pigeon Webring sites request failed");
        return response.json();
      })
      .then(function (data) {
        callback(parseSitesEndpointResponse(data));
      })
      .catch(function () {
        if (config.sitesScript) {
          loadSitesScriptFallback(callback);
          return;
        }

        callback([]);
      });
  }

  function parseSitesEndpointResponse(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.urls)) return data.urls;
    if (data && Array.isArray(data.sites)) return data.sites;
    return [];
  }

  function sendHeartbeat() {
    var endpoint = typeof config.heartbeatEndpoint === "string" ? config.heartbeatEndpoint.trim() : "";
    var protocol = window.location.protocol;
    var heartbeatUrl = getHeartbeatUrl();

    if (!endpoint || typeof window.fetch !== "function") return;
    if (protocol !== "http:" && protocol !== "https:") return;
    if (!heartbeatUrl) return;

    window.fetch(resolveUrl(endpoint), {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: heartbeatUrl,
        origin: window.location.origin,
        href: window.location.href
      })
    }).catch(function () {});
  }

  function getHeartbeatUrl() {
    return getConfiguredCanonicalUrl() || getDocumentCanonicalUrl() || window.location.origin;
  }

  function getConfiguredCanonicalUrl() {
    var canonicalUrl = typeof config.canonicalUrl === "string" ? config.canonicalUrl.trim() : "";

    return canonicalUrl ? normalizeHeartbeatUrl(canonicalUrl) : "";
  }

  function getDocumentCanonicalUrl() {
    var canonical = document.querySelector('link[rel~="canonical"][href]');
    var ogUrl = document.querySelector('meta[property="og:url"][content]');
    var url = canonical && canonical.href ? canonical.href : "";

    if (!url && ogUrl && ogUrl.content) {
      url = ogUrl.content;
    }

    return url ? normalizeHeartbeatUrl(url) : "";
  }

  function normalizeHeartbeatUrl(url) {
    try {
      return new URL(url, window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  function loadSitesScriptFallback(callback) {
    var script = document.createElement("script");
    script.src = resolveUrl(config.sitesScript);
    script.async = true;
    script.onload = function () {
      var sitesEndpoint = getSitesEndpoint();
      if (sitesEndpoint) {
        loadSitesEndpoint(sitesEndpoint, callback);
        return;
      }

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
    if (config.showInfoLink !== false) {
      createInfoLink();
    }
    installPointerTracking();
    sendHeartbeat();
    state.frameUrls = config.frames.map(resolveAsset);
    state.peckFrameUrls = config.peckFrames.map(resolveAsset);
    state.pauseFrameUrls = config.pauseFrames.map(resolveAsset);
    state.flyFrameUrls = config.flyFrames.map(resolveAsset);
    preloadFrames(state.frameUrls.concat(state.peckFrameUrls).concat(state.pauseFrameUrls).concat(state.flyFrameUrls));

    loadSites(function (sites) {
      state.sites = normalizeSites(sites);
      state.shownTargetKeys = [];
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
    var unseenCandidates;
    var target;

    if (!candidates.length) return null;

    state.shownTargetKeys = state.shownTargetKeys.filter(function (key) {
      return candidates.some(function (site) {
        return getTargetKey(site) === key;
      });
    });

    unseenCandidates = candidates.filter(function (site) {
      return state.shownTargetKeys.indexOf(getTargetKey(site)) === -1;
    });

    if (!unseenCandidates.length) {
      state.shownTargetKeys = [];
      unseenCandidates = candidates;
    }

    target = unseenCandidates[Math.floor(Math.random() * unseenCandidates.length)];
    state.shownTargetKeys.push(getTargetKey(target));
    return target;
  }

  function getTargetKey(site) {
    return site.normalizedHostname || site.url;
  }

  function start() {
    if (state.running) return;
    state.running = true;
    scheduleNext(getInitialDelayMs());
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
      state.timerId = null;
      maybeSpawn();
    }, Math.max(0, delayMs));
  }

  function maybeSpawn() {
    var pigeon;

    if (!state.running || state.activePigeon) return;
    if (document.hidden || Math.random() > config.spawnChance) {
      scheduleNext(getRespawnDelayMs());
      return;
    }

    pigeon = spawn();
    if (!pigeon) {
      scheduleNext(getRespawnDelayMs());
    }
  }

  function spawn() {
    if (state.activePigeon) return state.activePigeon;

    var target = getRandomTarget();
    if (!target || !state.frameUrls.length) return null;

    state.activePigeon = new PigeonWebringPigeon(target, function () {
      state.activePigeon = null;
      if (state.running) {
        scheduleNext(getRespawnDelayMs());
      }
    });
    return state.activePigeon;
  }

  function getInitialDelayMs() {
    return getTimingRange("initialDelayMinMs", "initialDelayMaxMs", "initialDelayMs");
  }

  function getWalkDurationMs() {
    return getTimingRange("walkDurationMinMs", "walkDurationMaxMs", "durationMs");
  }

  function getRespawnDelayMs() {
    return getTimingRange("respawnDelayMinMs", "respawnDelayMaxMs", "intervalMs");
  }

  function getLabelMessages(target) {
    var messages = Array.isArray(config.labelMessages) ? config.labelMessages : [];

    messages = messages
      .map(function (message) {
        return String(message || "").trim();
      })
      .filter(Boolean);

    return messages.length ? messages : [target.label];
  }

  function getLabelMessageIntervalMs() {
    return Math.max(0, getNumber(config.labelMessageIntervalMs, 0));
  }

  function getTimingRange(minKey, maxKey, legacyKey) {
    var hasMin = hasOwn(existingConfig, minKey);
    var hasMax = hasOwn(existingConfig, maxKey);
    var hasLegacy = legacyKey && hasOwn(existingConfig, legacyKey);
    var fallback = getNumber(config[legacyKey], 0);
    var min;
    var max;

    if (!hasMin && !hasMax && hasLegacy) {
      return Math.max(0, fallback);
    }

    min = getNumber(config[minKey], fallback);
    max = getNumber(config[maxKey], min);
    return randomBetween(Math.max(0, min), Math.max(0, max));
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function getNumber(value, fallback) {
    var number = Number(value);
    return isFinite(number) ? number : fallback;
  }

  function PigeonWebringPigeon(target, onDestroy) {
    this.target = target;
    this.onDestroy = onDestroy;
    this.el = null;
    this.birdEl = null;
    this.labelEl = null;
    this.spriteLinkEl = null;
    this.img = null;
    this.frameIndex = 0;
    this.lastFrameAt = 0;
    this.lastTickAt = 0;
    this.startedAt = 0;
    this.walkDurationMs = getWalkDurationMs();
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
    this.landingFrameUrls = [];
    this.landingPhase = "";
    this.landingTargetX = 0;
    this.landingTargetY = 0;
    this.landingStartY = 0;
    this.flightTargetX = 0;
    this.flightTargetY = 0;
    this.flightVelX = 0;
    this.flightVelY = 0;
    this.flightLoopDirection = 1;
    this.flightMoving = false;
    this.hoverStoppedAt = 0;
    this.hoverFrameIndex = 0;
    this.hoverFrameUrls = null;
    this.hoverIdleKind = "";
    this.hoverLastFrameAt = 0;
    this.hoverIdleSwitchAt = 0;
    this.visualFacingDir = 1;
    this.hoverFacingDir = 1;
    this.destroyed = false;
    this.labelMessages = getLabelMessages(target);
    this.labelMessageIndex = Math.floor(Math.random() * this.labelMessages.length);
    this.labelTimerId = 0;

    this.createDom();
    this.startLabelMessages();
    this.pickStart();
    this.tick = this.tick.bind(this);
    var now = performance.now();
    this.startedAt = now;
    this.lastTickAt = now;
    this.lastFrameAt = now;
    this.beginLanding(now);
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  PigeonWebringPigeon.prototype.createDom = function () {
    var el = document.createElement("div");
    var bird = document.createElement("div");
    var linksEnabled = config.linkEnabled !== false;
    var link = document.createElement(linksEnabled ? "a" : "span");
    var spriteLink = document.createElement(linksEnabled ? "a" : "span");
    var img = document.createElement("img");

    el.className = linksEnabled ? "pigeon-webring" : "pigeon-webring pigeon-webring--no-link";
    el.style.setProperty("--pigeon-webring-sprite-width", config.spriteWidth + "px");
    el.style.setProperty("--pigeon-webring-sprite-height", config.spriteHeight + "px");

    bird.className = "pigeon-webring__bird";

    link.className = "pigeon-webring__link";
    link.textContent = this.getLabelText(this.labelMessages[0]);

    spriteLink.className = "pigeon-webring__sprite-link";
    spriteLink.setAttribute("aria-label", this.labelMessages[0]);

    if (linksEnabled) {
      link.href = this.target.url;
      link.target = config.linkTarget;
      link.rel = config.linkRel;
      spriteLink.href = this.target.url;
      spriteLink.target = config.linkTarget;
      spriteLink.rel = config.linkRel;
    } else {
      link.style.cursor = "default";
      spriteLink.style.cursor = "default";
      bird.addEventListener("click", this.advanceLabelMessage.bind(this));
    }

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
    this.labelEl = link;
    this.spriteLinkEl = spriteLink;
    this.img = img;
  };

  PigeonWebringPigeon.prototype.getLabelText = function (message) {
    return config.linkPrefix ? config.linkPrefix + " " + message : message;
  };

  PigeonWebringPigeon.prototype.startLabelMessages = function () {
    var intervalMs = getLabelMessageIntervalMs();
    var self = this;

    if (intervalMs <= 0 || this.labelMessages.length < 2) return;

    this.labelTimerId = window.setInterval(function () {
      self.advanceLabelMessage();
    }, intervalMs);
  };

  PigeonWebringPigeon.prototype.advanceLabelMessage = function () {
    var nextIndex;

    if (this.labelMessages.length < 2) return;

    nextIndex = Math.floor(Math.random() * (this.labelMessages.length - 1));
    if (nextIndex >= this.labelMessageIndex) {
      nextIndex += 1;
    }

    this.labelMessageIndex = nextIndex;
    this.updateLabelMessage();
  };

  PigeonWebringPigeon.prototype.updateLabelMessage = function () {
    var message = this.labelMessages[this.labelMessageIndex];

    if (this.labelEl) {
      this.labelEl.textContent = this.getLabelText(message);
    }

    if (this.spriteLinkEl) {
      this.spriteLinkEl.setAttribute("aria-label", message);
    }
  };

  PigeonWebringPigeon.prototype.pickStart = function () {
    var rect = this.getRect();
    var maxX = Math.max(0, window.innerWidth - rect.width - 12);
    var maxY = Math.max(0, window.innerHeight - rect.height - 12);
    var minY = Math.min(maxY, Math.max(12, window.innerHeight * 0.5));

    this.x = randomBetween(12, maxX);
    this.y = randomBetween(minY, maxY);
    this.pickDirection();

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

  PigeonWebringPigeon.prototype.setGroundDirection = function (now) {
    var direction = this.visualFacingDir || (Math.random() < 0.5 ? 1 : -1);

    this.vx = direction;
    this.vy = (Math.random() - 0.5) * 0.35;
    this.syncFacingWithVelocity();
    this.nextDecisionAt = now + randomBetween(1200, 2800);
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

    if (this.mode === "landing") {
      this.updateLanding(now, dt);
      this.rafId = window.requestAnimationFrame(this.tick);
      return;
    }

    if (this.mode === "flying") {
      this.updateFlying(now, dt);
      return;
    }

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

    if (config.leaveEnabled !== false && !this.leaving && now - this.startedAt >= this.walkDurationMs) {
      this.beginLeaving(now);
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

  PigeonWebringPigeon.prototype.beginLanding = function (now) {
    if (!state.flyFrameUrls.length) {
      this.resumeWalking(now);
      return;
    }

    this.mode = "landing";
    this.leaving = false;
    this.landingTargetX = this.x;
    this.landingTargetY = this.y;
    this.landingPhase = "approach";
    this.landingFrameUrls = [];
    this.flightLoopDirection = 1;
    this.flightMoving = true;
    this.lastFrameAt = now;

    var landingStart = this.getLandingStartPoint();
    var loopBounds = this.getFlyLoopBounds();
    this.x = landingStart.x;
    this.y = landingStart.y;
    this.setFlightVector(this.landingTargetX, this.landingTargetY);
    this.setFlyFrame(loopBounds.start);
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.updateLanding = function (now, dt) {
    if (this.landingPhase === "finish") {
      this.updateLandingFinish(now);
      return;
    }

    this.x += this.flightVelX * config.flySpeedPxPerSecond * dt;
    this.y += this.flightVelY * config.flySpeedPxPerSecond * dt;

    if (this.hasReachedPoint(this.landingTargetX, this.landingTargetY)) {
      this.x = this.landingTargetX;
      this.y = this.landingTargetY;
      this.beginLandingFinish(now);
      return;
    }

    if (now - this.lastFrameAt >= config.flyFrameMs) {
      this.lastFrameAt = now;
      this.advanceFlyLoopFrame();
    }

    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.beginLandingFinish = function (now) {
    var startFrames = this.getFlyStartFrameUrls();

    if (!startFrames.length) {
      this.resumeWalking(now, true);
      return;
    }

    this.landingPhase = "finish";
    this.landingFrameUrls = startFrames.slice().reverse();
    this.frameIndex = 0;
    this.lastFrameAt = now;
    this.img.src = this.landingFrameUrls[0];
    this.applyPosition();
  };

  PigeonWebringPigeon.prototype.updateLandingFinish = function (now) {
    if (!this.landingFrameUrls.length) {
      this.resumeWalking(now, true);
      return;
    }

    if (now - this.lastFrameAt >= config.landingFrameMs) {
      this.lastFrameAt = now;
      this.frameIndex += 1;

      if (this.frameIndex >= this.landingFrameUrls.length) {
        this.resumeWalking(now, true);
        return;
      }

      this.img.src = this.landingFrameUrls[this.frameIndex];
    }

    this.applyPosition();
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

  PigeonWebringPigeon.prototype.resumeWalking = function (now, keepDirection) {
    this.mode = "walking";
    this.leaving = false;
    this.landingPhase = "";
    this.landingFrameUrls = [];
    this.flightMoving = false;
    this.frameIndex = 0;
    this.lastFrameAt = now;
    if (keepDirection) {
      this.startedAt = now;
      this.setGroundDirection(now);
    }
    this.img.src = state.frameUrls[0];
    if (!keepDirection) {
      this.pickDirection();
    }
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
    var renderOffset = this.getRenderOffset(facingKind);

    this.applySpriteDimensions(facingKind);
    this.el.style.transform = "translate3d(" + Math.round(this.x + renderOffset.x) + "px, " + Math.round(this.y + renderOffset.y) + "px, 0)";
    this.el.style.setProperty("--pigeon-webring-facing", facing);
  };

  PigeonWebringPigeon.prototype.getRenderOffset = function (kind) {
    if (kind === "landing" && this.landingPhase === "finish") {
      return {
        x: typeof config.landingFinishOffsetX === "number"
          ? config.landingFinishOffsetX
          : (config.spriteWidth - config.flySpriteWidth) / 2,
        y: typeof config.landingFinishOffsetY === "number"
          ? config.landingFinishOffsetY
          : config.spriteHeight - config.flySpriteHeight + config.landingYOffset
      };
    }

    return { x: 0, y: 0 };
  };

  PigeonWebringPigeon.prototype.applySpriteDimensions = function (kind) {
    var isFlightFrame = kind === "landing" || kind === "flying";
    var width = isFlightFrame ? config.flySpriteWidth : config.spriteWidth;
    var height = isFlightFrame ? config.flySpriteHeight : config.spriteHeight;

    this.el.style.setProperty("--pigeon-webring-sprite-width", width + "px");
    this.el.style.setProperty("--pigeon-webring-sprite-height", height + "px");
  };

  PigeonWebringPigeon.prototype.getFacingScale = function (kind, desiredFacingDir) {
    var nativeFacing = NATIVE_FACING[kind] || NATIVE_FACING.walking;
    return nativeFacing === desiredFacingDir ? "1" : "-1";
  };

  PigeonWebringPigeon.prototype.beginLeaving = function (now) {
    this.leaving = true;
    this.mode = "flying";
    this.hoverStoppedAt = 0;
    this.hoverFrameUrls = null;
    this.hoverIdleKind = "";
    this.frameIndex = 0;
    this.flightLoopDirection = 1;
    this.flightMoving = false;
    this.lastFrameAt = now;
    this.syncFacingWithVelocity();

    if (!state.flyFrameUrls.length) {
      this.destroy();
      return;
    }

    this.img.src = state.flyFrameUrls[0];
    this.setFlightVectorToExit();
    this.applyPosition();
    this.rafId = window.requestAnimationFrame(this.tick);
  };

  PigeonWebringPigeon.prototype.updateFlying = function (now, dt) {
    if (now - this.lastFrameAt >= config.flyFrameMs) {
      this.lastFrameAt = now;
      this.advanceFlyAwayFrame();
    }

    if (this.flightMoving) {
      this.x += this.flightVelX * config.flySpeedPxPerSecond * dt;
      this.y += this.flightVelY * config.flySpeedPxPerSecond * dt;
    }

    this.applyPosition();

    if (this.isOffscreen()) {
      this.destroy();
      return;
    }

    this.rafId = window.requestAnimationFrame(this.tick);
  };

  PigeonWebringPigeon.prototype.getLandingStartPoint = function () {
    var padding = config.flightEdgePadding;
    var targetCenterX = this.landingTargetX + config.spriteWidth / 2;
    var distanceToLeft = targetCenterX;
    var distanceToRight = Math.max(0, window.innerWidth - targetCenterX);
    var fromLeft = distanceToLeft <= distanceToRight;
    var highestStartY = Math.max(8, this.landingTargetY - config.flySpriteHeight);
    var preferredStartY = window.innerHeight * randomBetween(0.06, 0.24);
    var startY = Math.min(highestStartY, preferredStartY);

    startY = Math.max(8, startY);

    return {
      x: fromLeft ? -config.flySpriteWidth - padding : window.innerWidth + padding,
      y: startY
    };
  };

  PigeonWebringPigeon.prototype.setFlightVector = function (targetX, targetY) {
    var dx = targetX - this.x;
    var dy = targetY - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.flightTargetX = targetX;
    this.flightTargetY = targetY;
    this.flightVelX = dx / dist;
    this.flightVelY = dy / dist;
    if (Math.abs(this.flightVelX) >= 0.001) {
      this.visualFacingDir = this.flightVelX >= 0 ? 1 : -1;
    }
  };

  PigeonWebringPigeon.prototype.setFlightVectorToExit = function () {
    var rect = this.getRect();
    var padding = config.flightEdgePadding;
    var targetX = this.visualFacingDir >= 0
      ? window.innerWidth + rect.width + padding
      : -rect.width - padding;
    var targetY = Math.max(-rect.height - padding, this.y - window.innerHeight * 0.45 - randomBetween(60, 160));

    this.setFlightVector(targetX, targetY);
  };

  PigeonWebringPigeon.prototype.hasReachedPoint = function (targetX, targetY) {
    var dx = targetX - this.x;
    var dy = targetY - this.y;
    var remainingDot = dx * this.flightVelX + dy * this.flightVelY;

    return remainingDot <= 0 || Math.sqrt(dx * dx + dy * dy) <= config.flySpeedPxPerSecond / 30;
  };

  PigeonWebringPigeon.prototype.isOffscreen = function () {
    var rect = this.getRect();
    var padding = config.flightEdgePadding;

    return (
      this.x < -rect.width - padding ||
      this.x > window.innerWidth + padding ||
      this.y < -rect.height - padding ||
      this.y > window.innerHeight + padding
    );
  };

  PigeonWebringPigeon.prototype.getFlyLoopBounds = function () {
    var total = state.flyFrameUrls.length;
    var start = Math.max(0, Math.floor(config.flyStartFrameCount) || 0);
    var count = Math.max(1, Math.floor(config.flyLoopFrameCount) || 1);
    var end;

    if (!total) {
      return { start: 0, end: 0 };
    }

    start = Math.min(start, total - 1);
    end = Math.min(total - 1, start + count - 1);

    return { start: start, end: Math.max(start, end) };
  };

  PigeonWebringPigeon.prototype.getFlyStartFrameUrls = function () {
    var total = state.flyFrameUrls.length;
    var count = Math.max(0, Math.floor(config.flyStartFrameCount) || 0);

    if (!total || !count) return [];
    return state.flyFrameUrls.slice(0, Math.min(count, total));
  };

  PigeonWebringPigeon.prototype.setFlyFrame = function (frameIndex) {
    if (!state.flyFrameUrls.length) return;

    this.frameIndex = Math.max(0, Math.min(state.flyFrameUrls.length - 1, frameIndex));
    this.img.src = state.flyFrameUrls[this.frameIndex];
  };

  PigeonWebringPigeon.prototype.advanceFlyAwayFrame = function () {
    var loopBounds = this.getFlyLoopBounds();

    if (!state.flyFrameUrls.length) return;

    if (this.frameIndex < loopBounds.start) {
      this.setFlyFrame(this.frameIndex + 1);
      if (this.frameIndex >= loopBounds.start) {
        this.flightMoving = true;
      }
      return;
    }

    this.flightMoving = true;
    this.advanceFlyLoopFrame();
  };

  PigeonWebringPigeon.prototype.advanceFlyLoopFrame = function () {
    var loopBounds = this.getFlyLoopBounds();
    var nextFrame;

    if (!state.flyFrameUrls.length) return;

    if (this.frameIndex < loopBounds.start || this.frameIndex > loopBounds.end) {
      this.flightLoopDirection = 1;
      this.setFlyFrame(loopBounds.start);
      return;
    }

    if (loopBounds.start === loopBounds.end) {
      this.setFlyFrame(loopBounds.start);
      return;
    }

    nextFrame = this.frameIndex + this.flightLoopDirection;

    if (nextFrame > loopBounds.end) {
      this.flightLoopDirection = -1;
      nextFrame = loopBounds.end - 1;
    } else if (nextFrame < loopBounds.start) {
      this.flightLoopDirection = 1;
      nextFrame = loopBounds.start + 1;
    }

    this.setFlyFrame(nextFrame);
  };

  PigeonWebringPigeon.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.labelTimerId) {
      window.clearInterval(this.labelTimerId);
      this.labelTimerId = 0;
    }

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
