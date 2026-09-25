// 2D Raycasting with 3D Column Projection, Adaptive LOD, Gravitational Lensing, Fish Eye & Order-of-Magnitude Sliders
const SETTINGS_KEY = 'raycasting_engine_settings';

const defaultSettings = {
  splitPercent: 50,
  fov: 46,
  wallCount: 6,
  density: 1.12,
  lodThreshold: 350,
  maxChunk: 8,
  closeColor: '#ff731a',
  farColor: '#1e0800',
  globalCurve: 0,
  gravityMass: 350,
  singularityRadius: 15,
  escapeFactor: 0.2,
  singularityX: 0.65,
  singularityY: 0.45,
  fishEye: 0.0,
  overflowMode: 'transparent',
  overflowOpacity: 0.35,
  showHUD: true,
  chromaPos: 0.50,
  linkFishEyeChroma: true,
  opacityStart: 0.20,
  opacityEnd: 0.85,
  magnitude: 1
};

var settings = Object.assign({}, defaultSettings);
var colorCloseRgb = { r: 255, g: 115, b: 26 };
var colorFarRgb = { r: 30, g: 8, b: 0 };
window.colorCloseRgb = colorCloseRgb;
window.colorFarRgb = colorFarRgb;

var walls = [];
var particle;
var singularity;
var isDraggingSingularity = false;

const rotationOffset = 0.025;
const movingOffset = 3.0;

var sceneW;
var sceneH;     // 2D Map Height (Top half)
var scene3DH;   // 3D Projection Height (Bottom half)
var eyesDist = [];

var sliderFOV;
var sliderDensity;
var sliderThreshold;
var sliderMaxChunk;
var sliderSplit;
var sliderCurve;
var sliderGravity;
var sliderFishEye;
var sliderRadius;
var sliderEscape;
var sliderOverflow;

var allEngineSliders = [];
var selectedSliderIndex = 0;
var autoSlideState = {
  active: false,
  direction: 0,
  sliderObj: null,
  intervalId: null
};
var tapHistory = {
  ArrowLeft: [],
  ArrowRight: []
};

const orderMagnitudes = [0.001, 0.01, 0.1, 1, 10, 100];
var sliderMagnitude = 1;

var averageFPS = 60;
var currentSliceCount = 0;

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = Object.assign({}, defaultSettings, parsed);
    }
  } catch (e) {
    console.warn('Failed to load settings from cache, using defaults:', e);
    settings = Object.assign({}, defaultSettings);
  }

  // Ensure splitPercent is a valid multiple of 10 between 10 and 90
  if (!settings.splitPercent || settings.splitPercent < 10 || settings.splitPercent > 90) {
    settings.splitPercent = 50;
  } else {
    settings.splitPercent = Math.round(settings.splitPercent / 10) * 10;
  }

  if (settings.globalCurve === undefined) settings.globalCurve = defaultSettings.globalCurve;
  if (settings.gravityMass === undefined) settings.gravityMass = defaultSettings.gravityMass;
  if (settings.singularityRadius === undefined) settings.singularityRadius = defaultSettings.singularityRadius;
  if (settings.escapeFactor === undefined) settings.escapeFactor = defaultSettings.escapeFactor;
  if (settings.singularityX === undefined) settings.singularityX = defaultSettings.singularityX;
  if (settings.singularityY === undefined) settings.singularityY = defaultSettings.singularityY;
  if (settings.fishEye === undefined) settings.fishEye = defaultSettings.fishEye;
  if (settings.overflowMode === undefined) {
    if (settings.overflowOpacity !== undefined && settings.overflowOpacity >= 0.99) {
      settings.overflowMode = 'solid';
    } else {
      settings.overflowMode = 'transparent';
    }
  }
  if (settings.overflowOpacity === undefined) settings.overflowOpacity = (settings.overflowMode === 'solid' ? 1.0 : 0.35);
  if (settings.showHUD === undefined) settings.showHUD = true;
  if (settings.chromaPos === undefined) settings.chromaPos = defaultSettings.chromaPos;
  if (settings.linkFishEyeChroma === undefined) settings.linkFishEyeChroma = defaultSettings.linkFishEyeChroma;
  if (settings.opacityStart === undefined) settings.opacityStart = defaultSettings.opacityStart;
  if (settings.opacityEnd === undefined) settings.opacityEnd = defaultSettings.opacityEnd;
  settings.opacityStart = constrain(settings.opacityStart, 0.0, 0.98);
  settings.opacityEnd = constrain(settings.opacityEnd, settings.opacityStart + 0.01, 1.0);
  if (settings.magnitude === undefined || !orderMagnitudes.includes(settings.magnitude)) {
    sliderMagnitude = 1;
  } else {
    sliderMagnitude = settings.magnitude;
  }

  colorCloseRgb = hexToRgb(settings.closeColor || '#ff731a');
  colorFarRgb = hexToRgb(settings.farColor || '#1e0800');
  window.colorCloseRgb = colorCloseRgb;
  window.colorFarRgb = colorFarRgb;
}

let toastTimeout = null;
function showSaveToast(msg = 'Settings & Game State Saved!') {
  const toast = document.getElementById('save-toast');
  const toastMsg = document.getElementById('save-toast-msg');
  if (!toast) return;
  if (toastMsg) toastMsg.textContent = msg;
  toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
}

function saveGameState(showFeedback = true) {
  try {
    // 1. Sync current active slider and engine settings
    if (sliderSplit) settings.splitPercent = sliderSplit.value();
    if (sliderFOV) settings.fov = sliderFOV.value();
    if (sliderDensity) settings.density = sliderDensity.value();
    if (sliderThreshold) settings.lodThreshold = sliderThreshold.value();
    if (sliderMaxChunk) settings.maxChunk = sliderMaxChunk.value();
    if (sliderCurve) settings.globalCurve = sliderCurve.value();
    if (sliderGravity) settings.gravityMass = sliderGravity.value();
    if (sliderFishEye) settings.fishEye = sliderFishEye.value();
    if (sliderRadius) settings.singularityRadius = sliderRadius.value();
    if (sliderEscape) settings.escapeFactor = sliderEscape.value();
    if (sliderOverflow) {
      const v = sliderOverflow.value();
      settings.overflowOpacity = v;
      settings.overflowMode = v >= 0.5 ? 'solid' : 'transparent';
    }
    settings.magnitude = sliderMagnitude;

    // 2. Capture player state (normalized coordinates resilient to resize + heading)
    if (particle && particle.pos && sceneW > 0 && sceneH > 0) {
      settings.playerX = particle.pos.x / sceneW;
      settings.playerY = particle.pos.y / sceneH;
      settings.playerHeading = particle.heading;
    }

    // 3. Capture singularity position
    if (singularity && sceneW > 0 && sceneH > 0) {
      settings.singularityX = singularity.x / sceneW;
      settings.singularityY = singularity.y / sceneH;
      settings.gravityMass = singularity.mass;
      settings.singularityRadius = singularity.radius;
    }

    // 4. Capture walls (interior obstacles 4..N normalized)
    if (walls && walls.length >= 4 && sceneW > 0 && sceneH > 0) {
      const sw = [];
      for (let i = 4; i < walls.length; i++) {
        if (walls[i] && walls[i].a && walls[i].b) {
          sw.push({
            x1: walls[i].a.x / sceneW,
            y1: walls[i].a.y / sceneH,
            x2: walls[i].b.x / sceneW,
            y2: walls[i].b.y / sceneH
          });
        }
      }
      settings.savedWalls = sw;
      settings.wallCount = walls.length;
    }

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    if (showFeedback) {
      showSaveToast('💾 Settings & Game State Saved!');
      console.log('Game state and settings saved successfully via Ctrl+S.');
    }
  } catch (e) {
    console.warn('Failed to save game state:', e);
    if (showFeedback) {
      showSaveToast('⚠️ Failed to Save Game State');
    }
  }
}

function saveSettings() {
  try {
    const dataToSave = Object.assign({}, settings, {
      splitPercent: settings.splitPercent,
      fov: settings.fov,
      wallCount: settings.wallCount,
      density: settings.density,
      lodThreshold: settings.lodThreshold,
      maxChunk: settings.maxChunk,
      closeColor: settings.closeColor,
      farColor: settings.farColor,
      globalCurve: settings.globalCurve,
      gravityMass: settings.gravityMass,
      singularityRadius: settings.singularityRadius,
      escapeFactor: settings.escapeFactor,
      singularityX: settings.singularityX,
      singularityY: settings.singularityY,
      fishEye: settings.fishEye,
      overflowMode: settings.overflowMode,
      overflowOpacity: settings.overflowOpacity,
      showHUD: (settings.showHUD !== false),
      chromaPos: settings.chromaPos,
      linkFishEyeChroma: (settings.linkFishEyeChroma !== false),
      opacityStart: settings.opacityStart,
      opacityEnd: settings.opacityEnd,
      magnitude: sliderMagnitude
    });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('Failed to cache settings:', e);
  }
}

