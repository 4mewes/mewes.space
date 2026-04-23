(function() {
  'use strict';

  /**
   * Pigeon Brain - Frame-rate independent AI and Physics controller.
   * Decoupled from rendering and input tracking via Dependency Injection.
   */
  class Pigeon {
    constructor(
      renderer = new window.SVGRenderer(),
      config = window.PIGEON_CONFIG,
      inputTracker = window.MouseTracker,
      states = window.PIGEON_STATES
    ) {
      // Configuration & Dependencies
      this.renderer = renderer;
      this.config = config;
      this.inputTracker = inputTracker;
      this.states = states;

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

      this.setRandomDirection();
    }

    /**
     * Main update loop called by requestAnimationFrame
     * @param {number} dt - Delta time normalized to 60fps (1.0 = 16.6ms)
     */
    update(dt = 1) {
      this._processInput(dt);
      this._updateState(dt);
      this._applyPhysics(dt);
      this.renderer.update(this.x, this.y, this.faceDir, this.state, dt, this.currentSpeedMult);
    }

    /**
     * Analyzes environment (mouse distance) and sets movement intent
     */
    _processInput(dt) {
      const { ZONES, SPEED, DIMENSIONS } = this.config;
      const mouse = this.inputTracker.getPosition();
      
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
        this.transitionTo(this.states.FLYING);
        this._pickEscapeDir(dx, dy, dist);
        return;
      }

      if (this.state === this.states.FLYING) return;

      // 2. RETREAT ZONE (Skittish dodging)
      if (dist < ZONES.RETREAT) {
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
      }

      this.lastDist = dist;
      this.lastMouseRel = { dx, dy };
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

    /**
     * Formal state transition with side effects
     */
    transitionTo(newState) {
      if (this.state === newState) return;
      this.state = newState;
      this.timer = 0;

      const { ANIMATION } = this.config;
      if (newState === this.states.FLYING) {
        this.timerLimit = ANIMATION.FLY_MIN + Math.random() * (ANIMATION.FLY_MAX - ANIMATION.FLY_MIN);
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
      if (this.state !== this.states.WALKING) {
        if (this.timer >= this.timerLimit) {
          this.transitionTo(this.states.WALKING);
        }
        return;
      }

      // Random idle decisions
      if (this.timer >= this.nextDecision) {
        this.timer = 0;
        this.nextDecision = this._getRandomDecisionTime();
        this._makeRandomDecision();
      }
    }

    _makeRandomDecision() {
      const roll = Math.random();
      const { PROBABILITY, ZONES } = this.config;

      // 1. Check for idle actions first (Pecking/Pausing/Shaking)
      if (roll < PROBABILITY.PECK) {
        this.transitionTo(this.states.PECKING);
        return;
      }
      
      if (roll < (PROBABILITY.PECK + PROBABILITY.PAUSE)) {
        this.transitionTo(this.states.PAUSING);
        return;
      }

      if (roll < (PROBABILITY.PECK + PROBABILITY.PAUSE + PROBABILITY.SHAKE)) {
        this.transitionTo(this.states.SHAKING);
        return;
      }

      // 2. If we're walking, decide where to go
      // Stalking logic: Curious approach, but less direct
      if (this.lastDist < ZONES.STALK && this.lastDist > ZONES.RETREAT) {
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
      if (this.state === this.states.PECKING || this.state === this.states.PAUSING || this.state === this.states.SHAKING) return;

      const isFlying = this.state === this.states.FLYING;
      const speed = this.baseSpeed * (isFlying ? this.config.SPEED.ESCAPE_MULT : this.currentSpeedMult);
      
      this.x += this.velX * speed * dt;
      this.y += this.velY * speed * dt;

      this._handleBoundaries();

      if (this.velX !== 0) {
        this.faceDir = this.velX > 0 ? 1 : -1;
      }
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
