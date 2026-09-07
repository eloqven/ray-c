const BORDER_WALL_COUNT = 4;
const MOVE_SPEED = 3;
const SPRINT_MULTIPLIER = 1.5;
const ROTATION_SPEED = 0.03;
const WORLD_SCALE = 2;
const MAX_VIEW_ANGLE = 478;
const MAX_RAY_DENSITY = 8.0;
const MAP_GRADIENT_START = '#030917';
const MAP_GRADIENT_END = '#303030';
const CEILING_GRADIENT_START = '#1a1f29';
const CEILING_GRADIENT_END = '#080b12';
const FLOOR_GRADIENT_START = '#040a18';
const FLOOR_GRADIENT_END = '#303030';
const FLOOR_DOT_COLOR = 'rgba(70, 70, 70, 0.35)';
const FLOOR_DOT_DENSITY = 0.00008;
const SLIDER_HOLD_REPEAT_MS = 80;
const FISH_EYE_MAX_PROJECTION_DEG = 82;
const PROXIMITY_SHADOW_START = 600;
const PROXIMITY_SHADOW_MAX = 171;
const SETTINGS_STORAGE_KEY = 'ray-casting-settings-v2';
const EXTERIOR_SCALE_ICON = '\u{1F431}';
const FPS_CAP_MIN = 6;
const FPS_CAP_MAX = 60;
const DEFAULT_FPS_CAP = 60;
const PURR_TRACKS = [
  { label: 'Purr 1', src: 'assets/audio/cat_purring_13s.ogg' },
  { label: 'Purr 2', src: 'assets/audio/cat_purring_fire_37s.ogg' },
  { label: 'Purr 3', src: 'assets/audio/cat_purring_53s.ogg' },
];
const RANDOM_WALL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
];

let walls = [];
let particle;
let viewW = 0;
let viewH = 0;
let mapViewH = 0;
let renderViewH = 0;
let worldW = 0;
let worldH = 0;
let sliderFOV;
let sliderWall;
let sliderFish;
let sliderDensity;
let shortcutBindings = [];
let wallCount = 6;
let ambientAudioStarted = false;
let purrAudio = null;
let activePurrTrackIndex = 0;
let purrButtons = [];
let floorDots = [];
let defaultState = null;
let fpsSmoothed = 60;
let fpsMin = Infinity;
let fpsMax = 0;
let fpsTotal = 0;
let fpsSamples = 0;
let currentSpeedPxPerSecond = 0;
let lastPlayerX = 0;
let lastPlayerY = 0;
let chaosPadActive = false;
let viewPadActive = false;
let distanceSpreadValue = 0;
let depthContrastValue = 0;
let sliderFpsCap;
let stageRoot;
let audioStateEl;
let fpsPrimaryEl;
let fpsAvgEl;
let fpsMinEl;
let fpsMaxEl;
let speedValueEl;
let fpsCapValueEl;
let fovValueEl;
let wallValueEl;
let fishValueEl;
let densityValueEl;
let viewFovValueEl;
let viewFishValueEl;
let distanceValueEl;
let contrastValueEl;
let resetButtonEl;
let chaosPadEl;
let chaosKnobEl;
let viewPadEl;
let viewPadKnobEl;

function setup() {
  bindDom();
  updateViewportSize();
  worldW = viewW * WORLD_SCALE;
  worldH = mapViewH * WORLD_SCALE;

  const canvas = createCanvas(viewW, viewH);
  canvas.parent(stageRoot);
  pixelDensity(1);

  particle = new Particle();
  particle.pos = { x: worldW / 2, y: worldH / 2 };
  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;

  rebuildWalls();
  createControls();
  attachUiEvents();
  loadSettingsFromStorage();
  captureDefaultState();
  rebuildFloorDots();
  updateHudValues();
  updateAudioStatus('Audio idle');

  window.addEventListener('pointerdown', initAmbientAudio, { once: true });
  window.addEventListener('keydown', initAmbientAudio, { once: true });
}