function updateDimensions() {
  const totalW = window.innerWidth || windowWidth;
  const totalH = window.innerHeight || windowHeight;

  sceneW = totalW;
  const pct = constrain(settings.splitPercent, 10, 90) / 100;
  sceneH = Math.round(totalH * pct);
  scene3DH = totalH - sceneH;
}

function styleSlider(s) {
  s.style('width', '160px');
  s.style('z-index', '50');
  s.style('position', 'absolute');
  s.style('accent-color', '#37ffe1');
  s.style('cursor', 'pointer');
}

function setup() {
  loadSettings();
  updateDimensions();
  createCanvas(sceneW, sceneH + scene3DH);

  particle = new Particle();
  if (settings.playerX !== undefined && settings.playerY !== undefined) {
    particle.pos.set(
      constrain(settings.playerX * sceneW, 15, sceneW - 15),
      constrain(settings.playerY * sceneH, 15, sceneH - 15)
    );
  } else {
    particle.pos.set(sceneW / 2, sceneH / 2);
  }
  if (settings.playerHeading !== undefined) {
    particle.heading = settings.playerHeading;
  }
  particle.updateFOV(settings.fov);
  particle.updateDensity(1 / settings.density);
  if (settings.playerHeading !== undefined) {
    particle.rotate(0);
  }

  // Singularity (Black hole) positioned in top 2D map
  singularity = new Singularity(
    sceneW * (settings.singularityX !== undefined ? settings.singularityX : 0.65),
    sceneH * (settings.singularityY !== undefined ? settings.singularityY : 0.45),
    settings.gravityMass,
    settings.singularityRadius !== undefined ? settings.singularityRadius : 15
  );

  initBoundaries();
  initWalls(settings.wallCount);

  // Control 1 (Key 1): FOV (0° to 721°)
  sliderFOV = createSlider(0, 721, settings.fov, 1);
  sliderFOV.position(10, 5);
  styleSlider(sliderFOV);
  sliderFOV.input(onFOVChanged);

  // Control 2 (Key 2): Ray Density (0.1 to 3.0 rays per degree)
  sliderDensity = createSlider(0.1, 3.0, settings.density, 0.05);
  sliderDensity.position(10, 25);
  styleSlider(sliderDensity);
  sliderDensity.input(onDensityChanged);

  // Control 3 (Key 3): LOD Distance Threshold (100 to 2500)
  sliderThreshold = createSlider(100, 2500, settings.lodThreshold, 25);
  sliderThreshold.position(10, 45);
  styleSlider(sliderThreshold);
  sliderThreshold.input(onLODChanged);

  // Control 4 (Key 4): Max Chunk Size (1x - 16x width)
  sliderMaxChunk = createSlider(1, 16, settings.maxChunk, 1);
  sliderMaxChunk.position(10, 65);
  styleSlider(sliderMaxChunk);
  sliderMaxChunk.input(onLODChanged);

  // Control 5 (Key 5): Screen Split (10% to 90%)
  sliderSplit = createSlider(10, 90, settings.splitPercent, 10);
  sliderSplit.position(10, 85);
  styleSlider(sliderSplit);
  sliderSplit.input(onSplitChanged);

  // Control 6 (Key 6): Global Space Curvature (-60° to +60°)
  sliderCurve = createSlider(-60, 60, settings.globalCurve, 1);
  sliderCurve.position(10, 105);
  styleSlider(sliderCurve);
  sliderCurve.input(onCurveChanged);

  // Control 7 (Key 7): Black Hole Gravity Mass (0 to 3000)
  sliderGravity = createSlider(0, 3000, settings.gravityMass, 10);
  sliderGravity.position(10, 125);
  styleSlider(sliderGravity);
  sliderGravity.input(onGravityChanged);

  // Control 8 (Key 8): Fish Eye Distortion (0.00 to 2.00)
  sliderFishEye = createSlider(0.0, 2.0, settings.fishEye, 0.05);
  sliderFishEye.position(10, 145);
  styleSlider(sliderFishEye);
  sliderFishEye.input(onFishEyeChanged);

  // Control 9 (Key 9): Singularity / Event Horizon Radius (0 to 40)
  sliderRadius = createSlider(0, 40, settings.singularityRadius, 1);
  sliderRadius.position(10, 165);
  styleSlider(sliderRadius);
  sliderRadius.input(onRadiusChanged);

  // Control 10 (Key 0): Ray Inclination / Outward Spiral Escape (0.00 to 1.00)
  sliderEscape = createSlider(0.0, 1.0, settings.escapeFactor, 0.05);
  sliderEscape.position(10, 185);
  styleSlider(sliderEscape);
  sliderEscape.input(onEscapeChanged);

  // Control 11 (Key -): Top Wall Overflow Mode (0 = Transparent Fade Out, 1 = Solid 100% Opaque)
  const initialOverflowVal = settings.overflowMode === 'solid' ? 1 : 0;
  sliderOverflow = createSlider(0, 1, initialOverflowVal, 1);
  sliderOverflow.position(10, 205);
  styleSlider(sliderOverflow);
  sliderOverflow.input(onOverflowChanged);

  updateSliderSteps();
  initEngineSliders();

  window.addEventListener('resize', windowResized);
  window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
  initModalListeners();
  setHUDVisible(settings.showHUD !== false);
}

function setSliderMagnitude(mag) {
  if (!orderMagnitudes.includes(mag)) return;
  sliderMagnitude = mag;
  settings.magnitude = mag;
  updateSliderSteps();
  saveSettings();
  const magBadge = document.getElementById('modal-step-badge');
  if (magBadge) magBadge.textContent = `${sliderMagnitude}x`;
}

function updateSliderSteps() {
  const sliders = [
    sliderFOV, sliderDensity, sliderThreshold, sliderMaxChunk,
    sliderSplit, sliderCurve, sliderGravity, sliderFishEye, sliderRadius, sliderEscape
  ];

  for (let s of sliders) {
    if (s && s.elt) {
      // Set to 'any' so browser native sanitization NEVER snaps or resets values to min!
      s.elt.step = 'any';
    }
  }

  // Slider 11 (Overflow) is a discrete 2-mode toggle (0 = Transparent, 1 = Solid)
  if (sliderOverflow && sliderOverflow.elt) {
    sliderOverflow.elt.step = '1';
    sliderOverflow.elt.min = '0';
    sliderOverflow.elt.max = '1';
  }

  // Update modal inputs to 'any' as well
  const modalSliders = [
    'modal-split-slider', 'modal-walls-slider', 'modal-curve-slider', 'modal-gravity-slider',
    'modal-fisheye-slider', 'modal-chroma-pos-slider', 'modal-radius-slider', 'modal-escape-slider'
  ];
  for (let id of modalSliders) {
    const el = document.getElementById(id);
    if (el) {
      el.step = 'any';
    }
  }

  const modalOverflowEl = document.getElementById('modal-overflow-slider');
  if (modalOverflowEl) {
    modalOverflowEl.step = '1';
    modalOverflowEl.min = '0';
    modalOverflowEl.max = '1';
  }

  const magBadge = document.getElementById('modal-step-badge');
  if (magBadge) magBadge.textContent = `${sliderMagnitude}x`;
}

function initEngineSliders() {
  allEngineSliders = [
    { index: 0, keyTag: '1', name: 'FOV', slider: sliderFOV, base: 1, onInput: onFOVChanged },
    { index: 1, keyTag: '2', name: 'Density', slider: sliderDensity, base: 0.05, onInput: onDensityChanged },
    { index: 2, keyTag: '3', name: 'LOD Dist', slider: sliderThreshold, base: 25, onInput: onLODChanged },
    { index: 3, keyTag: '4', name: 'Max Chunk', slider: sliderMaxChunk, base: 1, onInput: onLODChanged },
    { index: 4, keyTag: '5', name: 'Split', slider: sliderSplit, base: 10, onInput: onSplitChanged },
    { index: 5, keyTag: '6', name: 'Curve', slider: sliderCurve, base: 1, onInput: onCurveChanged },
    { index: 6, keyTag: '7', name: 'Gravity', slider: sliderGravity, base: 10, onInput: onGravityChanged },
    { index: 7, keyTag: '8', name: 'Fish Eye', slider: sliderFishEye, base: 0.05, onInput: onFishEyeChanged },
    { index: 8, keyTag: '9', name: 'Singularity', slider: sliderRadius, base: 1, onInput: onRadiusChanged },
    { index: 9, keyTag: '0', name: 'Escape Drift', slider: sliderEscape, base: 0.05, onInput: onEscapeChanged },
    { index: 10, keyTag: '-', name: 'Top Overflow', slider: sliderOverflow, base: 1, onInput: onOverflowChanged }
  ];

  allEngineSliders.forEach((item, idx) => {
    if (item.slider && item.slider.elt) {
      if (idx !== 10) {
        item.slider.elt.step = 'any';
      }
      item.slider.elt.addEventListener('focus', () => { selectedSliderIndex = idx; });
      item.slider.elt.addEventListener('mousedown', () => {
        stopAutoSlide();
        selectedSliderIndex = idx;
      });
      item.slider.elt.addEventListener('input', () => {
        stopAutoSlide();
        selectedSliderIndex = idx;
      });
    }
  });
}

