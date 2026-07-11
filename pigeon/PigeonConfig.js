(function() {
  'use strict';

  window.PIGEON_STATES = {
    WALKING: 'walking',
    PECKING: 'pecking',
    FLYING: 'flying',
    SPAWNING: 'spawning',
    LANDING: 'landing',
    COOLDOWN: 'cooldown',
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
      ESCAPE_MULT: 18,
      STALK_MULT: 1,
      RETREAT_MULT_MAX: 4
    },
    BREAD_CRUMBS: {
      ATTRACTION_RADIUS: 350,
      EAT_RADIUS: 5,
      DROP_DISTANCE: 24,
      DROP_DURATION_MS: 180,
      MAX_ACTIVE: 12,
      SIZE: 12,
      BLOCK_SIZE: 3,
      DARK_BACKGROUND_LUMINANCE: 45
    },
    ANIMATION: {
      PECK_DURATION: 180,
      PECK_LOOP_WAIT_MIN: 18,
      PECK_LOOP_WAIT_MAX: 120,
      PAUSE_MIN: 120,
      PAUSE_MAX: 300,
      PAUSE_FRAME_WAIT_MIN: 45,
      PAUSE_FRAME_WAIT_MAX: 120,
      SHAKE_DURATION: 60,
      FLY_MIN: 50,
      FLY_MAX: 80,
      FLY_START_FRAME_COUNT: 3,
      // Only the first few in-flight frames loop; later frames stay listed for packaging/source continuity but are too jumpy for the active loop.
      FLY_LOOP_FRAME_COUNT: 3,
      LANDING_FRAME_DURATION: 3,
      RESPAWN_COOLDOWN_MIN: 120,
      RESPAWN_COOLDOWN_MAX: 300,
      DURATIONS: {
        walking: 6,
        pausing: 30,
        pecking: 8,
        flying: 7,
        shaking: 2  // Higher framerate (30 fps at 60Hz)
      }
    },
    PROBABILITY: {
      PAUSE: 0.2,
      SHAKE: 0,
      STALK_FOLLOW: 0.4
    },
    DIMENSIONS: {
      WIDTH: 64,
      HEIGHT: 114,
      RESERVE_X: 70,
      RESERVE_Y: 120
    },
    PNG_RENDERING: {
      WIDTH: 76,
      HEIGHT: 57,
      FLY_WIDTH: 120,
      FLY_HEIGHT: 120,
      LANDING_Y_OFFSET: 27
    },
    PNG_ASSETS: {
      walking: [
        'graphics/normalized/walk1/walk1_0003.png',
        'graphics/normalized/walk1/walk1_0007.png',
        'graphics/normalized/walk1/walk1_0008.png',
        'graphics/normalized/walk1/walk1_0009.png',
        'graphics/normalized/walk1/walk1_0010.png',
      ],
      pecking: [
        'graphics/normalized/peck/peck_0001.png', // 0: start/end
        'graphics/normalized/peck/peck_0023.png', // 1: transition
        'graphics/normalized/peck/peck_0027.png', // 2: loop rest
        'graphics/normalized/peck/peck_0032.png', // 3: loop
        'graphics/normalized/peck/peck_0049.png', // 4: rare loop
      ],
      pausing: [
        'graphics/normalized/pause1/pause1_0017.png',
        'graphics/normalized/pause1/pause1_0018.png',
      ],
      shaking: [],
      flying: [
        'graphics/normalized/fly/pigeon-soar_0034.png',
        'graphics/normalized/fly/pigeon-soar_0047.png',
        'graphics/normalized/fly/pigeon-soar_0049.png',
        'graphics/normalized/fly/pigeon-soar_0052.png',
        'graphics/normalized/fly/pigeon-soar_0053.png',
        'graphics/normalized/fly/pigeon-soar_0054.png',
        'graphics/normalized/fly/pigeon-soar_0055.png',
        'graphics/normalized/fly/pigeon-soar_0056.png',
        'graphics/normalized/fly/pigeon-soar_0057.png',
      ]
    }
  };

  window.getPigeonAssetURL = function(path) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    return '../media/pigeon/' + path;
  };
})();