function bindDom() {
  stageRoot = document.getElementById('stage');
  audioStateEl = document.getElementById('audio-state');
  fpsPrimaryEl = document.getElementById('fps-primary');
  fpsAvgEl = document.getElementById('fps-avg');
  fpsMinEl = document.getElementById('fps-min');
  fpsMaxEl = document.getElementById('fps-max');
  speedValueEl = document.getElementById('speed-value');
  fpsCapValueEl = document.getElementById('fps-cap-value');
  fovValueEl = document.getElementById('fov-value');
  wallValueEl = document.getElementById('wall-value');
  fishValueEl = document.getElementById('fish-value');
  densityValueEl = document.getElementById('density-value');
  viewFovValueEl = document.getElementById('view-fov-value');
  viewFishValueEl = document.getElementById('view-fish-value');
  distanceValueEl = document.getElementById('distance-value');
  contrastValueEl = document.getElementById('contrast-value');
  resetButtonEl = document.getElementById('reset-button');
  chaosPadEl = document.getElementById('chaos-pad');
  chaosKnobEl = document.getElementById('chaos-knob');
  viewPadEl = document.getElementById('view-pad');
  viewPadKnobEl = document.getElementById('view-pad-knob');
  purrButtons = Array.from(document.querySelectorAll('.v2-purr-button'));
}

function updateViewportSize() {
  const bounds = stageRoot ? stageRoot.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  viewW = Math.max(320, Math.floor(bounds.width || window.innerWidth));
  viewH = Math.max(320, Math.floor(bounds.height || window.innerHeight));
  mapViewH = Math.floor(viewH / 2);
  renderViewH = viewH - mapViewH;
}

function rebuildWalls() {
  walls = [
    new Boundary(0, 0, worldW, 0),
    new Boundary(worldW, 0, worldW, worldH),
    new Boundary(worldW, worldH, 0, worldH),
    new Boundary(0, worldH, 0, 0),
  ];

  addWalls();
}

function createControls() {
  sliderFOV = createSlider(10, MAX_VIEW_ANGLE, particle.viewAngle);
  sliderFOV.parent('slider-fov-slot');
  sliderFOV.input(() => {
    particle.updateFOV(Number(sliderFOV.value()));
    syncViewPadFromSliders();
    updateHudValues();
  });
  styleSlider(sliderFOV, '1', 'Field of view');

  sliderWall = createSlider(BORDER_WALL_COUNT, 24, wallCount);
  sliderWall.parent('slider-wall-slot');
  sliderWall.input(updateWalls);
  styleSlider(sliderWall, '2', 'Wall count');

  sliderFish = createSlider(0, 100, 100);
  sliderFish.parent('slider-fish-slot');
  sliderFish.input(() => {
    syncViewPadFromSliders();
    updateHudValues();
  });
  styleSlider(sliderFish, '3', 'Lens correction');

  sliderDensity = createSlider(0.5, MAX_RAY_DENSITY, particle.rayDensity, 0.1);
  sliderDensity.parent('slider-density-slot');
  sliderDensity.input(() => {
    particle.updateDensity(Number(sliderDensity.value()));
    updateHudValues();
  });
  styleSlider(sliderDensity, '4', 'Ray density');

  sliderFpsCap = createSlider(FPS_CAP_MIN, FPS_CAP_MAX, DEFAULT_FPS_CAP, 1);
  sliderFpsCap.parent('slider-fpscap-slot');
  sliderFpsCap.input(() => {
    frameRate(Number(sliderFpsCap.value()));
    updateHudValues();
  });
  styleSlider(sliderFpsCap, null, 'Max FPS');
  frameRate(DEFAULT_FPS_CAP);

  setupViewPad();
  setupChaosPad();

  shortcutBindings = [
    createSliderBinding(sliderFOV, 1, () => {
      particle.updateFOV(Number(sliderFOV.value()));
      syncViewPadFromSliders();
    }),
    createSliderBinding(sliderWall, 1, updateWalls),
    createSliderBinding(sliderFish, 1, () => {
      syncViewPadFromSliders();
      updateHudValues();
    }),
    createSliderBinding(sliderDensity, 0.1, () => particle.updateDensity(Number(sliderDensity.value()))),
    createCustomBinding({
      min: 0,
      max: 100,
      step: 1,
      focus: focusChaosPad,
      getValue: () => distanceSpreadValue,
      setValue: (value) => setChaosPadValues(value, depthContrastValue),
    }),
    createCustomBinding({
      min: 0,
      max: 100,
      step: 1,
      focus: focusChaosPad,
      getValue: () => depthContrastValue,
      setValue: (value) => setChaosPadValues(distanceSpreadValue, value),
    }),
  ];
}

function styleSlider(slider, shortcutKey, label) {
  slider.addClass('hud-slider');
  slider.style('width', '100%');
  slider.attribute('aria-label', label);
  slider.elt.title = shortcutKey ? `${shortcutKey} - ${label}` : label;
}

function createSliderBinding(slider, step, onChange) {
  return createCustomBinding({
    min: Number(slider.elt.min),
    max: Number(slider.elt.max),
    step,
    focus: () => slider.elt.focus(),
    getValue: () => Number(slider.value()),
    setValue: (value) => slider.value(value),
    onChange,
  });
}