function selectSliderByIndex(idx) {
  if (idx < 0 || idx >= allEngineSliders.length) return;
  stopAutoSlide();
  selectedSliderIndex = idx;
  const target = allEngineSliders[idx];
  if (target && target.slider && target.slider.elt) {
    target.slider.elt.focus();
  }
}

function setWallCount(newWallCount) {
  newWallCount = Math.max(4, parseInt(newWallCount, 10) || 4);
  settings.wallCount = newWallCount;
  saveSettings();

  if (newWallCount > walls.length) {
    for (let i = walls.length; i < newWallCount; i++) {
      let x1 = random(sceneW);
      let x2 = random(sceneW);
      let y1 = random(sceneH);
      let y2 = random(sceneH);
      walls[i] = new Boundary(x1, y1, x2, y2);
    }
  } else if (newWallCount < walls.length) {
    while (walls.length > newWallCount) {
      walls.pop();
    }
  }

  const modalWallSlider = document.getElementById('modal-walls-slider');
  const modalWallLabel = document.getElementById('modal-walls-label');
  if (modalWallSlider) modalWallSlider.value = newWallCount;
  if (modalWallLabel) modalWallLabel.textContent = `${newWallCount} Walls`;
}

function changeWallCount(delta) {
  const current = parseInt(settings.wallCount, 10) || 6;
  setWallCount(current + delta);
}

function formatOverflowLabel(modeOrVal) {
  if (modeOrVal === 'solid' || modeOrVal === 1 || modeOrVal === '1') {
    return 'Solid 100% Opaque';
  }
  return 'Transparent (Fade Out)';
}

function setOverflowMode(mode) {
  const newMode = (mode === 'solid') ? 'solid' : 'transparent';
  settings.overflowMode = newMode;
  settings.overflowOpacity = (newMode === 'solid') ? 1.0 : 0.35;
  if (sliderOverflow) {
    sliderOverflow.value(newMode === 'solid' ? 1 : 0);
  }
  saveSettings();
  syncOverflowUI();
}

function toggleOverflowMode() {
  const newMode = (settings.overflowMode === 'solid') ? 'transparent' : 'solid';
  setOverflowMode(newMode);
}

