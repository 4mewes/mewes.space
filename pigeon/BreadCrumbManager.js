(function() {
  'use strict';

  const CRUMB_PIXEL_SHAPES = [
    [[0, 1], [1, 1], [2, 1], [3, 1]], // I
    [[1, 0], [2, 0], [1, 1], [2, 1]], // O
    [[1, 0], [0, 1], [1, 1], [2, 1]], // T
    [[1, 0], [1, 1], [1, 2], [2, 2]], // L
    [[2, 0], [2, 1], [1, 2], [2, 2]], // J
    [[1, 0], [2, 0], [0, 1], [1, 1]], // S
    [[0, 0], [1, 0], [1, 1], [2, 1]]  // Z
  ];

  class BreadCrumbManager {
    constructor(config = window.PIGEON_CONFIG) {
      this.config = config;
      this.crumbs = [];
      this.nextId = 1;
      this.layer = null;
      this.initialized = false;
      this._handleClick = this._handleClick.bind(this);
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;
      this._injectStyles();
      this._createLayer();
      window.addEventListener('click', this._handleClick, true);
    }

    update() {
      for (const crumb of this.crumbs) {
        if (crumb.status === 'available' || crumb.status === 'claimed') {
          this._updateCrumbColor(crumb);
        }
      }
      this.crumbs = this.crumbs.filter(crumb => crumb.status !== 'removed');
    }

    getNearestAvailableCrumb(x, y, radius) {
      let nearest = null;
      let nearestDist = Infinity;

      for (const crumb of this.crumbs) {
        if (crumb.status !== 'available') continue;
        const dx = crumb.x - x;
        const dy = crumb.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius && dist < nearestDist) {
          nearest = { crumb, dist, dx, dy };
          nearestDist = dist;
        }
      }

      return nearest;
    }

    claimCrumb(id) {
      const crumb = this.getCrumb(id);
      if (!crumb || crumb.status !== 'available') return null;
      crumb.status = 'claimed';
      if (crumb.element) crumb.element.classList.add('claimed');
      return crumb;
    }

    eatCrumb(id) {
      const crumb = this.getCrumb(id);
      if (!crumb || crumb.status === 'eaten' || crumb.status === 'removed') return;
      crumb.status = 'eaten';
      if (crumb.element) {
        crumb.element.classList.add('eaten');
        setTimeout(() => this._removeCrumb(crumb), 180);
      } else {
        this._removeCrumb(crumb);
      }
    }

    getCrumb(id) {
      return this.crumbs.find(crumb => crumb.id === id) || null;
    }

    getDebugCrumbs() {
      return this.crumbs.filter(crumb => crumb.status === 'available' || crumb.status === 'claimed');
    }

    hasAvailableCrumbs() {
      return this.crumbs.some(crumb => crumb.status === 'available');
    }

    destroy() {
      window.removeEventListener('click', this._handleClick, true);
      if (this.layer && this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
      this.layer = null;
      this.crumbs = [];
      this.initialized = false;
    }

    _handleClick(event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      this._createCrumb(event.clientX, event.clientY);
    }

    _createCrumb(clientX, clientY) {
      if (!document.body) return;
      this._createLayer();

      const { DROP_DISTANCE, MAX_ACTIVE, SIZE } = this.config.BREAD_CRUMBS;
      const halfSize = SIZE / 2;
      const x = Math.max(halfSize, Math.min(window.innerWidth - halfSize, clientX));
      const startTop = Math.max(halfSize, Math.min(window.innerHeight - halfSize, clientY));
      const finalTop = Math.max(halfSize, Math.min(window.innerHeight - halfSize, startTop + DROP_DISTANCE));
      const crumb = {
        id: this.nextId++,
        x,
        y: window.innerHeight - finalTop,
        screenY: finalTop,
        status: 'available',
        element: document.createElement('div')
      };

      crumb.element.className = 'pigeon-ext-bread-crumb';
      crumb.element.style.left = `${x - halfSize}px`;
      crumb.element.style.top = `${startTop - halfSize}px`;
      crumb.element.style.setProperty('--pigeon-crumb-drop', `${finalTop - startTop}px`);
      this._updateCrumbColor(crumb);
      crumb.element.style.setProperty('--pigeon-crumb-pixels', this._getRandomPixelShape());
      this.layer.appendChild(crumb.element);
      this.crumbs.push(crumb);
      this._trimCrumbs(MAX_ACTIVE);

      requestAnimationFrame(() => {
        if (crumb.element) crumb.element.classList.add('dropped');
      });
    }

    _trimCrumbs(maxActive) {
      while (this.crumbs.length > maxActive) {
        const crumb = this.crumbs.shift();
        this._removeCrumb(crumb);
      }
    }

    _removeCrumb(crumb) {
      crumb.status = 'removed';
      if (crumb.element && crumb.element.parentNode) crumb.element.parentNode.removeChild(crumb.element);
      crumb.element = null;
    }

    _getRandomPixelShape() {
      const { BLOCK_SIZE } = this.config.BREAD_CRUMBS;
      const shape = CRUMB_PIXEL_SHAPES[Math.floor(Math.random() * CRUMB_PIXEL_SHAPES.length)];
      const shadows = [];

      for (const [shapeX, shapeY] of shape) {
        for (let y = 0; y < BLOCK_SIZE; y++) {
          for (let x = 0; x < BLOCK_SIZE; x++) {
            shadows.push(`${shapeX * BLOCK_SIZE + x}px ${shapeY * BLOCK_SIZE + y}px var(--pigeon-crumb-color)`);
          }
        }
      }

      return shadows.join(', ');
    }

    _getCrumbColor(clientX, clientY) {
      const color = this._getBackgroundColorAtPoint(clientX, clientY);
      if (!color) return '#000';

      const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
      const threshold = this.config.BREAD_CRUMBS.DARK_BACKGROUND_LUMINANCE || 45;
      return luminance <= threshold ? '#fff' : '#000';
    }

    _updateCrumbColor(crumb) {
      if (!crumb.element) return;
      crumb.element.style.setProperty('--pigeon-crumb-color', this._getCrumbColor(crumb.x, crumb.screenY));
    }

    _getBackgroundColorAtPoint(clientX, clientY) {
      let element = document.elementFromPoint(clientX, clientY);

      while (element && element !== document.documentElement) {
        const color = this._parseCssColor(window.getComputedStyle(element).backgroundColor);
        if (color && color.a > 0.05) return color;
        element = element.parentElement;
      }

      const bodyColor = document.body ? this._parseCssColor(window.getComputedStyle(document.body).backgroundColor) : null;
      if (bodyColor && bodyColor.a > 0.05) return bodyColor;

      const rootColor = this._parseCssColor(window.getComputedStyle(document.documentElement).backgroundColor);
      if (rootColor && rootColor.a > 0.05) return rootColor;

      return { r: 255, g: 255, b: 255, a: 1 };
    }

    _parseCssColor(value) {
      if (!value || value === 'transparent') return null;

      const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
      if (!rgb) return null;

      const parts = rgb[1]
        .replace(/\s*\/\s*/, ' ')
        .split(/[,\s]+/)
        .map(part => part.trim())
        .filter(Boolean);
      if (parts.length < 3) return null;

      return {
        r: Number(parts[0]),
        g: Number(parts[1]),
        b: Number(parts[2]),
        a: parts.length >= 4 ? Number(parts[3]) : 1
      };
    }

    _createLayer() {
      if (this.layer || !document.body) return;
      this.layer = document.createElement('div');
      this.layer.className = 'pigeon-ext-bread-layer';
      document.body.appendChild(this.layer);
    }

    _injectStyles() {
      if (document.getElementById('pigeon-styles-bread-crumbs')) return;
      const style = document.createElement('style');
      style.id = 'pigeon-styles-bread-crumbs';
      const { DROP_DURATION_MS } = this.config.BREAD_CRUMBS;
      style.textContent = `
        .pigeon-ext-bread-layer {
          position: fixed;
          inset: 0;
          z-index: 2147483645;
          pointer-events: none;
          user-select: none;
        }
        .pigeon-ext-bread-crumb {
          position: fixed;
          width: 1px;
          height: 1px;
          background: transparent;
          box-shadow: var(--pigeon-crumb-pixels);
          opacity: 0;
          image-rendering: pixelated;
          transform: translate3d(0, -4px, 0);
          transition: transform ${DROP_DURATION_MS}ms cubic-bezier(0.18, 0.82, 0.2, 1), opacity 100ms ease-out;
          will-change: transform, opacity;
        }
        .pigeon-ext-bread-crumb.dropped {
          opacity: 1;
          transform: translate3d(0, var(--pigeon-crumb-drop), 0);
        }
        .pigeon-ext-bread-crumb.claimed {
          opacity: 0.85;
        }
        .pigeon-ext-bread-crumb.eaten {
          opacity: 0;
          transform: translate3d(0, var(--pigeon-crumb-drop), 0) scale(0);
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  window.BreadCrumbManager = BreadCrumbManager;
})();