function createCustomBinding({ min, max, step, focus, getValue, setValue, onChange = null }) {
  return {
    min,
    max,
    step,
    focus,
    getValue,
    setValue,
    onChange,
    lastTick: 0,
  };
}

function setupChaosPad() {
  if (!chaosPadEl || !chaosKnobEl) {
    return;
  }

  chaosPadEl.addEventListener('pointerdown', (event) => {
    chaosPadActive = true;
    chaosPadEl.classList.add('active');
    chaosPadEl.focus();
    chaosPadEl.setPointerCapture?.(event.pointerId);
    updateChaosPadFromPointer(event.clientX, event.clientY);
  });

  chaosPadEl.addEventListener('pointermove', (event) => {
    if (chaosPadActive) {
      updateChaosPadFromPointer(event.clientX, event.clientY);
    }
  });

  const stopPadDrag = () => {
    chaosPadActive = false;
    chaosPadEl.classList.remove('active');
  };

  window.addEventListener('pointerup', stopPadDrag);
  window.addEventListener('pointercancel', stopPadDrag);

  setChaosPadValues(0, 0);
}

function setupViewPad() {
  if (!viewPadEl || !viewPadKnobEl) {
    return;
  }

  viewPadEl.addEventListener('pointerdown', (event) => {
    viewPadActive = true;
    viewPadEl.classList.add('active');
    viewPadEl.focus();
    viewPadEl.setPointerCapture?.(event.pointerId);
    updateViewPadFromPointer(event.clientX, event.clientY);
  });

  viewPadEl.addEventListener('pointermove', (event) => {
    if (viewPadActive) {
      updateViewPadFromPointer(event.clientX, event.clientY);
    }
  });

  const stopViewPadDrag = () => {
    viewPadActive = false;
    viewPadEl.classList.remove('active');
  };

  window.addEventListener('pointerup', stopViewPadDrag);
  window.addEventListener('pointercancel', stopViewPadDrag);

  syncViewPadFromSliders();
}

function attachUiEvents() {
  resetButtonEl?.addEventListener('click', resetToDefaults);
  purrButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      setPurrTrack(index, true);
    });
  });
  updatePurrButtons();
}

function focusChaosPad() {
  chaosPadEl?.focus();
}

function syncViewPadFromSliders() {
  if (!viewPadEl || !viewPadKnobEl || !sliderFOV || !sliderFish) {
    return;
  }

  const inset = 12;
  const width = Math.max(24, viewPadEl.clientWidth);
  const height = Math.max(24, viewPadEl.clientHeight);
  const fovPercent = map(Number(sliderFOV.value()), Number(sliderFOV.elt.min), Number(sliderFOV.elt.max), 0, 100);
  const fishPercent = map(Number(sliderFish.value()), Number(sliderFish.elt.min), Number(sliderFish.elt.max), 0, 100);

  viewPadKnobEl.style.left = `${map(fovPercent, 0, 100, inset, width - inset)}px`;
  viewPadKnobEl.style.top = `${map(fishPercent, 100, 0, inset, height - inset)}px`;
}

function setChaosPadValues(distanceValue, contrastValue) {
  distanceSpreadValue = clamp(distanceValue, 0, 100);
  depthContrastValue = clamp(contrastValue, 0, 100);

  if (!chaosPadEl || !chaosKnobEl) {
    updateHudValues();
    return;
  }

  const inset = 12;
  const width = Math.max(24, chaosPadEl.clientWidth);
  const height = Math.max(24, chaosPadEl.clientHeight);
  const knobX = map(distanceSpreadValue, 0, 100, inset, width - inset);
  const knobY = map(depthContrastValue, 100, 0, inset, height - inset);

  chaosKnobEl.style.left = `${knobX}px`;
  chaosKnobEl.style.top = `${knobY}px`;
  updateHudValues();
}

function updateChaosPadFromPointer(clientX, clientY) {
  if (!chaosPadEl) {
    return;
  }

  const rect = chaosPadEl.getBoundingClientRect();
  const localX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const localY = clamp((clientY - rect.top) / rect.height, 0, 1);

  setChaosPadValues(localX * 100, (1 - localY) * 100);
}