function syncOverflowUI() {
  const isSolid = (settings.overflowMode === 'solid');
  const labelText = isSolid ? 'Solid 100% Opaque' : 'Transparent (Fade Out)';

  const modalOverflowLabel = document.getElementById('modal-overflow-label');
  if (modalOverflowLabel) {
    modalOverflowLabel.textContent = labelText;
  }

  const modalOverflowSlider = document.getElementById('modal-overflow-slider');
  if (modalOverflowSlider) {
    modalOverflowSlider.value = isSolid ? 1 : 0;
  }

  const modalOverflowCheckbox = document.getElementById('modal-overflow-checkbox');
  if (modalOverflowCheckbox) {
    modalOverflowCheckbox.checked = isSolid;
  }

  document.querySelectorAll('.btn-overflow-mode').forEach(btn => {
    const mode = btn.getAttribute('data-mode');
    if (mode === settings.overflowMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  syncOpacityIntervalUI();
}

function syncOpacityIntervalUI() {
  const startSlider = document.getElementById('modal-opacity-start-slider');
  const endSlider = document.getElementById('modal-opacity-end-slider');
  const highlight = document.getElementById('modal-opacity-highlight-bar');
  const intervalLabel = document.getElementById('modal-opacity-interval-label');
  const statsLabel = document.getElementById('modal-opacity-stats-label');
  const container = document.getElementById('modal-opacity-gradient-container');

  const sVal = Math.round((settings.opacityStart !== undefined ? settings.opacityStart : 0.20) * 100);
  const eVal = Math.round((settings.opacityEnd !== undefined ? settings.opacityEnd : 0.85) * 100);

  if (startSlider) startSlider.value = sVal;
  if (endSlider) endSlider.value = eVal;
  if (highlight) {
    highlight.style.left = `${sVal}%`;
    highlight.style.width = `${Math.max(1, eVal - sVal)}%`;
  }

  const span = eVal - sVal;
  const mid = ((sVal + eVal) / 2).toFixed(1);
  const isSolid = (settings.overflowMode === 'solid');

  if (intervalLabel) {
    intervalLabel.textContent = `Fade: ${sVal}% → ${eVal}%${isSolid ? ' (Solid Active)' : ''}`;
  }
  if (statsLabel) {
    statsLabel.textContent = `Position: ${mid}% | Sharpness: ${span}% span`;
  }
  if (container) {
    container.style.opacity = isSolid ? '0.6' : '1.0';
  }
}

function setHUDVisible(visible) {
  settings.showHUD = !!visible;
  const displayVal = settings.showHUD ? '' : 'none';

  if (allEngineSliders && allEngineSliders.length) {
    for (let item of allEngineSliders) {
      if (item && item.slider && item.slider.elt) {
        item.slider.elt.style.display = displayVal;
      }
    }
  }

  const navBar = document.querySelector('.nav-bar');
  const settingsBtn = document.getElementById('btn-open-settings');
  if (navBar) navBar.style.display = displayVal;
  if (settingsBtn) settingsBtn.style.display = displayVal;

  const hudCheckbox = document.getElementById('modal-hud-checkbox');
  if (hudCheckbox) hudCheckbox.checked = settings.showHUD;
  const hudLabel = document.getElementById('modal-hud-label');
  if (hudLabel) hudLabel.textContent = settings.showHUD ? 'Visible (Press H)' : 'Hidden (Press H)';

  saveSettings();
}

function toggleHUD() {
  setHUDVisible(!settings.showHUD);
  showSaveToast(settings.showHUD ? '👁️ HUD & Controls Displayed' : '🙈 HUD & Controls Hidden (Press H to restore)');
}

function getEffectiveChromaPos() {
  if (settings.linkFishEyeChroma !== false) {
    const fe = (typeof sliderFishEye !== 'undefined' && sliderFishEye) ? sliderFishEye.value() : (settings.fishEye || 0);
    return +(0.45 + fe * 0.20).toFixed(2);
  }
  return settings.chromaPos !== undefined ? settings.chromaPos : 0.50;
}

function syncChromaUI() {
  const isLinked = (settings.linkFishEyeChroma !== false);
  const pos = getEffectiveChromaPos();

  const linkCb = document.getElementById('modal-link-chroma-checkbox');
  if (linkCb) linkCb.checked = isLinked;

  const posSlider = document.getElementById('modal-chroma-pos-slider');
  if (posSlider) {
    posSlider.value = pos;
    posSlider.disabled = isLinked;
    posSlider.style.opacity = isLinked ? '0.6' : '1.0';
  }

  const posLabel = document.getElementById('modal-chroma-pos-label');
  if (posLabel) {
    posLabel.textContent = `${Math.round(pos * 100)}% Depth${isLinked ? ' (Merged)' : ''}`;
  }
}

function onOverflowChanged() {
  if (!sliderOverflow) return;
  const val = parseFloat(sliderOverflow.value());
  const newMode = val >= 0.5 ? 'solid' : 'transparent';
  setOverflowMode(newMode);
}

function getActiveSliderObj() {
  if (document.activeElement) {
    const idx = allEngineSliders.findIndex(s => s.slider && s.slider.elt === document.activeElement);
    if (idx !== -1) {
      selectedSliderIndex = idx;
      return allEngineSliders[idx];
    }
  }
  if (selectedSliderIndex < 0 || selectedSliderIndex >= allEngineSliders.length) {
    selectedSliderIndex = 0;
  }
  return allEngineSliders[selectedSliderIndex];
}

function stepSlider(sliderObj, direction) {
  if (!sliderObj || !sliderObj.slider || !sliderObj.slider.elt) return;
  if (sliderObj.index === 10) {
    const newMode = direction > 0 ? 'solid' : 'transparent';
    setOverflowMode(newMode);
    return;
  }
  const elt = sliderObj.slider.elt;
  const minVal = parseFloat(elt.min);
  const maxVal = parseFloat(elt.max);
  const step = Math.max(0.001, +(sliderObj.base * sliderMagnitude).toPrecision(4));
  let currVal = parseFloat(elt.value);

  let nextVal = currVal + direction * step;
  if (nextVal >= maxVal) {
    nextVal = maxVal;
    if (autoSlideState.active && autoSlideState.sliderObj === sliderObj) {
      stopAutoSlide();
    }
  } else if (nextVal <= minVal) {
    nextVal = minVal;
    if (autoSlideState.active && autoSlideState.sliderObj === sliderObj) {
      stopAutoSlide();
    }
  }

  const stepStr = step.toString();
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  nextVal = parseFloat(nextVal.toFixed(Math.max(2, decimals)));

  sliderObj.slider.value(nextVal);
  elt.value = nextVal;
  if (sliderObj.onInput) {
    sliderObj.onInput();
  }
}

function startAutoSlide(sliderObj, direction) {
  stopAutoSlide();
  if (!sliderObj) return;

  autoSlideState.active = true;
  autoSlideState.direction = direction;
  autoSlideState.sliderObj = sliderObj;

  autoSlideState.intervalId = setInterval(() => {
    if (!autoSlideState.active) return;
    stepSlider(sliderObj, direction);
  }, 50);
}

function stopAutoSlide() {
  if (autoSlideState.active || autoSlideState.intervalId) {
    autoSlideState.active = false;
    autoSlideState.direction = 0;
    if (autoSlideState.intervalId) {
      clearInterval(autoSlideState.intervalId);
      autoSlideState.intervalId = null;
    }
  }
}

function onGlobalKeyDown(e) {
  // Override Ctrl+S / Cmd+S: save current settings & game state, prevent browser Save As dialog
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
    e.preventDefault();
    e.stopPropagation();
    saveGameState(true);
    return;
  }

  if (e.target && (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'color'))) return;

  // If auto-slide is active, any key other than WASD cancels auto-slide immediately
  const isWasd = (e.key === 'w' || e.key === 'W' || e.key === 'a' || e.key === 'A' || e.key === 's' || e.key === 'S' || e.key === 'd' || e.key === 'D');
  if (autoSlideState.active && !isWasd) {
    stopAutoSlide();
  }

  // Numpad +/- to increase/decrease wall count (min 4)
  if (e.code === 'NumpadAdd' || (e.key === '+' && !e.shiftKey)) {
    e.preventDefault();
    stopAutoSlide();
    changeWallCount(1);
    return;
  }
  if (e.code === 'NumpadSubtract') {
    e.preventDefault();
    stopAutoSlide();
    changeWallCount(-1);
    return;
  }

  // H key toggles all HUD visibility on/off
  if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) {
    const modal = document.getElementById('settings-modal');
    if (!modal || modal.classList.contains('hidden')) {
      e.preventDefault();
      toggleHUD();
      return;
    }
  }

  // Shift + 1..6 for direct magnitude selection (0.001x, 0.01x, 0.1x, 1x, 10x, 100x)
  if (e.shiftKey && !e.ctrlKey && !e.altKey) {
    if (e.code === 'Digit1' || e.key === '!' || e.key === '1') {
      e.preventDefault();
      stopAutoSlide();
      setSliderMagnitude(0.001);
      return;
    }
    if (e.code === 'Digit2' || e.key === '@' || e.key === '2') {
      e.preventDefault();
      stopAutoSlide();
      setSliderMagnitude(0.01);
      return;
    }
    if (e.code === 'Digit3' || e.key === '#' || e.key === '3') {
      e.preventDefault();
      stopAutoSlide();
      setSliderMagnitude(0.1);
      return;
    }
    if (e.code === 'Digit4' || e.key === '$' || e.key === '4') {
      e.preventDefault();
      stopAutoSlide();
      setSliderMagnitude(1);
      return;
    }
    if (e.code === 'Digit5' || e.key === '%' || e.key === '5') {
      e.preventDefault();
      stopAutoSlide();
      setSliderMagnitude(10);
      return;
    }
    if (e.code === 'Digit6' || e.key === '^' || e.key === '6') {
      e.preventDefault();
      stopAutoSlide();
      setSliderMagnitude(100);
      return;
    }
  }

  // Keys 1..0 and '-' to select and focus each main slider
  if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
    const digitMap = {
      Digit1: 0, '1': 0,
      Digit2: 1, '2': 1,
      Digit3: 2, '3': 2,
      Digit4: 3, '4': 3,
      Digit5: 4, '5': 4,
      Digit6: 5, '6': 5,
      Digit7: 6, '7': 6,
      Digit8: 7, '8': 7,
      Digit9: 8, '9': 8,
      Digit0: 9, '0': 9,
      Minus: 10, '-': 10
    };
    const targetIdx = digitMap[e.code] !== undefined ? digitMap[e.code] : digitMap[e.key];
    if (targetIdx !== undefined && e.code !== 'NumpadSubtract') {
      e.preventDefault();
      if (targetIdx === 10) {
        toggleOverflowMode();
      }
      selectSliderByIndex(targetIdx);
      return;
    }
  }

  // Keys '[' and ']' adjust the vertical opacity gradient interval
  if (!e.ctrlKey && !e.altKey && (e.code === 'BracketLeft' || e.code === 'BracketRight' || e.key === '[' || e.key === ']')) {
    e.preventDefault();
    const isLeft = (e.code === 'BracketLeft' || e.key === '[');
    let sVal = Math.round((settings.opacityStart !== undefined ? settings.opacityStart : 0.20) * 100);
    let eVal = Math.round((settings.opacityEnd !== undefined ? settings.opacityEnd : 0.85) * 100);
    const delta = e.shiftKey ? -5 : 5;

    if (isLeft) {
      sVal = constrain(sVal + delta, 0, eVal - 1);
      settings.opacityStart = sVal / 100.0;
    } else {
      eVal = constrain(eVal + delta, sVal + 1, 100);
      settings.opacityEnd = eVal / 100.0;
    }
    saveSettings();
    syncOpacityIntervalUI();
    showSaveToast(`Fade Interval: ${sVal}% → ${eVal}%`);
    return;
  }

  // Tab key cycles active slider and focuses it
  if (e.key === 'Tab') {
    e.preventDefault();
    stopAutoSlide();
    if (e.shiftKey) {
      selectedSliderIndex = (selectedSliderIndex - 1 + allEngineSliders.length) % allEngineSliders.length;
    } else {
      selectedSliderIndex = (selectedSliderIndex + 1) % allEngineSliders.length;
    }
    const target = allEngineSliders[selectedSliderIndex];
    if (target && target.slider && target.slider.elt) {
      target.slider.elt.focus();
    }
    return;
  }

  // Up/Down arrows: switch active slider
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    stopAutoSlide();
    selectedSliderIndex = (selectedSliderIndex - 1 + allEngineSliders.length) % allEngineSliders.length;
    const target = allEngineSliders[selectedSliderIndex];
    if (target && target.slider && target.slider.elt) {
      target.slider.elt.focus();
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    stopAutoSlide();
    selectedSliderIndex = (selectedSliderIndex + 1) % allEngineSliders.length;
    const target = allEngineSliders[selectedSliderIndex];
    if (target && target.slider && target.slider.elt) {
      target.slider.elt.focus();
    }
    return;
  }

  // Left/Right arrows: manual step + triple-tap detection for auto-sliding
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const target = getActiveSliderObj();
    const direction = (e.key === 'ArrowRight') ? 1 : -1;
    stepSlider(target, direction);

    // Ignore OS key repeats while holding down
    if (e.repeat) return;

    const keyName = e.key;
    const now = Date.now();
    let history = tapHistory[keyName] || [];
    // Keep taps from the last 800ms
    history = history.filter(t => now - t <= 800);
    history.push(now);
    tapHistory[keyName] = history;

    // Check if 3 quick presses in a row (consecutive intervals <= 400ms)
    if (history.length >= 3) {
      const t1 = history[history.length - 3];
      const t2 = history[history.length - 2];
      const t3 = history[history.length - 1];
      if ((t2 - t1 <= 400) && (t3 - t2 <= 400)) {
        tapHistory[keyName] = [];
        startAutoSlide(target, direction);
      }
    }
    return;
  }
}

