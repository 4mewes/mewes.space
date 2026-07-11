(function() {
  'use strict';

  /**
   * Pigeon Brain - Frame-rate independent AI and Physics controller.
   * Decoupled from rendering and input tracking via Dependency Injection.
   */
  class Pigeon {
    constructor(
      renderer = new window.PNGRenderer(),
      config = window.PIGEON_CONFIG,
      inputTracker = window.MouseTracker,
      states = window.PIGEON_STATES,
      breadCrumbs = null
    ) {
      // Configuration & Dependencies
      this.renderer = renderer;
      this.config = config;
      this.inputTracker = inputTracker;
      this.states = states;
      this.breadCrumbs = breadCrumbs;

      // Initialization
      this.inputTracker.init();
      this.renderer.init();

      // Physics State
      this.x = Math.random() * (window.innerWidth - this.config.DIMENSIONS.RESERVE_X);
      this.y = 0;
      this.velX = 0;
      this.velY = 0;
      this.faceDir = Math.random() < 0.5 ? 1 : -1;
      this.baseSpeed = this.config.SPEED.BASE_MIN + Math.random() * (this.config.SPEED.BASE_MAX - this.config.SPEED.BASE_MIN);
      this.currentSpeedMult = 1;
      this.retreatBias = 0; 

      // AI State
      this.state = this.states.WALKING;
      this.timer = 0;
      this.timerLimit = 0;
      this.nextDecision = this._getRandomDecisionTime();
      this.inputTimer = 0;
      this.lastDist = 2000;
      this.lastMouseRel = { dx: 0, dy: 0 };
      this.isSeekingCrumb = false;
      this.crumbTargetId = null;
      this.eatingCrumbId = null;
      this.spawnTarget = null;

      this._beginSpawnFlight();
    }

    /**
     * Main update loop called by requestAnimationFrame
     * @param {number} dt - Delta time normalized to 60fps (1.0 = 16.6ms)
     */
    update(dt = 1) {
      this._processInput(dt);
      this._updateState(dt);
      this._applyPhysics(dt);
      this.renderer.update(this.x, this.y, this.faceDir, this.state, dt, this.currentSpeedMult, this.timer, this.timerLimit);
    }

    /**
     * Analyzes environment (mouse distance) and sets movement intent
     */
    _processInput(dt) {
      if (this.state === this.states.SPAWNING || this.state === this.states.LANDING || this.state === this.states.COOLDOWN) {
        this._clearCrumbIntent();
        return;
      }

      const { ZONES, SPEED, DIMENSIONS } = this.config;
      const mouse = this.inputTracker.getPosition();
      this.isSeekingCrumb = false;
      
      // Calculate Bottom-Left relative vector
      const mx = mouse.x;
      const my = window.innerHeight - mouse.y;
      const px = this.x + DIMENSIONS.WIDTH / 2;
      const py = this.y + DIMENSIONS.HEIGHT / 2;
      
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 1. ESCAPE ZONE (Fleeing) - This ALWAYS forces flying
      if (dist < ZONES.ESCAPE && this.state !== this.states.FLYING) {
        this._clearCrumbIntent();
        this.transitionTo(this.states.FLYING);
        this._pickFlyAwayDir(dx);
        return;
      }

      if (this.state === this.states.FLYING) {
        this._clearCrumbIntent();
        return;
      }

      // 2. RETREAT ZONE (Skittish dodging)
      if (dist < ZONES.RETREAT) {
        this._clearCrumbIntent();
        const factor = (ZONES.RETREAT - dist) / (ZONES.RETREAT - ZONES.ESCAPE);
        this.currentSpeedMult = 1 + (factor * SPEED.RETREAT_MULT_MAX);
        
        if (this.retreatBias === 0) {
          this.retreatBias = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        }

        this.inputTimer += dt;
        
        // INTERRUPT LOGIC: 
        // Only break a pause/peck if the mouse gets closer than 120px
        const isCurrentlyBusy = this.state === this.states.PAUSING || this.state === this.states.PECKING;
        const shouldInterrupt = !isCurrentlyBusy || dist < 120;

        if (shouldInterrupt) {
          // If we were pausing/pecking, but need to move now
          if (isCurrentlyBusy) {
            this.transitionTo(this.states.WALKING);
          }

          if (this.state === this.states.WALKING) {
             if (this.inputTimer >= 15) {
                this.inputTimer = 0;
                this._pickEscapeDir(dx, dy, dist);
             }
          }
        }
      } else {
        // Clear threat intent
        this.currentSpeedMult = 1;
        this.retreatBias = 0;
        this.inputTimer = 0;
        this._processBreadCrumbs();
      }

      this.lastDist = dist;
      this.lastMouseRel = { dx, dy };
    }

    _processBreadCrumbs() {
      if (!this.breadCrumbs || this.state === this.states.FLYING || this.state === this.states.SPAWNING || this.state === this.states.LANDING || this.state === this.states.COOLDOWN) return;
      if (this.state === this.states.PECKING || this.state === this.states.PAUSING || this.state === this.states.SHAKING) return;

      const { ATTRACTION_RADIUS, EAT_RADIUS } = this.config.BREAD_CRUMBS;
      const ground = this._getGroundPosition();
      const nearest = this.breadCrumbs.getNearestAvailableCrumb(ground.x, ground.y, ATTRACTION_RADIUS);
      if (!nearest) {
        this._clearCrumbIntent(true);
        return;
      }

      this.isSeekingCrumb = true;
      this.crumbTargetId = nearest.crumb.id;
      this.currentSpeedMult = 1;

      if (nearest.dist <= EAT_RADIUS) {
        const claimed = this.breadCrumbs.claimCrumb(nearest.crumb.id);
        if (claimed) {
          this.eatingCrumbId = claimed.id;
          this.breadCrumbs.eatCrumb(claimed.id);
          this.velX = 0;
          this.velY = 0;
          this._clearCrumbIntent();
          this.transitionTo(this.states.PECKING);
        }
        return;
      }

      const angle = Math.atan2(nearest.dy, nearest.dx);
      this.velX = Math.cos(angle);
      this.velY = Math.sin(angle);
      this.faceDir = this.velX > 0 ? 1 : -1;
    }

    _getGroundPosition() {
      const renderWidth = (this.config.PNG_RENDERING && this.config.PNG_RENDERING.WIDTH) || this.config.DIMENSIONS.WIDTH;
      return {
        x: this.x + renderWidth / 2,
        y: this.y
      };
    }

    _clearCrumbIntent(pickNewDirection = false) {
      const hadCrumbIntent = this.crumbTargetId !== null;
      this.crumbTargetId = null;

      if (pickNewDirection && hadCrumbIntent && this.state === this.states.WALKING) {
        this.setRandomDirection();
        this.timer = 0;
        this.nextDecision = this._getRandomDecisionTime();
      }
    }

    _hasAvailableCrumbs() {
      return Boolean(
        this.breadCrumbs &&
        typeof this.breadCrumbs.hasAvailableCrumbs === 'function' &&
        this.breadCrumbs.hasAvailableCrumbs()
      );
    }

    /**
     * Logic for sidestepping or fleeing straight away
     */
    _pickEscapeDir(dx, dy, dist) {
      const baseAngle = Math.atan2(dy, dx); 
      let finalBias = 0;

      if (this.state === this.states.WALKING && dist < this.config.ZONES.RETREAT) {
        const t = Math.max(0, Math.min(1, (dist - this.config.ZONES.ESCAPE) / (this.config.ZONES.RETREAT - this.config.ZONES.ESCAPE)));
        finalBias = this.retreatBias * t;
      }
      
      const jitter = (Math.random() - 0.5) * 0.4; 
      const finalAngle = baseAngle + finalBias + jitter;
      
      this.velX = Math.cos(finalAngle);
      this.velY = Math.sin(finalAngle);
    }

    _pickFlyAwayDir(dx) {
      const renderWidth = (this.config.PNG_RENDERING && this.config.PNG_RENDERING.FLY_WIDTH) || this.config.DIMENSIONS.WIDTH;
      const pigeonCenterX = this.x + renderWidth / 2;
      const horizontal = dx === 0
        ? (pigeonCenterX < window.innerWidth / 2 ? -1 : 1)
        : (dx > 0 ? 1 : -1);
      const climb = 0.75;
      const length = Math.sqrt(horizontal * horizontal + climb * climb);

      this.velX = horizontal / length;
      this.velY = climb / length;
      this.faceDir = horizontal;
    }

    _beginSpawnFlight() {
      const { DIMENSIONS, PNG_RENDERING } = this.config;
      const flyWidth = (PNG_RENDERING && PNG_RENDERING.FLY_WIDTH) || DIMENSIONS.WIDTH;
      const flyHeight = (PNG_RENDERING && PNG_RENDERING.FLY_HEIGHT) || DIMENSIONS.HEIGHT;
      const walkWidth = (PNG_RENDERING && PNG_RENDERING.WIDTH) || DIMENSIONS.WIDTH;
      const maxX = Math.max(0, window.innerWidth - DIMENSIONS.RESERVE_X);
      const maxY = Math.max(0, window.innerHeight - DIMENSIONS.RESERVE_Y);
      const maxSpawnY = Math.max(0, Math.min(maxY, window.innerHeight * 0.5));
      const targetX = Math.random() * maxX;
      const targetY = Math.random() * maxSpawnY;
      const targetCenterX = targetX + walkWidth / 2;
      const fromLeft = targetCenterX <= window.innerWidth / 2;

      this.spawnTarget = { x: targetX, y: targetY };
      this.x = fromLeft ? -flyWidth : window.innerWidth + flyWidth;
      this.y = Math.min(maxY, Math.max(targetY + flyHeight, window.innerHeight * (0.55 + Math.random() * 0.25)));
      this.currentSpeedMult = 1;
      this.retreatBias = 0;
      this.inputTimer = 0;
      this.isSeekingCrumb = false;
      this._clearCrumbIntent();
      this.transitionTo(this.states.SPAWNING);
      this._pointTowardSpawnTarget();
    }

    _beginRespawnCooldown() {
      this.spawnTarget = null;
      this.velX = 0;
      this.velY = 0;
      this.currentSpeedMult = 1;
      this.retreatBias = 0;
      this.inputTimer = 0;
      this.isSeekingCrumb = false;
      this._clearCrumbIntent();
      this.transitionTo(this.states.COOLDOWN);
    }

    _pointTowardSpawnTarget() {
      if (!this.spawnTarget) return;

      const dx = this.spawnTarget.x - this.x;
      const dy = this.spawnTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) {
        this.velX = 0;
        this.velY = 0;
        return;
      }

      this.velX = dx / dist;
      this.velY = dy / dist;
      this.faceDir = this.velX > 0 ? 1 : -1;
    }

    /**
     * Formal state transition with side effects
     */
    transitionTo(newState) {
      if (this.state === newState) return;
      this.state = newState;
      this.timer = 0;
      if (newState !== this.states.PECKING) {
        this.eatingCrumbId = null;
      }

      const { ANIMATION } = this.config;
      if (newState === this.states.FLYING) {
        this.timerLimit = ANIMATION.FLY_MIN + Math.random() * (ANIMATION.FLY_MAX - ANIMATION.FLY_MIN);
      } else if (newState === this.states.LANDING) {
        const startFrames = ANIMATION.FLY_START_FRAME_COUNT || 3;
        const frameDuration = ANIMATION.LANDING_FRAME_DURATION || (ANIMATION.DURATIONS && ANIMATION.DURATIONS.flying) || 3;
        this.timerLimit = startFrames * frameDuration;
      } else if (newState === this.states.COOLDOWN) {
        const min = ANIMATION.RESPAWN_COOLDOWN_MIN || 120;
        const max = Math.max(min, ANIMATION.RESPAWN_COOLDOWN_MAX || min);
        this.timerLimit = min + Math.random() * (max - min);
      } else if (newState === this.states.PECKING) {
        this.timerLimit = ANIMATION.PECK_DURATION;
      } else if (newState === this.states.PAUSING) {
        this.timerLimit = ANIMATION.PAUSE_MIN + Math.random() * (ANIMATION.PAUSE_MAX - ANIMATION.PAUSE_MIN);
      } else if (newState === this.states.SHAKING) {
        this.timerLimit = ANIMATION.SHAKE_DURATION;
      }
    }

    /**
     * Handles progression of time-based states and random behaviors
     */
    _updateState(dt) {
      this.timer += dt;

      // Non-walking states are purely time-locked
      if (this.state === this.states.COOLDOWN) {
        if (this.timer >= this.timerLimit) {
          this._beginSpawnFlight();
        }
        return;
      }

      if (this.state === this.states.FLYING || this.state === this.states.SPAWNING) {
        return;
      }

      if (this.state !== this.states.WALKING) {
        if (this.timer >= this.timerLimit) {
          const wasLanding = this.state === this.states.LANDING;
          if (this.state === this.states.LANDING) {
            this.spawnTarget = null;
          }
          this.transitionTo(this.states.WALKING);
          if (wasLanding) {
            this.setGroundDirection();
            this.nextDecision = this._getRandomDecisionTime();
          }
        }
        return;
      }

      // Random idle decisions
      if (this.isSeekingCrumb) return;

      if (this.timer >= this.nextDecision) {
        this.timer = 0;
        this.nextDecision = this._getRandomDecisionTime();
        this._makeRandomDecision();
      }
    }

    _makeRandomDecision() {
      const roll = Math.random();
      const { PROBABILITY, ZONES } = this.config;

      // 1. Check for idle actions first (Pausing/Shaking)
      if (roll < PROBABILITY.PAUSE) {
        this.transitionTo(this.states.PAUSING);
        return;
      }

      if (roll < (PROBABILITY.PAUSE + PROBABILITY.SHAKE)) {
        this.transitionTo(this.states.SHAKING);
        return;
      }

      // 2. If we're walking, decide where to go
      // Stalking logic: Curious approach, but less direct
      if (!this._hasAvailableCrumbs() && this.lastDist < ZONES.STALK && this.lastDist > ZONES.RETREAT) {
        if (Math.random() < PROBABILITY.STALK_FOLLOW) {
          // If we were doing something else, switch back to walking to stalk
          this.transitionTo(this.states.WALKING);
          const angle = Math.atan2(-this.lastMouseRel.dy, -this.lastMouseRel.dx);
          // More jitter for "real" pigeon movement
          const stalkOffset = (Math.random() - 0.5) * 1.8;
          this.velX = Math.cos(angle + stalkOffset);
          this.velY = Math.sin(angle + stalkOffset);
          return;
        }
      }

      // 3. Default to random wandering
      this.setRandomDirection();
    }

    /**
     * Core physics integration
     */
    _applyPhysics(dt) {
      if (this.state === this.states.PECKING || this.state === this.states.PAUSING || this.state === this.states.SHAKING || this.state === this.states.LANDING || this.state === this.states.COOLDOWN) return;

      const isFlying = this.state === this.states.FLYING;
      const isSpawning = this.state === this.states.SPAWNING;
      if (isFlying && this._isInFlyStartAnimation()) return;

      const speed = this.baseSpeed * ((isFlying || isSpawning) ? this.config.SPEED.ESCAPE_MULT : this.currentSpeedMult);

      if (isSpawning) {
        this._moveTowardSpawnTarget(speed * dt);
        return;
      }
      
      this.x += this.velX * speed * dt;
      this.y += this.velY * speed * dt;

      if (isFlying) {
        this._handleFlightExit();
      } else {
        this._handleBoundaries();
      }

      if (this.velX !== 0) {
        this.faceDir = this.velX > 0 ? 1 : -1;
      }
    }

    _moveTowardSpawnTarget(step) {
      if (!this.spawnTarget) {
        this.transitionTo(this.states.WALKING);
        return;
      }

      const dx = this.spawnTarget.x - this.x;
      const dy = this.spawnTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= Math.max(step, 2)) {
        this.x = this.spawnTarget.x;
        this.y = this.spawnTarget.y;
        this.velX = 0;
        this.velY = 0;
        this.transitionTo(this.states.LANDING);
        return;
      }

      this.velX = dx / dist;
      this.velY = dy / dist;
      this.faceDir = this.velX > 0 ? 1 : -1;
      this.x += this.velX * step;
      this.y += this.velY * step;
    }

    _isInFlyStartAnimation() {
      const { ANIMATION } = this.config;
      const startFrames = ANIMATION.FLY_START_FRAME_COUNT || 0;
      const frameDuration = (ANIMATION.DURATIONS && ANIMATION.DURATIONS.flying) || 3;
      return this.timer < startFrames * frameDuration;
    }

    _handleFlightExit() {
      const flyWidth = (this.config.PNG_RENDERING && this.config.PNG_RENDERING.FLY_WIDTH) || this.config.DIMENSIONS.WIDTH;
      const flyHeight = (this.config.PNG_RENDERING && this.config.PNG_RENDERING.FLY_HEIGHT) || this.config.DIMENSIONS.HEIGHT;
      const offscreenX = this.x < -flyWidth || this.x > window.innerWidth + flyWidth;
      const offscreenY = this.y > window.innerHeight + flyHeight;

      if (offscreenX || offscreenY) {
        this._beginRespawnCooldown();
      }
    }

    _resetAfterFlight() {
      const { RESERVE_X } = this.config.DIMENSIONS;
      const maxX = Math.max(0, window.innerWidth - RESERVE_X);

      this.x = Math.random() * maxX;
      this.y = 0;
      this.currentSpeedMult = 1;
      this.retreatBias = 0;
      this._clearCrumbIntent();
      this.transitionTo(this.states.WALKING);
      this.setRandomDirection();
    }

    _handleBoundaries() {
      const { RESERVE_X, RESERVE_Y } = this.config.DIMENSIONS;
      const maxX = window.innerWidth - RESERVE_X;
      const maxY = window.innerHeight - RESERVE_Y;

      if (this.x < 0) { this.x = 0; this.velX *= -1; this.retreatBias = 0; }
      if (this.x > maxX) { this.x = maxX; this.velX *= -1; this.retreatBias = 0; }
      if (this.y < 0) { this.y = 0; this.velX *= 1; this.velY *= -1; this.retreatBias = 0; }
      if (this.y > maxY) { this.y = maxY; this.velX *= 1; this.velY *= -1; }
    }

    setRandomDirection() {
      const angle = Math.random() * Math.PI * 2;
      this.velX = Math.cos(angle);
      this.velY = Math.sin(angle);
      this.retreatBias = 0; 
    }

    setGroundDirection() {
      const direction = this.faceDir || (Math.random() < 0.5 ? 1 : -1);
      const verticalJitter = (Math.random() - 0.5) * 0.35;

      this.velX = direction;
      this.velY = verticalJitter;
      this.retreatBias = 0;
    }

    _getRandomDecisionTime() {
      return 100 + Math.floor(Math.random() * 200);
    }

    /**
     * Clean up resources and remove from DOM
     */
    destroy() {
      this.renderer.destroy();
    }
  }

  window.Pigeon = Pigeon;
})();
