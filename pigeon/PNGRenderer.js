(function() {
  'use strict';

  const PECK_FRAMES = {
    START: 0,
    TRANSITION: 1,
    REST: 2,
    DOWN: 3,
    DEEP_DOWN: 4
  };

  class PNGRenderer {
    constructor() {
      this.container = null;
      this.img = null;
      this.currentState = null;
      this.currentFrameIndex = 0;
      this.frameTimer = 0;
      this.preloadedFrames = {};
      this.framePaths = {};
      this.peckPhase = 'start';
      this.peckLoopWait = 0;
      this.pauseFrameWait = 0;
      this.flyingDirection = 1;
      this.stateTimer = 0;
      this.stateTimerLimit = 0;
    }

    init() {
      this.injectStyles();
      this.createDOM();
      this._preloadAllAssets();
    }

    injectStyles() {
      if (document.getElementById('pigeon-styles-png')) return;
      const pngRendering = window.PIGEON_CONFIG.PNG_RENDERING || {};
      const width = pngRendering.WIDTH || window.PIGEON_CONFIG.DIMENSIONS.WIDTH;
      const height = pngRendering.HEIGHT || Math.round(width * 0.75);
      const style = document.createElement('style');
      style.id = 'pigeon-styles-png';
      style.textContent = `
        .pigeon-ext-png-container {
          position: fixed;
          left: 0;
          bottom: 0;
          width: ${width}px;
          height: ${height}px;
          z-index: 2147483647;
          pointer-events: none;
          user-select: none;
          will-change: transform;
          transform-origin: center bottom;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .pigeon-ext-png-container img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          object-position: center bottom;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    createDOM() {
      if (!document.body) {
        setTimeout(() => this.createDOM(), 100);
        return;
      }

      this.container = document.createElement('div');
      this.container.className = 'pigeon-ext-png-container';
      this.img = document.createElement('img');
      const assets = window.PIGEON_CONFIG.PNG_ASSETS;
      const initialFrame = (assets.walking && assets.walking.length > 0) ? assets.walking.find(f => f.match(/\.(png|svg)$/i)) : '';
      if (initialFrame) this.img.src = window.getPigeonAssetURL(initialFrame);
      this.container.appendChild(this.img);
      document.body.appendChild(this.container);
    }

    _preloadAllAssets() {
      const assets = window.PIGEON_CONFIG.PNG_ASSETS;
      for (const state in assets) {
        this.framePaths[state] = assets[state].filter(path => path.match(/\.(png|svg)$/i));
        this.preloadedFrames[state] = this.framePaths[state].map(path => {
          const i = new Image();
          i.src = window.getPigeonAssetURL(path);
          return i.src;
        });
      }
    }

    update(x, y, faceDir, state, dt = 1, currentSpeed = 1, stateTimer = 0, stateTimerLimit = 0) {
      if (!this.container) return;

      this.stateTimer = stateTimer;
      this.stateTimerLimit = stateTimerLimit;

      if (this.currentState !== state) {
        this.currentState = state;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
        if (state === 'pecking') {
          this.peckPhase = 'start';
          this.peckLoopWait = 0;
        } else if (state === 'pausing') {
          this.pauseFrameWait = 0;
        } else if (state === 'flying') {
          this.flyingDirection = 1;
        } else if (state === 'spawning') {
          const frames = this._getFramesForState(state) || [];
          this.currentFrameIndex = this._getFlyingLoopStartIndex(frames.length);
          this.flyingDirection = 1;
        } else if (state === 'landing') {
          this.currentFrameIndex = this._getLandingStartIndex();
        }
        this._updateSprite();
      }

      const isHidden = state === 'cooldown';
      this.container.style.setProperty('visibility', isHidden ? 'hidden' : 'visible', 'important');
      if (isHidden) return;

      this._applyStateDimensions(state);

      const scaleX = (state === 'pecking' || state === 'flying' || state === 'spawning' || state === 'landing') ? faceDir : -faceDir;
      const renderOffset = this._getRenderOffset(state);
      const renderX = x + renderOffset.x;
      const renderY = -y + renderOffset.y;
      this.container.style.transform = `translate3d(${Math.round(renderX)}px, ${Math.round(renderY)}px, 0) scaleX(${scaleX})`;

      this._animate(dt, currentSpeed);
    }

    _applyStateDimensions(state) {
      const pngRendering = window.PIGEON_CONFIG.PNG_RENDERING || {};
      const usesFlyingSize = state === 'flying' || state === 'spawning' || state === 'landing';
      const width = usesFlyingSize
        ? (pngRendering.FLY_WIDTH || pngRendering.WIDTH)
        : pngRendering.WIDTH;
      const height = usesFlyingSize
        ? (pngRendering.FLY_HEIGHT || pngRendering.HEIGHT)
        : pngRendering.HEIGHT;

      if (width) this.container.style.width = `${width}px`;
      if (height) this.container.style.height = `${height}px`;
    }

    _getRenderOffset(state) {
      if (state !== 'landing') return { x: 0, y: 0 };

      const pngRendering = window.PIGEON_CONFIG.PNG_RENDERING || {};
      const walkWidth = pngRendering.WIDTH || window.PIGEON_CONFIG.DIMENSIONS.WIDTH;
      const flyWidth = pngRendering.FLY_WIDTH || walkWidth;

      return {
        x: (walkWidth - flyWidth) / 2,
        y: pngRendering.LANDING_Y_OFFSET || 0
      };
    }

    _animate(dt, speed) {
      const frameSpeed = (this.currentState === 'pausing' || this._usesFlyingAnimation(this.currentState)) ? 1 : speed;
      this.frameTimer += dt * frameSpeed;
      const threshold = this._getFrameThreshold();

      if (this.frameTimer >= threshold) {
        this.frameTimer = 0;
        if (this.currentState === 'pecking') {
          this._advancePeckFrame();
        } else if (this.currentState === 'flying' || this.currentState === 'spawning') {
          this._advanceFlyingFrame();
        } else if (this.currentState === 'landing') {
          this._advanceLandingFrame();
        } else {
          const frames = this._getFramesForState(this.currentState) || this.preloadedFrames['walking'];
          if (frames.length > 1) {
            this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
            if (this.currentState === 'pausing') {
              this.pauseFrameWait = 0;
            }
          }
        }
        this._updateSprite();
      }
    }

    _usesFlyingAnimation(state) {
      return state === 'flying' || state === 'spawning' || state === 'landing';
    }

    _getAssetState(state) {
      return this._usesFlyingAnimation(state) ? 'flying' : state;
    }

    _getFramesForState(state) {
      return this.preloadedFrames[this._getAssetState(state)];
    }

    _advanceFlyingFrame() {
      const frames = this._getFramesForState(this.currentState) || [];
      if (frames.length <= 1) return;

      const loopStartIndex = this._getFlyingLoopStartIndex(frames.length);
      const loopEndIndex = this._getFlyingLoopEndIndex(frames.length);
      if (this.currentFrameIndex < loopStartIndex) {
        this.currentFrameIndex = this.currentState === 'spawning'
          ? loopStartIndex
          : this.currentFrameIndex + 1;
        this.flyingDirection = 1;
        return;
      }

      this.currentFrameIndex += this.flyingDirection;
      if (this.currentFrameIndex > loopEndIndex) {
        this.flyingDirection = -1;
        this.currentFrameIndex = Math.max(loopStartIndex, loopEndIndex - 1);
      } else if (this.currentFrameIndex < loopStartIndex) {
        this.flyingDirection = 1;
        this.currentFrameIndex = Math.min(frames.length - 1, loopStartIndex + 1);
      }
    }

    _advanceLandingFrame() {
      if (this.currentFrameIndex > 0) {
        this.currentFrameIndex -= 1;
      }
    }

    _getLandingStartIndex() {
      const frames = this._getFramesForState('landing') || [];
      return Math.max(0, this._getFlyingLoopStartIndex(frames.length) - 1);
    }

    _getFlyingLoopStartIndex(frameCount) {
      const configuredStartCount = window.PIGEON_CONFIG.ANIMATION.FLY_START_FRAME_COUNT || 0;
      return Math.max(0, Math.min(configuredStartCount, frameCount - 1));
    }

    _getFlyingLoopEndIndex(frameCount) {
      const { ANIMATION } = window.PIGEON_CONFIG;
      const loopStartIndex = this._getFlyingLoopStartIndex(frameCount);
      const configuredLoopFrameCount = ANIMATION.FLY_LOOP_FRAME_COUNT || 0;

      if (configuredLoopFrameCount <= 0) {
        return frameCount - 1;
      }

      return Math.max(
        loopStartIndex,
        Math.min(frameCount - 1, loopStartIndex + configuredLoopFrameCount - 1)
      );
    }

    _getFrameThreshold() {
      const { ANIMATION } = window.PIGEON_CONFIG;

      if (this.currentState === 'pecking' && this.peckPhase === 'loop-wait') {
        return this.peckLoopWait || this._pickPeckLoopWait();
      }

      if (this.currentState === 'pausing') {
        if (!this.pauseFrameWait) {
          this.pauseFrameWait = this._pickPauseFrameWait();
        }
        return this.pauseFrameWait;
      }

      if (this.currentState === 'landing') {
        return ANIMATION.LANDING_FRAME_DURATION || ANIMATION.DURATIONS.flying || 6;
      }

      const durationState = this._usesFlyingAnimation(this.currentState) ? 'flying' : this.currentState;
      return ANIMATION.DURATIONS[durationState] || 6;
    }

    _advancePeckFrame() {
      const { ANIMATION } = window.PIGEON_CONFIG;
      const frameDuration = ANIMATION.DURATIONS.pecking || 8;
      const minLoopWait = ANIMATION.PECK_LOOP_WAIT_MIN || 18;
      const maxLoopWait = ANIMATION.PECK_LOOP_WAIT_MAX || 120;
      const exitLeadTime = frameDuration * 2;
      const loopCycleTime = frameDuration * 2;
      const remainingPeckTime = this.stateTimerLimit - this.stateTimer;
      const canCompleteAnotherLoop = remainingPeckTime > exitLeadTime + loopCycleTime;
      const canWaitThenLoop = remainingPeckTime > exitLeadTime + minLoopWait + loopCycleTime;

      if (this.peckPhase === 'start') {
        this.currentFrameIndex++;
        if (this.currentFrameIndex >= PECK_FRAMES.REST) {
          this.peckPhase = 'loop';
          this.currentFrameIndex = PECK_FRAMES.REST;
        }
      } else if (this.peckPhase === 'loop') {
        if (!canCompleteAnotherLoop) {
          this.peckPhase = 'exit';
          this.currentFrameIndex = PECK_FRAMES.TRANSITION;
        } else {
          this.peckPhase = 'loop-return';
          this.currentFrameIndex = this._getPeckDownFrame();
        }
      } else if (this.peckPhase === 'loop-return') {
        this.currentFrameIndex = PECK_FRAMES.REST;
        if (remainingPeckTime <= exitLeadTime) {
          this.peckPhase = 'exit';
          this.currentFrameIndex = PECK_FRAMES.TRANSITION;
        } else if (canWaitThenLoop) {
          this.peckPhase = 'loop-wait';
          this.peckLoopWait = this._pickPeckLoopWait(Math.min(maxLoopWait, remainingPeckTime - exitLeadTime - loopCycleTime));
        } else {
          this.peckPhase = 'exit-wait';
        }
      } else if (this.peckPhase === 'loop-wait') {
        if (canCompleteAnotherLoop) {
          this.peckPhase = 'loop-return';
          this.peckLoopWait = 0;
          this.currentFrameIndex = this._getPeckDownFrame();
        } else {
          this.peckPhase = 'exit-wait';
          this.peckLoopWait = 0;
          this.currentFrameIndex = PECK_FRAMES.REST;
        }
      } else if (this.peckPhase === 'exit-wait') {
        if (remainingPeckTime <= exitLeadTime) {
          this.peckPhase = 'exit';
          this.currentFrameIndex = PECK_FRAMES.TRANSITION;
        }
      } else if (this.peckPhase === 'exit') {
        this.currentFrameIndex--;
        if (this.currentFrameIndex < 0) {
          this.currentFrameIndex = PECK_FRAMES.START;
        }
      }
    }

    _getPeckDownFrame() {
      return Math.random() < 0.12 ? PECK_FRAMES.DEEP_DOWN : PECK_FRAMES.DOWN;
    }

    _pickPeckLoopWait(maxWait) {
      const { ANIMATION } = window.PIGEON_CONFIG;
      const min = ANIMATION.PECK_LOOP_WAIT_MIN || 18;
      const configuredMax = ANIMATION.PECK_LOOP_WAIT_MAX || 120;
      const max = Math.max(min, Math.floor(maxWait || configuredMax));
      return min + Math.floor(Math.random() * (max - min + 1));
    }

    _pickPauseFrameWait() {
      const { ANIMATION } = window.PIGEON_CONFIG;
      const min = ANIMATION.PAUSE_FRAME_WAIT_MIN || 18;
      const configuredMax = ANIMATION.PAUSE_FRAME_WAIT_MAX || 120;
      const max = Math.max(min, configuredMax);
      return min + Math.floor(Math.random() * (max - min + 1));
    }

    _updateSprite() {
      const activeFrames = this._getFramesForState(this.currentState) || this.preloadedFrames['walking'];

      if (activeFrames && activeFrames[this.currentFrameIndex]) {
        const nextSrc = activeFrames[this.currentFrameIndex];

        if (this.img.src !== nextSrc) {
          this.img.src = nextSrc;
        }
      }
    }

    destroy() {
      if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
      this.container = null;
      this.img = null;
    }
  }

  window.PNGRenderer = PNGRenderer;
})();