function initModalListeners() {
  const modal = document.getElementById('settings-modal');
  const btnOpen = document.getElementById('btn-open-settings');
  const btnClose = document.getElementById('btn-modal-close');
  const modalSplitSlider = document.getElementById('modal-split-slider');
  const modalSplitLabel = document.getElementById('modal-split-label');
  const modalWallsSlider = document.getElementById('modal-walls-slider');
  const modalWallsLabel = document.getElementById('modal-walls-label');
  const closeColorInput = document.getElementById('close-color-input');
  const farColorInput = document.getElementById('far-color-input');
  const closeHexLabel = document.getElementById('close-hex-label');
  const farHexLabel = document.getElementById('far-hex-label');
  const modalCurveSlider = document.getElementById('modal-curve-slider');
  const modalCurveLabel = document.getElementById('modal-curve-label');
  const modalGravitySlider = document.getElementById('modal-gravity-slider');
  const modalGravityLabel = document.getElementById('modal-gravity-label');
  const modalFishEyeSlider = document.getElementById('modal-fisheye-slider');
  const modalFishEyeLabel = document.getElementById('modal-fisheye-label');
  const modalRadiusSlider = document.getElementById('modal-radius-slider');
  const modalRadiusLabel = document.getElementById('modal-radius-label');
  const modalEscapeSlider = document.getElementById('modal-escape-slider');
  const modalEscapeLabel = document.getElementById('modal-escape-label');
  const modalOverflowSlider = document.getElementById('modal-overflow-slider');
  const modalOverflowLabel = document.getElementById('modal-overflow-label');
  const btnSaveRefresh = document.getElementById('btn-save-refresh');
  const btnApplyLive = document.getElementById('btn-apply-live');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');

  function syncModalInputs() {
    if (modalSplitSlider) modalSplitSlider.value = settings.splitPercent;
    if (modalSplitLabel) modalSplitLabel.textContent = `${settings.splitPercent}% Top / ${100 - settings.splitPercent}% Bottom`;
    if (modalWallsSlider) modalWallsSlider.value = settings.wallCount;
    if (modalWallsLabel) modalWallsLabel.textContent = `${settings.wallCount} Walls`;
    if (closeColorInput) closeColorInput.value = settings.closeColor;
    if (farColorInput) farColorInput.value = settings.farColor;
    if (closeHexLabel) closeHexLabel.textContent = settings.closeColor.toUpperCase();
    if (farHexLabel) farHexLabel.textContent = settings.farColor.toUpperCase();

    if (modalCurveSlider) modalCurveSlider.value = settings.globalCurve;
    if (modalCurveLabel) modalCurveLabel.textContent = `${settings.globalCurve > 0 ? '+' : ''}${settings.globalCurve}°${settings.globalCurve === 0 ? ' (Flat Space)' : ''}`;

    if (modalGravitySlider) modalGravitySlider.value = settings.gravityMass;
    if (modalGravityLabel) modalGravityLabel.textContent = `${settings.gravityMass} M${settings.gravityMass === 0 ? ' (Off)' : ' (Active)'}`;

    if (modalFishEyeSlider) modalFishEyeSlider.value = settings.fishEye;
    if (modalFishEyeLabel) modalFishEyeLabel.textContent = `${Math.round(settings.fishEye * 100)}%${settings.fishEye === 0 ? ' (Flat Corrected)' : ''}`;

    if (modalRadiusSlider) modalRadiusSlider.value = settings.singularityRadius;
    if (modalRadiusLabel) modalRadiusLabel.textContent = `${settings.singularityRadius}px${settings.singularityRadius === 0 ? ' (0px: Orbit Core Only, No Eating)' : ''}`;

    if (modalEscapeSlider) modalEscapeSlider.value = settings.escapeFactor;
    if (modalEscapeLabel) modalEscapeLabel.textContent = `${settings.escapeFactor.toFixed(2)}${settings.escapeFactor === 0 ? ' (Closed Orbit)' : ' (Spiral Outward)'}`;

    syncOverflowUI();
    syncChromaUI();

    const modalHudCheckbox = document.getElementById('modal-hud-checkbox');
    if (modalHudCheckbox) modalHudCheckbox.checked = (settings.showHUD !== false);
    const modalHudLabel = document.getElementById('modal-hud-label');
    if (modalHudLabel) modalHudLabel.textContent = (settings.showHUD !== false) ? 'Visible (Press H)' : 'Hidden (Press H)';

    const magBadge = document.getElementById('modal-step-badge');
    if (magBadge) magBadge.textContent = `${sliderMagnitude}x`;

    updateSliderSteps();
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      syncModalInputs();
      modal.classList.remove('hidden');
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  document.querySelectorAll('.btn-mag').forEach(btn => {
    btn.addEventListener('click', () => {
      const mag = parseFloat(btn.dataset.mag);
      if (mag) {
        setSliderMagnitude(mag);
      }
    });
  });

  if (modalWallsSlider) {
    modalWallsSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setWallCount(val);
    });
  }

  if (closeColorInput) {
    closeColorInput.addEventListener('input', (e) => {
      settings.closeColor = e.target.value;
      colorCloseRgb = hexToRgb(settings.closeColor);
      window.colorCloseRgb = colorCloseRgb;
      if (closeHexLabel) closeHexLabel.textContent = settings.closeColor.toUpperCase();
      saveSettings();
    });
  }

  if (farColorInput) {
    farColorInput.addEventListener('input', (e) => {
      settings.farColor = e.target.value;
      colorFarRgb = hexToRgb(settings.farColor);
      window.colorFarRgb = colorFarRgb;
      if (farHexLabel) farHexLabel.textContent = settings.farColor.toUpperCase();
      saveSettings();
    });
  }

  if (modalSplitSlider) {
    modalSplitSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      settings.splitPercent = val;
      if (modalSplitLabel) modalSplitLabel.textContent = `${val}% Top / ${100 - val}% Bottom`;
      if (sliderSplit) sliderSplit.value(val);
      saveSettings();
    });
  }

  if (modalCurveSlider) {
    modalCurveSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settings.globalCurve = val;
      if (modalCurveLabel) modalCurveLabel.textContent = `${val > 0 ? '+' : ''}${val}°${val === 0 ? ' (Flat Space)' : ''}`;
      if (sliderCurve) sliderCurve.value(val);
      saveSettings();
    });
  }

  if (modalGravitySlider) {
    modalGravitySlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settings.gravityMass = val;
      if (singularity) singularity.mass = val;
      if (modalGravityLabel) modalGravityLabel.textContent = `${val} M${val === 0 ? ' (Off)' : ' (Active)'}`;
      if (sliderGravity) sliderGravity.value(val);
      saveSettings();
    });
  }

  if (modalFishEyeSlider) {
    modalFishEyeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settings.fishEye = val;
      if (modalFishEyeLabel) modalFishEyeLabel.textContent = `${Math.round(val * 100)}%${val === 0 ? ' (Flat Corrected)' : ''}`;
      if (sliderFishEye) sliderFishEye.value(val);
      if (settings.linkFishEyeChroma !== false) {
        settings.chromaPos = +(0.45 + val * 0.20).toFixed(2);
      }
      saveSettings();
      syncChromaUI();
    });
  }

  const modalLinkChromaCheckbox = document.getElementById('modal-link-chroma-checkbox');
  if (modalLinkChromaCheckbox) {
    modalLinkChromaCheckbox.addEventListener('change', (e) => {
      settings.linkFishEyeChroma = e.target.checked;
      if (settings.linkFishEyeChroma) {
        settings.chromaPos = getEffectiveChromaPos();
      }
      saveSettings();
      syncChromaUI();
    });
  }

  const modalChromaPosSlider = document.getElementById('modal-chroma-pos-slider');
  if (modalChromaPosSlider) {
    modalChromaPosSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settings.chromaPos = val;
      settings.linkFishEyeChroma = false;
      saveSettings();
      syncChromaUI();
    });
  }

  const startOpacitySlider = document.getElementById('modal-opacity-start-slider');
  const endOpacitySlider = document.getElementById('modal-opacity-end-slider');
  const opacityWrapper = document.getElementById('modal-opacity-wrapper');

  function handleOpacityInput(source) {
    if (!startOpacitySlider || !endOpacitySlider) return;
    let sVal = parseInt(startOpacitySlider.value, 10);
    let eVal = parseInt(endOpacitySlider.value, 10);

    if (source === 'start') {
      if (sVal >= eVal) {
        sVal = Math.max(0, eVal - 1);
        startOpacitySlider.value = sVal;
      }
      startOpacitySlider.style.zIndex = '15';
      endOpacitySlider.style.zIndex = '10';
    } else if (source === 'end') {
      if (eVal <= sVal) {
        eVal = Math.min(100, sVal + 1);
        endOpacitySlider.value = eVal;
      }
      endOpacitySlider.style.zIndex = '15';
      startOpacitySlider.style.zIndex = '10';
    }

    settings.opacityStart = sVal / 100.0;
    settings.opacityEnd = eVal / 100.0;
    saveSettings();
    syncOpacityIntervalUI();
  }

  if (startOpacitySlider) {
    startOpacitySlider.addEventListener('input', () => handleOpacityInput('start'));
  }
  if (endOpacitySlider) {
    endOpacitySlider.addEventListener('input', () => handleOpacityInput('end'));
  }

  if (opacityWrapper) {
    opacityWrapper.addEventListener('click', (e) => {
      if (e.target === startOpacitySlider || e.target === endOpacitySlider) return;
      const rect = opacityWrapper.getBoundingClientRect();
      const clickPct = Math.round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 100);
      let sVal = parseInt(startOpacitySlider.value, 10);
      let eVal = parseInt(endOpacitySlider.value, 10);
      if (Math.abs(clickPct - sVal) < Math.abs(clickPct - eVal)) {
        startOpacitySlider.value = Math.min(clickPct, eVal - 1);
        handleOpacityInput('start');
      } else {
        endOpacitySlider.value = Math.max(clickPct, sVal + 1);
        handleOpacityInput('end');
      }
    });
  }

  if (modalRadiusSlider) {
    modalRadiusSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settings.singularityRadius = val;
      if (singularity) singularity.radius = val;
      if (modalRadiusLabel) modalRadiusLabel.textContent = `${val}px${val === 0 ? ' (0px: Orbit Core Only, No Eating)' : ''}`;
      if (sliderRadius) sliderRadius.value(val);
      saveSettings();
    });
  }

  if (modalEscapeSlider) {
    modalEscapeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settings.escapeFactor = val;
      if (modalEscapeLabel) modalEscapeLabel.textContent = `${val.toFixed(2)}${val === 0 ? ' (Closed Orbit)' : ' (Spiral Outward)'}`;
      if (sliderEscape) sliderEscape.value(val);
      saveSettings();
    });
  }

  if (modalOverflowSlider) {
    modalOverflowSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setOverflowMode(val >= 0.5 ? 'solid' : 'transparent');
    });
  }

  const modalOverflowCheckbox = document.getElementById('modal-overflow-checkbox');
  if (modalOverflowCheckbox) {
    modalOverflowCheckbox.addEventListener('change', (e) => {
      setOverflowMode(e.target.checked ? 'solid' : 'transparent');
    });
  }

  const modalHudCheckbox = document.getElementById('modal-hud-checkbox');
  if (modalHudCheckbox) {
    modalHudCheckbox.addEventListener('change', (e) => {
      setHUDVisible(e.target.checked);
    });
  }

  document.querySelectorAll('.btn-overflow-mode').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.getAttribute('data-mode');
      setOverflowMode(mode);
    });
  });

  if (btnSaveRefresh) {
    btnSaveRefresh.addEventListener('click', () => {
      if (modalSplitSlider) settings.splitPercent = parseInt(modalSplitSlider.value, 10);
      if (modalWallsSlider) settings.wallCount = parseInt(modalWallsSlider.value, 10);
      if (closeColorInput) settings.closeColor = closeColorInput.value;
      if (farColorInput) settings.farColor = farColorInput.value;
      if (modalCurveSlider) settings.globalCurve = parseFloat(modalCurveSlider.value);
      if (modalGravitySlider) settings.gravityMass = parseFloat(modalGravitySlider.value);
      if (modalFishEyeSlider) settings.fishEye = parseFloat(modalFishEyeSlider.value);
      if (modalRadiusSlider) settings.singularityRadius = parseFloat(modalRadiusSlider.value);
      if (modalEscapeSlider) settings.escapeFactor = parseFloat(modalEscapeSlider.value);
      if (modalOverflowCheckbox) {
        settings.overflowMode = modalOverflowCheckbox.checked ? 'solid' : 'transparent';
        settings.overflowOpacity = modalOverflowCheckbox.checked ? 1.0 : 0.35;
      } else if (modalOverflowSlider) {
        const val = parseFloat(modalOverflowSlider.value);
        settings.overflowMode = val >= 0.5 ? 'solid' : 'transparent';
        settings.overflowOpacity = val >= 0.5 ? 1.0 : 0.35;
      }
      if (modalHudCheckbox) {
        settings.showHUD = modalHudCheckbox.checked;
      }
      const linkChromaCb = document.getElementById('modal-link-chroma-checkbox');
      const chromaSlider = document.getElementById('modal-chroma-pos-slider');
      if (linkChromaCb) settings.linkFishEyeChroma = linkChromaCb.checked;
      if (chromaSlider) settings.chromaPos = parseFloat(chromaSlider.value);
      if (startOpacitySlider) settings.opacityStart = parseInt(startOpacitySlider.value, 10) / 100.0;
      if (endOpacitySlider) settings.opacityEnd = parseInt(endOpacitySlider.value, 10) / 100.0;
      saveSettings();
      window.location.reload();
    });
  }

  if (btnApplyLive) {
    btnApplyLive.addEventListener('click', () => {
      if (modalSplitSlider) settings.splitPercent = parseInt(modalSplitSlider.value, 10);
      if (modalWallsSlider) setWallCount(parseInt(modalWallsSlider.value, 10));
      if (closeColorInput) settings.closeColor = closeColorInput.value;
      if (farColorInput) settings.farColor = farColorInput.value;
      if (modalCurveSlider) settings.globalCurve = parseFloat(modalCurveSlider.value);
      if (modalGravitySlider) settings.gravityMass = parseFloat(modalGravitySlider.value);
      if (modalFishEyeSlider) settings.fishEye = parseFloat(modalFishEyeSlider.value);
      if (modalRadiusSlider) settings.singularityRadius = parseFloat(modalRadiusSlider.value);
      if (modalEscapeSlider) settings.escapeFactor = parseFloat(modalEscapeSlider.value);
      if (modalOverflowCheckbox) {
        setOverflowMode(modalOverflowCheckbox.checked ? 'solid' : 'transparent');
      } else if (modalOverflowSlider) {
        const val = parseFloat(modalOverflowSlider.value);
        setOverflowMode(val >= 0.5 ? 'solid' : 'transparent');
      }
      if (modalHudCheckbox) {
        setHUDVisible(modalHudCheckbox.checked);
      }
      const linkChromaCb = document.getElementById('modal-link-chroma-checkbox');
      const chromaSlider = document.getElementById('modal-chroma-pos-slider');
      if (linkChromaCb) settings.linkFishEyeChroma = linkChromaCb.checked;
      if (chromaSlider) settings.chromaPos = parseFloat(chromaSlider.value);
      if (startOpacitySlider) settings.opacityStart = parseInt(startOpacitySlider.value, 10) / 100.0;
      if (endOpacitySlider) settings.opacityEnd = parseInt(endOpacitySlider.value, 10) / 100.0;
      if (singularity) {
        singularity.mass = settings.gravityMass;
        singularity.radius = settings.singularityRadius;
      }
      saveSettings();
      if (sliderSplit) sliderSplit.value(settings.splitPercent);
      if (sliderCurve) sliderCurve.value(settings.globalCurve);
      if (sliderGravity) sliderGravity.value(settings.gravityMass);
      if (sliderFishEye) sliderFishEye.value(settings.fishEye);
      if (sliderRadius) sliderRadius.value(settings.singularityRadius);
      if (sliderEscape) sliderEscape.value(settings.escapeFactor);
      if (sliderOverflow) sliderOverflow.value(settings.overflowMode === 'solid' ? 1 : 0);
      syncOverflowUI();
      syncChromaUI();
      syncOpacityIntervalUI();
      applyLiveLayout();
      modal.classList.add('hidden');
    });
  }

  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      settings = Object.assign({}, defaultSettings);
      sliderMagnitude = 1;
      try {
        localStorage.removeItem(SETTINGS_KEY);
      } catch (e) {}
      saveSettings();
      window.location.reload();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  });

  syncModalInputs();
}

