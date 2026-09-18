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
var sliderWall;
var sliderDensity;
var sliderThreshold;
var sliderMaxChunk;
var sliderSplit;
var sliderCurve;
var sliderGravity;
var sliderFishEye;
var sliderRadius;
var sliderEscape;

const orderMagnitudes = [0.01, 0.1, 1, 10, 100];
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

function saveSettings() {
  try {
    // Player position is strictly excluded from cached settings
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
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
      magnitude: sliderMagnitude
    }));
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
  // Player position is excluded from cache; always starts centered in top 2D view
  particle.pos.set(sceneW / 2, sceneH / 2);
  particle.updateFOV(settings.fov);
  particle.updateDensity(1 / settings.density);

  // Singularity (Black hole) positioned in top 2D map
  singularity = new Singularity(
    sceneW * (settings.singularityX || 0.65),
    sceneH * (settings.singularityY || 0.45),
    settings.gravityMass,
    settings.singularityRadius !== undefined ? settings.singularityRadius : 15
  );

  initBoundaries();
  initWalls(settings.wallCount);

  // Control 1: FOV (supports full 0° to 721° wrap-around quirk)
  sliderFOV = createSlider(0, 721, settings.fov, 1);
  sliderFOV.position(10, 5);
  styleSlider(sliderFOV);
  sliderFOV.input(onFOVChanged);

  // Control 2: Wall Count
  sliderWall = createSlider(4, 14, settings.wallCount, 1);
  sliderWall.position(10, 25);
  styleSlider(sliderWall);
  sliderWall.input(onWallsChanged);

  // Control 3: Ray Density (0.1 to 3.0 rays per degree)
  sliderDensity = createSlider(0.1, 3.0, settings.density, 0.05);
  sliderDensity.position(10, 45);
  styleSlider(sliderDensity);
  sliderDensity.input(onDensityChanged);

  // Control 4: LOD Distance Threshold (where chunky pixels start)
  sliderThreshold = createSlider(100, 2500, settings.lodThreshold, 25);
  sliderThreshold.position(10, 65);
  styleSlider(sliderThreshold);
  sliderThreshold.input(onLODChanged);

  // Control 5: Max Chunk Size for far pixels (1x - 16x width)
  sliderMaxChunk = createSlider(1, 16, settings.maxChunk, 1);
  sliderMaxChunk.position(10, 85);
  styleSlider(sliderMaxChunk);
  sliderMaxChunk.input(onLODChanged);

  // Control 6: Screen Split (10% to 90% in 10% steps)
  sliderSplit = createSlider(10, 90, settings.splitPercent, 10);
  sliderSplit.position(10, 105);
  styleSlider(sliderSplit);
  sliderSplit.input(onSplitChanged);

  // Control 7: Global Space Curvature (-60° to +60°)
  sliderCurve = createSlider(-60, 60, settings.globalCurve, 1);
  sliderCurve.position(10, 125);
  styleSlider(sliderCurve);
  sliderCurve.input(onCurveChanged);

  // Control 8: Black Hole Gravity Mass (0 to 3000)
  sliderGravity = createSlider(0, 3000, settings.gravityMass, 10);
  sliderGravity.position(10, 145);
  styleSlider(sliderGravity);
  sliderGravity.input(onGravityChanged);

  // Control 9: Fish Eye Distortion (0.00 = Flat Rectilinear, 1.00 = Classic Fish Eye, 2.00 = Extreme Dome)
  sliderFishEye = createSlider(0.0, 2.0, settings.fishEye, 0.05);
  sliderFishEye.position(10, 165);
  styleSlider(sliderFishEye);
  sliderFishEye.input(onFishEyeChanged);

  // Control 10: Singularity / Event Horizon Radius (0px = purely orbiting orb, up to 40px eating horizon)
  sliderRadius = createSlider(0, 40, settings.singularityRadius, 1);
  sliderRadius.position(10, 185);
  styleSlider(sliderRadius);
  sliderRadius.input(onRadiusChanged);

  // Control 11: Ray Inclination / Outward Spiral Escape (0.00 = orbit only, 1.00 = aggressive outward escape)
  sliderEscape = createSlider(0.0, 1.0, settings.escapeFactor, 0.05);
  sliderEscape.position(10, 205);
  styleSlider(sliderEscape);
  sliderEscape.input(onEscapeChanged);

  updateSliderSteps();

  window.addEventListener('resize', windowResized);
  window.addEventListener('keydown', onGlobalKeyDown);
  initModalListeners();
}

function cycleSliderMagnitude() {
  let idx = orderMagnitudes.indexOf(sliderMagnitude);
  if (idx === -1) idx = 2;
  idx = (idx + 1) % orderMagnitudes.length;
  sliderMagnitude = orderMagnitudes[idx];
  updateSliderSteps();
  saveSettings();
}