function updateViewPadFromPointer(clientX, clientY) {
  if (!viewPadEl) {
    return;
  }

  const rect = viewPadEl.getBoundingClientRect();
  const localX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const localY = clamp((clientY - rect.top) / rect.height, 0, 1);
  const nextFov = Math.round(map(localX, 0, 1, Number(sliderFOV.elt.min), Number(sliderFOV.elt.max)));
  const nextFish = Math.round(map(1 - localY, 0, 1, Number(sliderFish.elt.min), Number(sliderFish.elt.max)));

  sliderFOV.value(nextFov);
  particle.updateFOV(nextFov);
  sliderFish.value(nextFish);
  syncViewPadFromSliders();
  updateHudValues();
}

function updateHudValues() {
  if (fovValueEl && sliderFOV) {
    fovValueEl.textContent = `${Math.round(Number(sliderFOV.value()))}°`;
  }

  if (wallValueEl && sliderWall) {
    wallValueEl.textContent = `${Math.round(Number(sliderWall.value()))}`;
  }

  if (fishValueEl && sliderFish) {
    fishValueEl.textContent = `${Math.round(Number(sliderFish.value()))}%`;
  }

  if (densityValueEl && sliderDensity) {
    densityValueEl.textContent = Number(sliderDensity.value()).toFixed(1);
  }

  if (viewFovValueEl && sliderFOV) {
    viewFovValueEl.textContent = `${Math.round(Number(sliderFOV.value()))}°`;
  }

  if (viewFishValueEl && sliderFish) {
    viewFishValueEl.textContent = `${Math.round(Number(sliderFish.value()))}%`;
  }

  if (distanceValueEl) {
    distanceValueEl.textContent = `${Math.round(distanceSpreadValue)}%`;
  }

  if (contrastValueEl) {
    contrastValueEl.textContent = `${Math.round(depthContrastValue)}%`;
  }

  if (fpsCapValueEl && sliderFpsCap) {
    fpsCapValueEl.textContent = `${Math.round(Number(sliderFpsCap.value()))}`;
  }
}

function updatePurrButtons() {
  purrButtons.forEach((button, index) => {
    button.classList.toggle('is-active', index === activePurrTrackIndex);
  });
}

function ensurePurrAudio() {
  if (!purrAudio) {
    purrAudio = new Audio();
    purrAudio.loop = true;
    purrAudio.preload = 'auto';
    purrAudio.volume = 0.18;
  }
}

function setPurrTrack(index, shouldPlay = ambientAudioStarted) {
  activePurrTrackIndex = clamp(index, 0, PURR_TRACKS.length - 1);
  ensurePurrAudio();
  updatePurrButtons();

  const nextTrack = PURR_TRACKS[activePurrTrackIndex];
  if (purrAudio.dataset.trackIndex !== String(activePurrTrackIndex)) {
    purrAudio.pause();
    purrAudio.src = nextTrack.src;
    purrAudio.dataset.trackIndex = String(activePurrTrackIndex);
    purrAudio.load();
  }

  updateAudioStatus(shouldPlay ? nextTrack.label : `${nextTrack.label} ready`);

  if (shouldPlay) {
    ambientAudioStarted = true;
    const playPromise = purrAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        updateAudioStatus('Audio blocked');
      });
    }
  }
}

function updateAudioStatus(text) {
  if (audioStateEl) {
    audioStateEl.textContent = text;
  }
}

function createRandomWall() {
  const wallMargin = 72;
  const minHalfLength = 48;
  const maxHalfLength = 180;

  for (let attempt = 0; attempt < 60; attempt++) {
    const centerX = random(wallMargin, worldW - wallMargin);
    const centerY = random(wallMargin, worldH - wallMargin);
    const direction = random(RANDOM_WALL_DIRECTIONS);
    const directionLength = Math.hypot(direction.x, direction.y);
    const halfLength = random(minHalfLength, maxHalfLength);
    const offsetX = (direction.x / directionLength) * halfLength;
    const offsetY = (direction.y / directionLength) * halfLength;
    const x1 = centerX - offsetX;
    const y1 = centerY - offsetY;
    const x2 = centerX + offsetX;
    const y2 = centerY + offsetY;

    if (
      x1 >= wallMargin && x1 <= (worldW - wallMargin) &&
      x2 >= wallMargin && x2 <= (worldW - wallMargin) &&
      y1 >= wallMargin && y1 <= (worldH - wallMargin) &&
      y2 >= wallMargin && y2 <= (worldH - wallMargin)
    ) {
      return new Boundary(x1, y1, x2, y2, 20);
    }
  }

  return new Boundary(worldW * 0.35, worldH * 0.5, worldW * 0.65, worldH * 0.5, 20);
}