function onSplitChanged() {
  const splitVal = sliderSplit.value();
  settings.splitPercent = splitVal;
  saveSettings();
  applyLiveLayout();
}

function onCurveChanged() {
  const curveVal = sliderCurve.value();
  settings.globalCurve = curveVal;
  saveSettings();
}

function onGravityChanged() {
  const gravVal = sliderGravity.value();
  settings.gravityMass = gravVal;
  if (singularity) singularity.mass = gravVal;
  saveSettings();
}

function onFishEyeChanged() {
  const fishVal = sliderFishEye.value();
  settings.fishEye = fishVal;
  if (settings.linkFishEyeChroma !== false) {
    settings.chromaPos = +(0.45 + fishVal * 0.20).toFixed(2);
  }
  saveSettings();
  syncChromaUI();
}

function onRadiusChanged() {
  const radVal = sliderRadius.value();
  settings.singularityRadius = radVal;
  if (singularity) singularity.radius = radVal;
  saveSettings();
}

function onEscapeChanged() {
  const escVal = sliderEscape.value();
  settings.escapeFactor = escVal;
  saveSettings();
}

function applyLiveLayout() {
  const oldW = sceneW;
  const oldH = sceneH;

  updateDimensions();
  resizeCanvas(sceneW, sceneH + scene3DH);
  initBoundaries();

  if (oldW && oldH) {
    const scaleX = sceneW / oldW;
    const scaleY = sceneH / oldH;
    for (let i = 4; i < walls.length; i++) {
      walls[i] = new Boundary(
        walls[i].a.x * scaleX,
        walls[i].a.y * scaleY,
        walls[i].b.x * scaleX,
        walls[i].b.y * scaleY
      );
    }
    if (particle) {
      particle.pos.x *= scaleX;
      particle.pos.y *= scaleY;
    }
    if (singularity) {
      singularity.x = sceneW * (settings.singularityX || 0.65);
      singularity.y = sceneH * (settings.singularityY || 0.45);
    }
  }
}

function onFOVChanged() {
  const fov = sliderFOV.value();
  settings.fov = fov;
  particle.updateFOV(fov);
  saveSettings();
}