function updateSliderSteps() {
  const sliders = [
    { slider: sliderFOV, base: 1 },
    { slider: sliderWall, base: 1 },
    { slider: sliderDensity, base: 0.05 },
    { slider: sliderThreshold, base: 25 },
    { slider: sliderMaxChunk, base: 1 },
    { slider: sliderSplit, base: 10 },
    { slider: sliderCurve, base: 1 },
    { slider: sliderGravity, base: 10 },
    { slider: sliderFishEye, base: 0.05 },
    { slider: sliderRadius, base: 1 },
    { slider: sliderEscape, base: 0.05 }
  ];

  for (let s of sliders) {
    if (s.slider && s.slider.elt) {
      const stepVal = Math.max(0.001, +(s.base * sliderMagnitude).toPrecision(4));
      s.slider.elt.step = stepVal;
    }
  }

  // Update modal inputs as well
  const modalSliders = [
    { id: 'modal-split-slider', base: 10 },
    { id: 'modal-curve-slider', base: 1 },
    { id: 'modal-gravity-slider', base: 10 },
    { id: 'modal-fisheye-slider', base: 0.05 },
    { id: 'modal-radius-slider', base: 1 },
    { id: 'modal-escape-slider', base: 0.05 }
  ];
  for (let m of modalSliders) {
    const el = document.getElementById(m.id);
    if (el) {
      el.step = Math.max(0.001, +(m.base * sliderMagnitude).toPrecision(4));
    }
  }

  const magBadge = document.getElementById('modal-step-badge');
  if (magBadge) magBadge.textContent = `${sliderMagnitude}x`;
}

function onGlobalKeyDown(e) {
  // Press Shift once to increase incremental value by one order of magnitude
  if (e.key === 'Shift') {
    cycleSliderMagnitude();
  }
}

