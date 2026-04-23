(function() {
  'use strict';

  class MouseTracker {
    static x = -1000;
    static y = -1000;
    static initialized = false;

    static init() {
      if (this.initialized) return;

      window.addEventListener('mousemove', (e) => {
        this.x = e.clientX;
        this.y = e.clientY;
      });
      this.initialized = true;
    }

    static getPosition() {
      return { x: this.x, y: this.y };
    }
  }

  window.MouseTracker = MouseTracker;
})();