function onWallsChanged() {
  const newWallCount = sliderWall.value();
  settings.wallCount = newWallCount;
  saveSettings();

  if (newWallCount > walls.length) {
    for (let i = walls.length; i < newWallCount; i++) {
      let x1 = random(sceneW);
      let x2 = random(sceneW);
      let y1 = random(sceneH);
      let y2 = random(sceneH);
      walls[i] = new Boundary(x1, y1, x2, y2);
    }
  } else if (newWallCount < walls.length) {
    while (walls.length > newWallCount) {
      walls.pop();
    }
  }
}

function onDensityChanged() {
  const density = sliderDensity.value();
  settings.density = density;
  saveSettings();
  const step = 1 / density;
  particle.updateDensity(step);
}

function onLODChanged() {
  settings.lodThreshold = sliderThreshold.value();
  settings.maxChunk = sliderMaxChunk.value();
  saveSettings();
}

function windowResized() {
  const oldW = sceneW;
  const oldH = sceneH;

  updateDimensions();
  resizeCanvas(sceneW, sceneH + scene3DH);
  initBoundaries();

  if (oldW && oldH && (oldW !== sceneW || oldH !== sceneH)) {
    const scaleX = sceneW / oldW;
    const scaleY = sceneH / oldH;
    for (let i = 4; i < walls.length; i++) {
      walls[i] = new Boundary(
        walls[i].a.x * scaleX,
        walls[i].a.y * scaleY,
        walls[i].b.x * scaleX,
        walls[i].b.y * scaleY
      );
    }
    if (particle) {
      particle.pos.x *= scaleX;
      particle.pos.y *= scaleY;
    }
    if (singularity) {
      singularity.x = sceneW * (settings.singularityX || 0.65);
      singularity.y = sceneH * (settings.singularityY || 0.45);
    }
  }
}

function initBoundaries() {
  walls[0] = new Boundary(0, 0, sceneW, 0);
  walls[1] = new Boundary(sceneW, 0, sceneW, sceneH);
  walls[2] = new Boundary(sceneW, sceneH, 0, sceneH);
  walls[3] = new Boundary(0, sceneH, 0, 0);
}

function initWalls(count) {
  walls = walls.slice(0, 4);
  if (settings.savedWalls && Array.isArray(settings.savedWalls) && settings.savedWalls.length === count - 4) {
    for (let sw of settings.savedWalls) {
      walls.push(new Boundary(sw.x1 * sceneW, sw.y1 * sceneH, sw.x2 * sceneW, sw.y2 * sceneH));
    }
  } else {
    for (let i = 4; i < count; i++) {
      let x1 = random(sceneW);
      let x2 = random(sceneW);
      let y1 = random(sceneH);
      let y2 = random(sceneH);
      walls[i] = new Boundary(x1, y1, x2, y2);
    }
  }
}

function handleInput() {
  // Player movement: strictly WASD keys only (arrow keys disabled)
  if (keyIsDown(65)) particle.rotate(-rotationOffset);  // A: Rotate left
  if (keyIsDown(68)) particle.rotate(rotationOffset);   // D: Rotate right
  if (keyIsDown(87)) particle.move(movingOffset);       // W: Move forward
  if (keyIsDown(83)) particle.move(-movingOffset);      // S: Move backward
}

function mousePressed() {
  if (autoSlideState && autoSlideState.active) {
    stopAutoSlide();
  }

  // Restore keyboard focus to canvas whenever clicking anywhere on canvas
  if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
    document.activeElement.blur();
  }

  if (mouseY <= sceneH && singularity) {
    // Alt + Click teleports the singularity to clicked spot
    if (keyIsDown(18) || keyIsDown(17)) { // Alt or Ctrl
      singularity.x = constrain(mouseX, 20, sceneW - 20);
      singularity.y = constrain(mouseY, 20, sceneH - 20);
      settings.singularityX = singularity.x / sceneW;
      settings.singularityY = singularity.y / sceneH;
      saveSettings();
      return false;
    }
    if (singularity.contains(mouseX, mouseY)) {
      isDraggingSingularity = true;
      singularity.isDragging = true;
      return false;
    }
  }
}

function mouseDragged() {
  if (isDraggingSingularity && singularity) {
    singularity.x = constrain(mouseX, 20, sceneW - 20);
    singularity.y = constrain(mouseY, 20, sceneH - 20);
    settings.singularityX = singularity.x / sceneW;
    settings.singularityY = singularity.y / sceneH;
    saveSettings();
    return false;
  }
}

function mouseReleased() {
  if (isDraggingSingularity) {
    isDraggingSingularity = false;
    if (singularity) singularity.isDragging = false;
    return false;
  }
}