function addWalls() {
  for (let index = BORDER_WALL_COUNT; index < wallCount; index++) {
    walls[index] = createRandomWall();
  }
}

function updateWalls() {
  const nextWallCount = Number(sliderWall.value());

  while (walls.length < nextWallCount) {
    walls.push(createRandomWall());
  }

  while (walls.length > nextWallCount) {
    walls.pop();
  }

  wallCount = nextWallCount;
  updateHudValues();
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getCameraOffset() {
  return {
    x: particle.pos.x - (viewW / 2),
    y: particle.pos.y - (mapViewH / 2),
  };
}

function focusSlider(index) {
  shortcutBindings[index]?.focus();
}

function cloneWall(wall) {
  return new Boundary(wall.x1, wall.y1, wall.x2, wall.y2, 20);
}

function captureDefaultState() {
  defaultState = getCurrentSettings();
}

function resetToDefaults() {
  if (!defaultState) {
    return;
  }

  sliderFOV.value(defaultState.fov);
  particle.updateFOV(defaultState.fov);
  syncViewPadFromSliders();

  sliderFish.value(defaultState.fish);
  syncViewPadFromSliders();

  sliderDensity.value(defaultState.density);
  particle.updateDensity(defaultState.density);

  if (sliderFpsCap && Number.isFinite(defaultState.fpsCap)) {
    sliderFpsCap.value(defaultState.fpsCap);
    frameRate(defaultState.fpsCap);
  }

  if (Number.isFinite(defaultState.purrTrackIndex)) {
    setPurrTrack(defaultState.purrTrackIndex, ambientAudioStarted);
  }

  setChaosPadValues(defaultState.distance, defaultState.depthContrast);

  particle.pos.x = defaultState.playerX;
  particle.pos.y = defaultState.playerY;
  particle.heading = defaultState.playerHeading;
  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;

  sliderWall.value(defaultState.wallCount);
  wallCount = defaultState.wallCount;
  walls = defaultState.walls.map(cloneWall);

  for (const binding of shortcutBindings) {
    binding.lastTick = 0;
  }

  updateHudValues();
}

function getCurrentSettings() {
  return {
    savedAt: new Date().toISOString(),
    worldWidth: worldW,
    worldHeight: worldH,
    fov: Number(sliderFOV.value()),
    wallCount: Number(sliderWall.value()),
    fish: Number(sliderFish.value()),
    density: Number(sliderDensity.value()),
    fpsCap: sliderFpsCap ? Number(sliderFpsCap.value()) : DEFAULT_FPS_CAP,
    purrTrackIndex: activePurrTrackIndex,
    distance: distanceSpreadValue,
    depthContrast: depthContrastValue,
    playerX: particle.pos.x,
    playerY: particle.pos.y,
    playerHeading: particle.heading,
    walls: walls.map((wall) => ({
      x1: wall.x1,
      y1: wall.y1,
      x2: wall.x2,
      y2: wall.y2,
      width: wall.width,
    })),
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  if (Number.isFinite(settings.fov)) {
    sliderFOV.value(clamp(settings.fov, Number(sliderFOV.elt.min), Number(sliderFOV.elt.max)));
    particle.updateFOV(Number(sliderFOV.value()));
    syncViewPadFromSliders();
  }

  if (Number.isFinite(settings.fish)) {
    sliderFish.value(clamp(settings.fish, Number(sliderFish.elt.min), Number(sliderFish.elt.max)));
    syncViewPadFromSliders();
  }

  if (Number.isFinite(settings.density)) {
    sliderDensity.value(clamp(settings.density, Number(sliderDensity.elt.min), Number(sliderDensity.elt.max)));
    particle.updateDensity(Number(sliderDensity.value()));
  }

  if (sliderFpsCap && Number.isFinite(settings.fpsCap)) {
    sliderFpsCap.value(clamp(settings.fpsCap, FPS_CAP_MIN, FPS_CAP_MAX));
    frameRate(Number(sliderFpsCap.value()));
  }

  if (Number.isFinite(settings.purrTrackIndex)) {
    setPurrTrack(settings.purrTrackIndex, ambientAudioStarted);
  }

  if (Number.isFinite(settings.distance) || Number.isFinite(settings.depthContrast)) {
    setChaosPadValues(
      Number.isFinite(settings.distance) ? settings.distance : distanceSpreadValue,
      Number.isFinite(settings.depthContrast) ? settings.depthContrast : depthContrastValue
    );
  }

  const restoredWalls = Array.isArray(settings.walls)
    ? settings.walls
      .filter((wall) => wall && [wall.x1, wall.y1, wall.x2, wall.y2].every(Number.isFinite))
      .map((wall) => new Boundary(wall.x1, wall.y1, wall.x2, wall.y2, 20))
    : [];

  if (restoredWalls.length >= BORDER_WALL_COUNT) {
    walls = restoredWalls;
    wallCount = restoredWalls.length;
    sliderWall.value(clamp(wallCount, Number(sliderWall.elt.min), Number(sliderWall.elt.max)));
  } else if (Number.isFinite(settings.wallCount)) {
    sliderWall.value(clamp(settings.wallCount, Number(sliderWall.elt.min), Number(sliderWall.elt.max)));
    updateWalls();
  }

  if (Number.isFinite(settings.playerX)) {
    particle.pos.x = settings.playerX;
  }

  if (Number.isFinite(settings.playerY)) {
    particle.pos.y = settings.playerY;
  }

  if (Number.isFinite(settings.playerHeading)) {
    particle.heading = settings.playerHeading;
  }

  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;

  updateHudValues();
  return true;
}

function saveCurrentSettingsToStorage() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getCurrentSettings()));
    return true;
  } catch (error) {
    updateAudioStatus('Save blocked');
    return false;
  }
}