function initModalListeners() {
  const modal = document.getElementById('settings-modal');
  const btnOpen = document.getElementById('btn-open-settings');
  const btnClose = document.getElementById('btn-modal-close');
  const modalSplitSlider = document.getElementById('modal-split-slider');
  const modalSplitLabel = document.getElementById('modal-split-label');
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
  const btnStepCycle = document.getElementById('btn-step-cycle');
  const btnSaveRefresh = document.getElementById('btn-save-refresh');
  const btnApplyLive = document.getElementById('btn-apply-live');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');

  function syncModalInputs() {
    if (modalSplitSlider) modalSplitSlider.value = settings.splitPercent;
    if (modalSplitLabel) modalSplitLabel.textContent = `${settings.splitPercent}% Top / ${100 - settings.splitPercent}% Bottom`;
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

  if (btnStepCycle) {
    btnStepCycle.addEventListener('click', () => {
      cycleSliderMagnitude();
      syncModalInputs();
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
      saveSettings();
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

  if (btnSaveRefresh) {
    btnSaveRefresh.addEventListener('click', () => {
      if (modalSplitSlider) settings.splitPercent = parseInt(modalSplitSlider.value, 10);
      if (closeColorInput) settings.closeColor = closeColorInput.value;
      if (farColorInput) settings.farColor = farColorInput.value;
      if (modalCurveSlider) settings.globalCurve = parseFloat(modalCurveSlider.value);
      if (modalGravitySlider) settings.gravityMass = parseFloat(modalGravitySlider.value);
      if (modalFishEyeSlider) settings.fishEye = parseFloat(modalFishEyeSlider.value);
      if (modalRadiusSlider) settings.singularityRadius = parseFloat(modalRadiusSlider.value);
      if (modalEscapeSlider) settings.escapeFactor = parseFloat(modalEscapeSlider.value);
      saveSettings();
      window.location.reload();
    });
  }

  if (btnApplyLive) {
    btnApplyLive.addEventListener('click', () => {
      if (modalSplitSlider) settings.splitPercent = parseInt(modalSplitSlider.value, 10);
      if (closeColorInput) settings.closeColor = closeColorInput.value;
      if (farColorInput) settings.farColor = farColorInput.value;
      if (modalCurveSlider) settings.globalCurve = parseFloat(modalCurveSlider.value);
      if (modalGravitySlider) settings.gravityMass = parseFloat(modalGravitySlider.value);
      if (modalFishEyeSlider) settings.fishEye = parseFloat(modalFishEyeSlider.value);
      if (modalRadiusSlider) settings.singularityRadius = parseFloat(modalRadiusSlider.value);
      if (modalEscapeSlider) settings.escapeFactor = parseFloat(modalEscapeSlider.value);
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
      applyLiveLayout();
      modal.classList.add('hidden');
    });
  }

  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      settings = Object.assign({}, defaultSettings);
      sliderMagnitude = 1;
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
  saveSettings();
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
  for (let i = 4; i < count; i++) {
    let x1 = random(sceneW);
    let x2 = random(sceneW);
    let y1 = random(sceneH);
    let y2 = random(sceneH);
    walls[i] = new Boundary(x1, y1, x2, y2);
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

    if (hitType === 'singularity') {
      // Event Horizon rendered in 3D: Pitch black void silhouette
      fill(0, 0, 0);
      rect(xStart, topY, colWidth, h);

      // Accretion halo photon ring along top and bottom edges
      fill(55, 255, 225, 180);
      rect(xStart, topY, colWidth, 2);
      rect(xStart, topY + h - 2, colWidth, 2);
    } else {
      // Distance falloff factor t (0 for close wall, 1 for far wall)
      const t = constrain(sq / (wSq / 2.5), 0, 1);

      // Smooth depth gradient between Close Wall Color and Far Wall Color
      const red = lerp(colorCloseRgb.r, colorFarRgb.r, t);
      const greenBase = lerp(colorCloseRgb.g, colorFarRgb.g, t);
      const blue = lerp(colorCloseRgb.b, colorFarRgb.b, t);

      // 720° FOV quirk modulation on green channel
      const greenFactor = Math.max(0, (115 - particle.viewAngle / 4) / 103.5);
      const green = constrain(greenBase * greenFactor, 0, 255);
      fill(red, green, blue);

      // Pixel-perfect integer boundary alignment: completely eliminates vertical seam lines
      rect(xStart, topY, colWidth, h);
    }

    slicesDrawn++;
    i += step;
  }
  pop();

  currentSliceCount = slicesDrawn;
  renderHUD();
}

function renderHUD() {
  const currFPS = frameRate();
  averageFPS = (averageFPS * 0.95) + (currFPS * 0.05);

  push();
  noStroke();
  textSize(12);

  // Left slider labels background panel (contains all 11 sliders + step multiplier)
  fill(10, 15, 25, 225);
  rectMode(CORNER);
  rect(5, 2, 345, 254, 6);

  fill(220);
  text(`FOV: ${sliderFOV.value()}°`, 180, 18);
  text(`Walls: ${sliderWall.value()}`, 180, 38);
  const density = sliderDensity.value();
  text(`Density: ${density.toFixed(1)} rays/° (${(1/density).toFixed(2)}°)`, 180, 58);
  text(`LOD Dist: ${sliderThreshold.value()}px`, 180, 78);
  text(`Max Chunk: ${sliderMaxChunk.value()}x`, 180, 98);
  text(`Split: ${sliderSplit.value()}% Top / ${100 - sliderSplit.value()}% 3D`, 180, 118);
  const curveVal = sliderCurve.value();
  text(`Curve: ${curveVal > 0 ? '+' : ''}${curveVal}°`, 180, 138);
  const gravVal = sliderGravity.value();
  text(`Gravity: ${gravVal > 0 ? gravVal + ' M' : '0 (Off)'}`, 180, 158);
  const fishVal = sliderFishEye.value();
  text(`Fish Eye: ${Math.round(fishVal * 100)}%${fishVal === 0 ? ' (Flat)' : ''}`, 180, 178);
  const radVal = sliderRadius.value();
  text(`Singularity: ${radVal}px${radVal === 0 ? ' (0px: Orbit Free)' : ' (Eats Rays)'}`, 180, 198);
  const escVal = sliderEscape.value();
  text(`Escape Drift: ${escVal.toFixed(2)}${escVal === 0 ? ' (Closed)' : ' (Spirals Out)'}`, 180, 218);

  // Shift magnitude indicator
  fill(55, 255, 225);
  text(`Step: ${sliderMagnitude}x  [Shift to cycle 0.01x-100x]`, 180, 238);

  // Right diagnostics panel (anchored before the ⚙ Settings button)
  const rightX = width - 130;
  fill(10, 15, 25, 225);
  rectMode(CORNER);
  rect(rightX - 240, 5, 240, 96, 6);

  textAlign(RIGHT);
  fill(255);
  textSize(13);
  text(`Split: ${settings.splitPercent}% Top / ${100 - settings.splitPercent}% 3D`, rightX - 10, 22);
  fill(colorCloseRgb.r, colorCloseRgb.g, colorCloseRgb.b);
  text(`FPS: ${averageFPS.toFixed(1)}`, rightX - 10, 40);
  fill(220);
  const saved = Math.round((1 - currentSliceCount / (particle.rays.length || 1)) * 100);
  text(`Slices: ${currentSliceCount} / ${particle.rays.length} (${saved}% saved)`, rightX - 10, 58);
  fill(55, 255, 225);
  textSize(11);
  text(`⚡ Move: WASD Keys (Cross Walls)`, rightX - 10, 75);
  text(`🌌 Drag Singularity / Alt+Click`, rightX - 10, 92);
  pop();
}
