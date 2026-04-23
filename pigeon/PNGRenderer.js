(function() {
  'use strict';

  class PNGRenderer {
    constructor() {
      this.container = null;
      this.img = null;
      this.currentState = null;
      this.currentFrameIndex = 0;
      this.frameTimer = 0;
      this.preloadedFrames = {};
    }

    init() {
      console.log('Pigeons!!!! PNGRenderer initializing.');
      this.injectStyles();
      this.createDOM();
      this._preloadAllAssets();
    }

    injectStyles() {
      if (document.getElementById('pigeon-styles-png')) return;
      const style = document.createElement('style');
      style.id = 'pigeon-styles-png';
      style.textContent = `
        .pgn-png {
          position: fixed;
          bottom: 0;
          z-index: 2147483647;
          pointer-events: none;
          user-select: none;
          width: ${window.PIGEON_CONFIG.DIMENSIONS.WIDTH}px;
          height: ${window.PIGEON_CONFIG.DIMENSIONS.HEIGHT}px;
          will-change: transform, left, bottom;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .pgn-png img {
          width: 100%;
          height: 100%;
          display: block;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    createDOM() {
      if (!document.body) {
        console.warn('Pigeons!!!! document.body not found, delaying DOM creation.');
        setTimeout(() => this.createDOM(), 100);
        return;
      }

      this.container = document.createElement('div');
      this.container.className = 'pgn-png';

      this.img = document.createElement('img');
      const assets = window.PIGEON_CONFIG.PNG_ASSETS;
      const initialFrame = (assets.walking && assets.walking.length > 0) ? assets.walking[0] : '';
      
      if (initialFrame) {
        this.img.src = window.getPigeonAssetURL(initialFrame);
      }

      this.container.appendChild(this.img);
      document.body.appendChild(this.container);
      console.log('Pigeons!!!! PNGRenderer DOM created and appended to body.');
    }

    _preloadAllAssets() {
      const assets = window.PIGEON_CONFIG.PNG_ASSETS;
      for (const state in assets) {
        this.preloadedFrames[state] = assets[state].map(path => {
          const i = new Image();
          i.src = window.getPigeonAssetURL(path);
          return i.src;
        });
      }
    }

    /**
     * @param {number} x 
     * @param {number} y 
     * @param {number} faceDir 
     * @param {string} state - The current behavior state (walking, pausing, etc.)
     * @param {number} dt 
     * @param {number} currentSpeed
     */
    update(x, y, faceDir, state, dt = 1, currentSpeed = 1) {
      if (!this.container) return;

      // Detect state change internally
      if (this.currentState !== state) {
        this.currentState = state;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
        this._updateSprite();
      }

      // 1. Move
      this.container.style.left = `${Math.round(x)}px`;
      this.container.style.bottom = `${Math.round(y)}px`;
      this.container.style.transform = `scaleX(${-faceDir})`;

      // 2. Animate (Handles cycling for multi-frame animations)
      this._animate(dt, currentSpeed);
    }

    _animate(dt, speed) {
      let frames = this.preloadedFrames[this.currentState] || [];
      
      if (frames.length === 0) {
        frames = this.preloadedFrames['walking'];
      }

      if (!frames || frames.length === 0) return;

      if (frames.length === 1) {
        this.currentFrameIndex = 0;
        this._updateSprite(frames);
        return;
      }

      this.frameTimer += dt * speed;

      // Get state-specific threshold (default to 6 if not found)
      const threshold = window.PIGEON_CONFIG.ANIMATION.DURATIONS[this.currentState] || 6;
      
      if (this.frameTimer >= threshold) {
        this.frameTimer = 0;
        this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
        this._updateSprite(frames);
      }
    }

    _updateSprite(frames) {
      const activeFrames = frames || this.preloadedFrames[this.currentState] || this.preloadedFrames['walking'];
      if (activeFrames && activeFrames[this.currentFrameIndex]) {
        const nextSrc = activeFrames[this.currentFrameIndex];
        if (this.img.src !== nextSrc) {
          this.img.src = nextSrc;
        }
      }
    }

    destroy() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this.img = null;
    }
  }

  window.PNGRenderer = PNGRenderer;
})();