function loadSettingsFromStorage() {
  try {
    const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawSettings) {
      return false;
    }

    const parsedSettings = JSON.parse(rawSettings);
    return applySettings(parsedSettings);
  } catch (error) {
    return false;
  }
}

function cycleSlider(binding) {
  const minValue = binding.min;
  const maxValue = binding.max;
  const stepValue = binding.step;
  let nextValue = binding.getValue() + stepValue;

  if (nextValue > maxValue) {
    nextValue = minValue;
  }

  if (stepValue < 1) {
    nextValue = Number(nextValue.toFixed(2));
  }

  binding.setValue(nextValue);

  if (binding.onChange) {
    binding.onChange();
  }

  updateHudValues();
}

function processSliderShortcuts() {
  const shortcutCodes = [49, 50, 51, 52, 53, 54];
  const now = millis();

  for (let index = 0; index < shortcutBindings.length; index++) {
    const binding = shortcutBindings[index];
    const isDown = keyIsDown(shortcutCodes[index]);

    if (!isDown) {
      binding.lastTick = 0;
      continue;
    }

    if (binding.lastTick === 0 || (now - binding.lastTick) >= SLIDER_HOLD_REPEAT_MS) {
      focusSlider(index);
      cycleSlider(binding);
      binding.lastTick = now;
    }
  }
}

function isSaveShortcutHeld() {
  return keyIsDown(CONTROL) || keyIsDown(91) || keyIsDown(93);
}

function handleInput() {
  const moveSpeed = keyIsDown(16) ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED;
  const saveShortcutHeld = isSaveShortcutHeld();

  if (keyIsDown(65)) {
    particle.rotate(-ROTATION_SPEED);
  }

  if (keyIsDown(68)) {
    particle.rotate(ROTATION_SPEED);
  }

  if (keyIsDown(87)) {
    particle.move(moveSpeed, worldW, worldH);
  }

  if (keyIsDown(83) && !saveShortcutHeld) {
    particle.move(-moveSpeed, worldW, worldH);
  }
}

function updateMovementSpeed() {
  const dx = particle.pos.x - lastPlayerX;
  const dy = particle.pos.y - lastPlayerY;
  const frameDistance = Math.hypot(dx, dy);
  currentSpeedPxPerSecond = deltaTime > 0 ? (frameDistance * 1000) / deltaTime : 0;
  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;
}

function rebuildFloorDots() {
  const floorHeight = renderViewH / 2;
  const dotCount = Math.max(120, Math.floor(viewW * floorHeight * FLOOR_DOT_DENSITY));
  floorDots = [];

  for (let index = 0; index < dotCount; index++) {
    floorDots.push({
      x: random(0, viewW),
      y: random(floorHeight, renderViewH),
      size: random(1, 3.2),
    });
  }
}

function initAmbientAudio() {
  setPurrTrack(activePurrTrackIndex, true);
}

function drawWorldGradient() {
  const gradient = drawingContext.createLinearGradient(0, 0, worldW, worldH);
  gradient.addColorStop(0, MAP_GRADIENT_START);
  gradient.addColorStop(1, MAP_GRADIENT_END);
  drawingContext.fillStyle = gradient;
  drawingContext.fillRect(0, 0, worldW, worldH);
}

function drawRotatedScaleLabel(label, x, y, angle) {
  push();
  translate(x, y);
  rotate(angle);
  text(label, 0, 0);
  pop();
}