function draw() {
  handleInput();
  background(0);

  // Dynamic cursor feedback when hovering over the singularity
  if (mouseY <= sceneH && singularity && singularity.contains(mouseX, mouseY)) {
    cursor(isDraggingSingularity ? 'grabbing' : 'grab');
  } else {
    cursor(ARROW);
  }

  // TOP VIEW (Configured % of screen height): 2D Raycasting View
  for (let wall of walls) {
    wall.show();
  }

  if (singularity) {
    singularity.update();
    singularity.show();
  }

  particle.show();

  const { scene, hitTypes, leftD, rightD } = particle.look(
    walls,
    true,
    singularity,
    settings.globalCurve,
    settings.fishEye,
    settings.escapeFactor
  );
  eyesDist = [leftD !== null ? leftD : sceneW, rightD !== null ? rightD : sceneW];

  // Horizontal divider line between 2D and 3D views
  stroke(55, 65, 80);
  strokeWeight(2);
  line(0, sceneH, sceneW, sceneH);

  // BOTTOM VIEW (Remaining % of screen height): 3D Column Projection
  const w = scene.length > 0 ? sceneW / scene.length : 0;

  push();
  translate(0, sceneH);
  noStroke();
  rectMode(CORNER);

  const maxDist = Math.max(sceneW, sceneH);
  const wSq = (maxDist / 2) * (maxDist * 2);
  const halfH = scene3DH / 2;

  const threshold = sliderThreshold.value();
  const maxChunk = sliderMaxChunk.value();

  let slicesDrawn = 0;

  // DYNAMIC DISTANCE-BASED LOD WITH CUSTOM WALL GRADIENT, FISH EYE & BLACK HOLE SHADOW
  for (let i = 0; i < scene.length; ) {
    const d = scene[i];
    const hitType = (hitTypes && hitTypes[i]) || 'wall';
    let step = 1;

    if (maxChunk > 1 && d > threshold && hitType !== 'singularity') {
      const ratio = (d - threshold) / (maxDist - threshold);
      step = Math.max(1, Math.min(maxChunk, Math.round(1 + ratio * (maxChunk - 1))));
      for (let c = 1; c < step; c++) {
        if (i + c >= scene.length || (hitTypes && hitTypes[i + c] !== hitType)) {
          step = c;
          break;
        }
      }
    }
    step = Math.min(step, scene.length - i);

    const sq = d * d;
    // Perspective wall projection with natural vertical overflow onto the 2D view (no vertical capping)
    const nominalDist = maxDist * 0.40;
    const h = (d >= nominalDist)
      ? map(d, maxDist, nominalDist, 0, scene3DH * 0.68)
      : (nominalDist / Math.max(10, d)) * (scene3DH * 0.68);

    const xStart = Math.floor(i * w);
    const xEnd = (i + step >= scene.length) ? sceneW : Math.floor((i + step) * w);
    const colWidth = Math.max(1, xEnd - xStart);
    const topY = halfH - h / 2;
    const bottomY = topY + h;
    const isSolidOverflow = (settings.overflowMode === 'solid');

    if (hitType === 'singularity') {
      // Event Horizon rendered in 3D: Pitch black void silhouette
      if (topY >= 0) {
        fill(0, 0, 0);
        rect(xStart, topY, colWidth, h);

        // Accretion halo photon ring along top and bottom edges
        fill(55, 255, 225, 180);
        rect(xStart, topY, colWidth, 2);
        rect(xStart, topY + h - 2, colWidth, 2);
      } else {
        // Wall slice overflows into 2D view (topY < 0)
        // 1) Bottom portion in 3D view (y >= 0 to bottomY): Strictly solid, NO vertical opacity gradient
        if (bottomY > 0) {
          fill(0, 0, 0);
          rect(xStart, 0, colWidth, bottomY);

          fill(55, 255, 225, 180);
          rect(xStart, bottomY - 2, colWidth, 2);
        }
        // 2) Top overflowing portion in 2D view (y < 0): 2 Modes (Transparent Fade Out vs Solid 100% Opaque)
        if (isSolidOverflow) {
          // Solid 100% Opaque Mode: fully opaque void block overflowing into 2D arena
          fill(0, 0, 0);
          rect(xStart, topY, colWidth, -topY);

          fill(55, 255, 225, 180);
          rect(xStart, topY, colWidth, 2);
        } else {
          // Transparent Mode: Atmospheric fade-out gradient with 2-way interval controls (sharpness & position)
          const maxOverflow = Math.min(-topY, sceneH);
          const fadeH = maxOverflow;
          const vStart = Math.min(settings.opacityStart !== undefined ? settings.opacityStart : 0.20, 0.98);
          const vEnd = Math.max(settings.opacityEnd !== undefined ? settings.opacityEnd : 0.85, vStart + 0.01);

          const grad = drawingContext.createLinearGradient(0, 0, 0, -fadeH);
          grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
          grad.addColorStop(constrain(vStart, 0, 1), 'rgba(0, 0, 0, 1)');
          grad.addColorStop(constrain(vEnd, 0, 1), 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          drawingContext.fillStyle = grad;
          drawingContext.fillRect(xStart, -fadeH, colWidth, fadeH);
        }
      }
    } else {
      // Distance falloff factor t (0 for close wall, 1 for far wall)
      // Equilibriated Chroma Depth Gradient with position linked to Fish Eye (2 merging behaviours)
      const chromaPos = getEffectiveChromaPos();
      const refSpan = Math.max(1, 2 * chromaPos * maxDist);
      const x = constrain(d / refSpan, 0, 1);
      const t = x * x * (3 - 2 * x); // Hermite smoothstep centered at chromaPos * maxDist

      // Smooth depth gradient between Close Wall Color and Far Wall Color
      const red = Math.round(lerp(colorCloseRgb.r, colorFarRgb.r, t));
      const greenBase = lerp(colorCloseRgb.g, colorFarRgb.g, t);
      const blue = Math.round(lerp(colorCloseRgb.b, colorFarRgb.b, t));

      // 720° FOV quirk modulation on green channel
      const greenFactor = Math.max(0, (115 - particle.viewAngle / 4) / 103.5);
      const green = Math.round(constrain(greenBase * greenFactor, 0, 255));

      if (topY >= 0) {
        // Completely inside 3D view: strictly solid fill, NO vertical opacity gradient
        fill(red, green, blue);
        rect(xStart, topY, colWidth, h);
      } else {
        // Wall slice overflows into 2D view (topY < 0)
        // 1) Bottom portion in 3D view (y >= 0 to bottomY): Strictly solid, NO vertical opacity gradient
        if (bottomY > 0) {
          fill(red, green, blue);
          rect(xStart, 0, colWidth, bottomY);
        }
        // 2) Top overflowing portion in 2D view (y < 0): 2 Modes (Transparent Fade Out vs Solid 100% Opaque)
        if (isSolidOverflow) {
          // Solid 100% Opaque Mode: fully opaque solid blocks overflowing into 2D arena
          fill(red, green, blue);
          rect(xStart, topY, colWidth, -topY);
        } else {
          // Transparent Mode: Atmospheric fade-out gradient with 2-way interval controls (sharpness & position)
          const maxOverflow = Math.min(-topY, sceneH);
          const fadeH = maxOverflow;
          const vStart = Math.min(settings.opacityStart !== undefined ? settings.opacityStart : 0.20, 0.98);
          const vEnd = Math.max(settings.opacityEnd !== undefined ? settings.opacityEnd : 0.85, vStart + 0.01);

          const grad = drawingContext.createLinearGradient(0, 0, 0, -fadeH);
          grad.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 1)`);
          grad.addColorStop(constrain(vStart, 0, 1), `rgba(${red}, ${green}, ${blue}, 1)`);
          grad.addColorStop(constrain(vEnd, 0, 1), `rgba(${red}, ${green}, ${blue}, 0)`);
          grad.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
          drawingContext.fillStyle = grad;
          drawingContext.fillRect(xStart, -fadeH, colWidth, fadeH);
        }
      }
    }

    slicesDrawn++;
    i += step;
  }
  pop();

  currentSliceCount = slicesDrawn;
  renderHUD();
}

function renderHUD() {
  if (settings.showHUD === false) return;

  const currFPS = frameRate();
  averageFPS = (averageFPS * 0.95) + (currFPS * 0.05);

  push();
  noStroke();
  textSize(12);

  // Left slider labels background panel (contains all 11 sliders + step multiplier)
  fill(10, 15, 25, 225);
  rectMode(CORNER);
  rect(5, 2, 370, 254, 8);

  const sliderLabels = [
    `[1] FOV: ${sliderFOV.value()}°`,
    `[2] Density: ${sliderDensity.value().toFixed(1)}/° (${(1/sliderDensity.value()).toFixed(2)}°)`,
    `[3] LOD Dist: ${sliderThreshold.value()}px`,
    `[4] Max Chunk: ${sliderMaxChunk.value()}x`,
    `[5] Split: ${sliderSplit.value()}% Top / ${100 - sliderSplit.value()}% 3D`,
    `[6] Curve: ${sliderCurve.value() > 0 ? '+' : ''}${sliderCurve.value()}°`,
    `[7] Gravity: ${sliderGravity.value() > 0 ? sliderGravity.value() + ' M' : '0 (Off)'}`,
    `[8] Fish Eye: ${Math.round(sliderFishEye.value() * 100)}%${sliderFishEye.value() === 0 ? ' (Flat)' : ''}${settings.linkFishEyeChroma !== false ? ' [Chroma Pos Merged]' : ''}`,
    `[9] Singularity: ${sliderRadius.value()}px${sliderRadius.value() === 0 ? ' (0px: Orbit)' : ' (Eats)'}`,
    `[0] Escape Drift: ${sliderEscape.value().toFixed(2)}${sliderEscape.value() === 0 ? ' (Closed)' : ' (Spiral)'}`,
    `[-] Overflow: ${settings.overflowMode === 'solid' ? 'Solid 100%' : 'Fade: ' + Math.round((settings.opacityStart !== undefined ? settings.opacityStart : 0.20) * 100) + '%→' + Math.round((settings.opacityEnd !== undefined ? settings.opacityEnd : 0.85) * 100) + '%'}`
  ];

  for (let idx = 0; idx < sliderLabels.length; idx++) {
    const yPos = 18 + idx * 20;
    const isSelected = (idx === selectedSliderIndex);
    const isAutoRunning = (autoSlideState.active && autoSlideState.sliderObj && autoSlideState.sliderObj.index === idx);

    if (isAutoRunning) {
      const pulse = (Math.floor(millis() / 200) % 2 === 0);
      fill(pulse ? color(255, 115, 26) : color(55, 255, 225));
      text(`${autoSlideState.direction > 0 ? '▶▶' : '◀◀'} ${sliderLabels[idx]}`, 172, yPos);
    } else if (isSelected) {
      fill(55, 255, 225);
      text(`▶ ${sliderLabels[idx]}`, 172, yPos);
    } else {
      fill(220);
      text(sliderLabels[idx], 180, yPos);
    }
  }

  // Footer status indicator
  if (autoSlideState.active && autoSlideState.sliderObj) {
    const pulse = (Math.floor(millis() / 200) % 2 === 0);
    fill(pulse ? color(255, 115, 26) : color(55, 255, 225));
    text(`⚡ AUTO ${autoSlideState.direction > 0 ? '▶▶' : '◀◀'} [${autoSlideState.sliderObj.name}]  (Key/Click to stop)`, 180, 238);
  } else {
    fill(55, 255, 225);
    text(`Step: ${sliderMagnitude}x  [Shift+1..6 | 1..0,- | Num +/-]`, 180, 238);
  }

  // Right diagnostics panel (anchored before the ⚙ Settings button)
  const rightX = width - 130;
  fill(10, 15, 25, 225);
  rectMode(CORNER);
  rect(rightX - 240, 5, 240, 146, 6);

  textAlign(RIGHT);
  fill(255);
  textSize(13);
  text(`Split: ${settings.splitPercent}% Top / ${100 - settings.splitPercent}% 3D`, rightX - 10, 22);
  fill(colorCloseRgb.r, colorCloseRgb.g, colorCloseRgb.b);
  text(`FPS: ${averageFPS.toFixed(1)}`, rightX - 10, 39);
  fill(55, 255, 225);
  text(`Walls: ${settings.wallCount} [Numpad +/-]`, rightX - 10, 56);
  fill(220);
  const saved = Math.round((1 - currentSliceCount / (particle.rays.length || 1)) * 100);
  text(`Slices: ${currentSliceCount} / ${particle.rays.length} (${saved}% saved)`, rightX - 10, 73);
  fill(55, 255, 225);
  textSize(11);
  text(`⚡ Move: WASD Keys (Cross Walls)`, rightX - 10, 90);
  text(`🌌 Drag Singularity / Alt+Click`, rightX - 10, 107);
  text(`💾 Save State: Ctrl+S`, rightX - 10, 124);
  text(`👁️ Toggle HUD: H`, rightX - 10, 141);
  pop();
}
