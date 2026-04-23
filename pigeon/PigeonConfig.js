(function() {
  'use strict';

  window.PIGEON_STATES = {
    WALKING: 'walking',
    PECKING: 'pecking',
    FLYING: 'flying',
    PAUSING: 'pausing',
    SHAKING: 'shaking'
  };

  window.PIGEON_CONFIG = {
    ZONES: {
      ESCAPE: 60,
      RETREAT: 200,
      STALK: 1000
    },
    SPEED: {
      BASE_MIN: 0.3,
      BASE_MAX: 0.7,
      ESCAPE_MULT: 5,
      STALK_MULT: 1,
      RETREAT_MULT_MAX: 4
    },
    ANIMATION: {
      PECK_DURATION: 180,
      PAUSE_MIN: 120,
      PAUSE_MAX: 300,
      SHAKE_DURATION: 60,
      FLY_MIN: 50,
      FLY_MAX: 80,
      DURATIONS: {
        walking: 6,
        pausing: 30,
        pecking: 8,
        flying:  3,
        shaking: 2  // Higher framerate (30 fps at 60Hz)
      }
    },
    PROBABILITY: {
      PECK: 0.05,
      PAUSE: 0.2,
      SHAKE: 0.05,
      STALK_FOLLOW: 0.4
    },
    DIMENSIONS: {
      WIDTH: 64,
      HEIGHT: 52,
      RESERVE_X: 70,
      RESERVE_Y: 60
    },
    PNG_ASSETS: {
      walking: [
        'graphics/walk1/walk1_0003.png',
        'graphics/walk1/walk1_0007.png',
        'graphics/walk1/walk1_0008.png',
        'graphics/walk1/walk1_0009.png',
        'graphics/walk1/walk1_0010.png',
      ],
      pecking: [
        'graphics/walk1/walk1_0007.png',
        'graphics/walk1/walk1_0003.png',
      ],
      pausing: [
        'graphics/pause1/pause1_0004.png',
        'graphics/pause1/pause1_0012.png',
        'graphics/pause1/pause1_0013.png',
        'graphics/pause1/pause1_0014.png',
        'graphics/pause1/pause1_0015.png',
        'graphics/pause1/pause1_00016.png',
        'graphics/pause1/pause1_0017.png',
        'graphics/pause1/pause1_0018.png',
      ],
      shaking: [
        'graphics/shake1/shake1_0001.png', 'graphics/shake1/shake1_0002.png', 'graphics/shake1/shake1_0003.png',
        'graphics/shake1/shake1_0004.png', 'graphics/shake1/shake1_0005.png', 'graphics/shake1/shake1_0006.png',
        'graphics/shake1/shake1_0007.png', 'graphics/shake1/shake1_0008.png', 'graphics/shake1/shake1_0009.png',
        'graphics/shake1/shake1_0010.png', 'graphics/shake1/shake1_0011.png', 'graphics/shake1/shake1_0012.png',
        'graphics/shake1/shake1_0013.png', 'graphics/shake1/shake1_0014.png', 'graphics/shake1/shake1_0015.png',
        'graphics/shake1/shake1_0016.png', 'graphics/shake1/shake1_0017.png', 'graphics/shake1/shake1_0018.png',
        'graphics/shake1/shake1_0019.png', 'graphics/shake1/shake1_0020.png', 'graphics/shake1/shake1_0021.png',
        'graphics/shake1/shake1_0022.png', 'graphics/shake1/shake1_0023.png', 'graphics/shake1/shake1_0024.png',
        'graphics/shake1/shake1_0025.png', 'graphics/shake1/shake1_0026.png', 'graphics/shake1/shake1_0027.png',
        'graphics/shake1/shake1_0028.png', 'graphics/shake1/shake1_0029.png', 'graphics/shake1/shake1_0030.png',
      ],
      flying:  []
    }
  };

  window.getPigeonAssetURL = function(path) {
    return '../media/pigeon/' + path;
  };

  window.PIGEON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52" width="64" height="52">
    <ellipse cx="9" cy="30" rx="10" ry="5" fill="#6A6A7A" transform="rotate(-10,9,30)"/>
    <ellipse cx="32" cy="28" rx="18" ry="12" fill="#919196"/>
    <ellipse cx="30" cy="27" rx="13" ry="7" fill="#AAAABC" transform="rotate(-3,30,27)"/>
    <path d="M18 30 Q30 34 42 30" stroke="#6A6A7A" stroke-width="1.5" fill="none"/>
    <path d="M19 27 Q30 31 41 27" stroke="#6A6A7A" stroke-width="1.5" fill="none"/>
    <ellipse cx="45" cy="20" rx="8" ry="10" fill="#919196"/>
    <ellipse cx="46" cy="21" rx="5" ry="6" fill="#6A9A8A" opacity="0.6"/>
    <circle cx="50" cy="12" r="9" fill="#919196"/>
    <path d="M58 10 L64 11.5 L58 13 Z" fill="#BFA060"/>
    <ellipse cx="59" cy="10" rx="3" ry="1.5" fill="#D8C080"/>
    <circle cx="55" cy="10" r="4" fill="#FF9500"/>
    <circle cx="55" cy="10" r="2.2" fill="#111"/>
    <circle cx="54" cy="9" r="0.8" fill="white"/>
    <g stroke="#BF8A28" stroke-width="2" stroke-linecap="round" fill="none">
      <line x1="34" y1="39" x2="31" y2="47"/>
      <line x1="31" y1="47" x2="25" y2="49"/>
      <line x1="31" y1="47" x2="31" y2="50"/>
      <line x1="31" y1="47" x2="35" y2="49"/>
      <line x1="40" y1="39" x2="38" y2="47"/>
      <line x1="38" y1="47" x2="32" y2="49"/>
      <line x1="38" y1="47" x2="38" y2="50"/>
      <line x1="38" y1="47" x2="42" y2="49"/>
    </g>
  </svg>`;
})();