function drawExteriorWallScale() {
  const labelValues = [1, 25, 50, 75, 100];
  const tickInsetMinor = 6;
  const tickInsetMajor = 12;
  const labelInset = 18;
  const iconInset = 32;

  push();
  textAlign(CENTER, CENTER);
  textSize(10);
  stroke(255, 70);
  fill(220, 228, 245, 150);

  for (let percent = 0; percent <= 100; percent += 10) {
    const normalized = percent / 100;
    const x = normalized * worldW;
    const y = normalized * worldH;
    const tickSize = percent % 25 === 0 ? tickInsetMajor : tickInsetMinor;

    line(x, 0, x, tickSize);
    line(x, worldH, x, worldH - tickSize);
    line(0, y, tickSize, y);
    line(worldW, y, worldW - tickSize, y);
  }

  noStroke();
  for (const labelValue of labelValues) {
    const normalized = labelValue === 1 ? 0 : labelValue / 100;
    const x = normalized * worldW;
    const y = normalized * worldH;
    const label = String(labelValue);

    text(label, x, labelInset);
    text(label, x, worldH - labelInset);
    drawRotatedScaleLabel(label, labelInset, y, -HALF_PI);
    drawRotatedScaleLabel(label, worldW - labelInset, y, HALF_PI);
  }

  textSize(14);
  text(EXTERIOR_SCALE_ICON, worldW / 2, iconInset);
  text(EXTERIOR_SCALE_ICON, worldW / 2, worldH - iconInset);
  text(EXTERIOR_SCALE_ICON, iconInset, worldH / 2);
  text(EXTERIOR_SCALE_ICON, worldW - iconInset, worldH / 2);
  pop();
}

function drawMap(camera, hitX, hitY, hitVisible) {
  rectMode(CORNER);
  fill(8);
  noStroke();
  rect(0, 0, viewW, mapViewH);

  push();
  translate(-camera.x, -camera.y);
  drawWorldGradient();

  for (const wall of walls) {
    wall.show();
  }

  stroke(255, 100);
  strokeWeight(1);
  for (let index = 0; index < hitVisible.length; index++) {
    if (hitVisible[index]) {
      line(particle.pos.x, particle.pos.y, hitX[index], hitY[index]);
    }
  }

  particle.show();
  drawExteriorWallScale();
  pop();

  noFill();
  stroke(255, 35);
  rect(0, 0, viewW - 1, mapViewH - 1);
}

function drawSceneFloorGradient() {
  const ceilingGradient = drawingContext.createLinearGradient(0, 0, viewW, renderViewH / 2);
  ceilingGradient.addColorStop(0, CEILING_GRADIENT_START);
  ceilingGradient.addColorStop(1, CEILING_GRADIENT_END);
  drawingContext.fillStyle = ceilingGradient;
  drawingContext.fillRect(0, 0, viewW, renderViewH / 2);

  const floorGradient = drawingContext.createLinearGradient(0, renderViewH / 2, viewW, renderViewH);
  floorGradient.addColorStop(0, FLOOR_GRADIENT_START);
  floorGradient.addColorStop(1, FLOOR_GRADIENT_END);
  drawingContext.fillStyle = floorGradient;
  drawingContext.fillRect(0, renderViewH / 2, viewW, renderViewH / 2);

  drawingContext.fillStyle = FLOOR_DOT_COLOR;
  for (const dot of floorDots) {
    drawingContext.beginPath();
    drawingContext.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
    drawingContext.fill();
  }
}

function getFishEyeProjectionFactor(index, rayCount) {
  if (rayCount <= 1) {
    return 1;
  }

  const normalizedX = ((index / (rayCount - 1)) * 2) - 1;
  const curvedX = Math.sin(normalizedX * (Math.PI / 2));
  const projectionAngle = curvedX * radians(FISH_EYE_MAX_PROJECTION_DEG);
  const cosineFactor = Math.cos(projectionAngle);
  return Math.max(0.35, Math.pow(cosineFactor, 0.85));
}

function applyDistanceSpread(depthRatio, strength) {
  if (strength <= 0) {
    return depthRatio;
  }

  const spread = lerp(1, 1.7, strength);
  return clamp(0.5 + ((depthRatio - 0.5) * spread), 0, 1);
}

function applyDepthContrast(depthRatio, strength) {
  if (strength <= 0) {
    return depthRatio;
  }

  const safeRatio = clamp(depthRatio, 0.0001, 0.9999);
  const exponent = lerp(1, 2.35, strength);
  const nearSide = Math.pow(safeRatio, exponent);
  const farSide = Math.pow(1 - safeRatio, exponent);

  return nearSide / (nearSide + farSide);
}

function getProximityShadow(distance) {
  if (!Number.isFinite(distance) || distance >= PROXIMITY_SHADOW_START) {
    return 0;
  }

  const clampedDistance = Math.max(1, distance);
  return map(clampedDistance, PROXIMITY_SHADOW_START, 1, 0, PROXIMITY_SHADOW_MAX, true);
}

function drawScene(scene) {
  const maxDepth = Math.hypot(worldW, worldH);
  const columnWidth = viewW / scene.length;
  const fishStrength = Math.pow(Number(sliderFish.value()) / 100, 0.85) * 0.92;
  const distanceStrength = distanceSpreadValue / 100;
  const depthContrastStrength = depthContrastValue / 100;

  push();
  translate(0, mapViewH);

  noStroke();
  drawSceneFloorGradient();
  rectMode(CENTER);

  for (let index = 0; index < scene.length; index++) {
    const projectionFactor = getFishEyeProjectionFactor(index, scene.length);
    const correctedDist = scene[index] * lerp(1, projectionFactor, fishStrength);
    const baseDepthRatio = clamp(correctedDist / maxDepth, 0, 1);
    const spreadDepthRatio = applyDistanceSpread(baseDepthRatio, distanceStrength);
    const shapedDepthRatio = applyDepthContrast(spreadDepthRatio, depthContrastStrength);
    const shapedDist = shapedDepthRatio * maxDepth;
    const height = map(shapedDist, 0, maxDepth, renderViewH * 1.7, 0, true);
    const shadow = getProximityShadow(correctedDist);
    const tint = shapedDepthRatio;
    const r = Math.max(0, lerp(249, 0, tint) - shadow);
    const g = Math.max(0, lerp(200, 50, tint) - shadow);
    const b = Math.max(0, lerp(150, 0, tint) - shadow);

    fill(r, g, b);
    rect((index * columnWidth) + (columnWidth / 2), renderViewH / 2, columnWidth + 1, height);
  }

  pop();
}

function updateFpsHud() {
  const currentFps = frameRate();
  fpsSmoothed = lerp(fpsSmoothed, currentFps, 0.12);

  if (Number.isFinite(currentFps) && currentFps > 0) {
    fpsMin = Math.min(fpsMin, currentFps);
    fpsMax = Math.max(fpsMax, currentFps);
    fpsTotal += currentFps;
    fpsSamples += 1;
  }

  const avgFps = fpsSamples > 0 ? fpsTotal / fpsSamples : fpsSmoothed;

  if (fpsPrimaryEl) {
    fpsPrimaryEl.textContent = `${fpsSmoothed.toFixed(1)} FPS`;
  }

  if (speedValueEl) {
    speedValueEl.textContent = `${currentSpeedPxPerSecond.toFixed(0)} px/s`;
  }

  if (fpsAvgEl) {
    fpsAvgEl.textContent = avgFps.toFixed(1);
  }

  if (fpsMinEl) {
    fpsMinEl.textContent = Number.isFinite(fpsMin) ? fpsMin.toFixed(1) : '0.0';
  }

  if (fpsMaxEl) {
    fpsMaxEl.textContent = fpsMax > 0 ? fpsMax.toFixed(1) : '0.0';
  }
}

function draw() {
  background(0);
  handleInput();
  updateMovementSpeed();
  processSliderShortcuts();

  const { scene, hitX, hitY, hitVisible } = particle.look(walls);
  const camera = getCameraOffset();

  drawMap(camera, hitX, hitY, hitVisible);
  drawScene(scene);
  updateFpsHud();
}

function keyPressed() {
  initAmbientAudio();

if ((key === 's' || key === 'S') && isSaveShortcutHeld()) {
    saveCurrentSettingsToStorage();
    return false;
  }

  if (key === 'r' || key === 'R') {
    resetToDefaults();
    return false;
  }

  const sliderIndex = Number(key) - 1;
  if (sliderIndex >= 0 && sliderIndex < shortcutBindings.length) {
    focusSlider(sliderIndex);
    return false;
  }
}

function mousePressed() {
  initAmbientAudio();
}

function touchStarted() {
  initAmbientAudio();
  return false;
}

function windowResized() {
  updateViewportSize();
  resizeCanvas(viewW, viewH);
  rebuildFloorDots();
  syncViewPadFromSliders();
  setChaosPadValues(distanceSpreadValue, depthContrastValue);
}


