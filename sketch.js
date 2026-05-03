const BORDER_WALL_COUNT = 4;
const MOVE_SPEED = 3;
const SPRINT_MULTIPLIER = 1.5;
const ROTATION_SPEED = 0.03;
const WORLD_SCALE = 2;
const CONTROL_LEFT = 16;
const CONTROL_TOP = 16;
const CONTROL_SPACING = 28;
const CONTROL_WIDTH = 320;
const CONTROL_OPACITY = 0.66;
const MAX_VIEW_ANGLE = 478;
const WORLD_GRADIENT_END = '#303030';
const FLOOR_GRADIENT_START = '#040a18';
const FLOOR_GRADIENT_END = '#303030';
const FLOOR_DOT_COLOR = 'rgba(70, 70, 70, 0.35)';
const FLOOR_DOT_DENSITY = 0.00008;
const SLIDER_HOLD_REPEAT_MS = 80;
const FISH_EYE_MAX_PROJECTION_DEG = 82;
const MAX_RAY_DENSITY = 8.0;
const CHAOS_PAD_SIZE = 132;
const PAD_ROW_GAP = 10;
const VIEW_PAD_LEFT = CONTROL_LEFT + CHAOS_PAD_SIZE + 14;
const PROXIMITY_SHADOW_START = 500;
const PROXIMITY_SHADOW_MAX = 171;
const SETTINGS_STORAGE_KEY = 'ray-casting-settings-v1';
const EXTERIOR_SCALE_ICON = '\u{1F431}';
const FPS_CAP_MIN = 6;
const FPS_CAP_MAX = 60;
const DEFAULT_FPS_CAP = 60;
const MINIMAP_OPACITY = 0.3;
const MINIMAP_MARGIN = 16;
const MINIMAP_MAX_WIDTH = 240;
const MINIMAP_MAX_HEIGHT = 168;
const MINIMAP_MIN_WIDTH = 164;
const WALL_SCALE_MIN = 10;
const WALL_SCALE_MAX = 400;
const DEFAULT_WALL_SCALE = 100;
const DEFAULT_WALL_ROUNDNESS = 0;
const CLASSIC_WALL_REFERENCE_DISTANCE_RATIO = 0.08;
const DEFAULT_TOP_PERSPECTIVE = 46;
const TOP_PERSPECTIVE_MIN = 0;
const TOP_PERSPECTIVE_MAX = 100;
const TOP_VIEW_GRID_STEP = 96;
const TOP_EXTRUSION_MIN = 0;
const TOP_EXTRUSION_MAX = 84;
const TOP_CAP_SCALE_MAX = 0.22;
const HUD_FEEDBACK_DURATION_MS = 1200;
const SPLIT_VIEW_MIN = 20;
const SPLIT_VIEW_MAX = 80;
const DEFAULT_SPLIT_VIEW = 50;
const DEFAULT_NEAR_WALL_COLOR = { r: 255, g: 194, b: 146 };
const DEFAULT_FAR_WALL_COLOR = { r: 34, g: 52, b: 12 };
const RANDOM_WALL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
];
const PURR_TRACKS = [
  { icon: '🐱', src: 'assets/audio/cat_purring_13s.ogg' },
  { icon: '🐈', src: 'assets/audio/cat_purring_fire_37s.ogg' },
  { icon: '😺', src: 'assets/audio/cat_purring_53s.ogg' },
];
const CATNIP_PICKUP_RADIUS = 20;
const CATNIP_BOOST_MULTIPLIER = 2;
const CATNIP_BOOST_DURATION_MS = 10000;
const CATNIP_ICON = '🌿';

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
let sliderCatnip;
let sliderWallScale;
let sliderWallRoundness;
let sliderTopPerspective;
let sliderSplitView;
let sliderNearWallR;
let sliderNearWallG;
let sliderNearWallB;
let sliderFarWallR;
let sliderFarWallG;
let sliderFarWallB;
let shortcutBindings = [];
let wallCount = 6;
let ambientAudioStarted = false;
let purrAudio = null;
let activePurrTrackIndex = 0;
let floorDots = [];
let defaultState = null;
let fpsSmoothed = 60;
let fpsMin = Infinity;
let fpsMax = 0;
let fpsTotal = 0;
let fpsSamples = 0;
let fpsPanelExpanded = false;
let currentSpeedPxPerSecond = 0;
let lastPlayerX = 0;
let lastPlayerY = 0;
let chaosPad;
let chaosPadKnob;
let chaosPadActive = false;
let viewPad;
let viewPadKnob;
let viewPadActive = false;
let distanceSpreadValue = 0;
let depthContrastValue = 0;
let sliderFpsCap;
let catnips = [];
let catnipTargetCount = 0;
let catnipBoostUntilMs = 0;
let hudVisible = true;
let exteriorCatButtons = [];
let hudFeedbackLabel = '';
let hudFeedbackValue = '';
let hudFeedbackUntilMs = 0;
let wallColorControlsVisible = false;

function setup() {
  updateViewportSize();
  worldW = viewW * WORLD_SCALE;
  worldH = mapViewH * WORLD_SCALE;

  createCanvas(viewW, viewH);
  pixelDensity(1);

  particle = new Particle();
  particle.pos = { x: worldW / 2, y: worldH / 2 };
  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;

  rebuildWalls();
  createControls();
  layoutControls();
  loadSettingsFromStorage();
  captureDefaultState();
  rebuildFloorDots();
  window.addEventListener('pointerdown', initAmbientAudio, { once: true });
  window.addEventListener('keydown', initAmbientAudio, { once: true });
}

function updateViewportSize() {
  viewW = windowWidth;
  viewH = windowHeight;
  const splitPercent = sliderSplitView ? Number(sliderSplitView.value()) : DEFAULT_SPLIT_VIEW;
  mapViewH = Math.floor(viewH * clamp(splitPercent / 100, SPLIT_VIEW_MIN / 100, SPLIT_VIEW_MAX / 100));
  renderViewH = viewH - mapViewH;
}

function getPadTop() {
  return CONTROL_TOP + (CONTROL_SPACING * 9) + PAD_ROW_GAP;
}

function createBorderWall(x1, y1, x2, y2) {
  return new Boundary(x1, y1, x2, y2, 20, {
    isExterior: true,
    baseX1: x1,
    baseY1: y1,
    baseX2: x2,
    baseY2: y2,
    baseWidth: 20,
  });
}

function createInteriorWall(x1, y1, x2, y2, width) {
  return new Boundary(x1, y1, x2, y2, width, {
    isExterior: false,
    baseX1: x1,
    baseY1: y1,
    baseX2: x2,
    baseY2: y2,
    baseWidth: width,
  });
}

function rebuildWalls() {
  walls = buildBorderWalls();

  addWalls();
  applyInteriorWallScale();
}

function buildBorderWalls() {
  return [
    createBorderWall(0, 0, worldW, 0),
    createBorderWall(worldW, 0, worldW, worldH),
    createBorderWall(worldW, worldH, 0, worldH),
    createBorderWall(0, worldH, 0, 0),
  ];
}

function scaleSettingsToWorld(settings, sourceWorldW, sourceWorldH, targetWorldW, targetWorldH) {
  if (!settings || !Number.isFinite(sourceWorldW) || !Number.isFinite(sourceWorldH) || sourceWorldW <= 0 || sourceWorldH <= 0) {
    return settings;
  }

  const scaleX = targetWorldW / sourceWorldW;
  const scaleY = targetWorldH / sourceWorldH;
  const widthScale = (scaleX + scaleY) / 2;
  const borderWalls = buildBorderWalls();

  return {
    ...settings,
    worldWidth: targetWorldW,
    worldHeight: targetWorldH,
    playerX: Number.isFinite(settings.playerX) ? settings.playerX * scaleX : settings.playerX,
    playerY: Number.isFinite(settings.playerY) ? settings.playerY * scaleY : settings.playerY,
    walls: Array.isArray(settings.walls)
      ? settings.walls.map((wall, index) => {
        if (index < BORDER_WALL_COUNT || wall.isExterior) {
          return borderWalls[index] ?? borderWalls[index % BORDER_WALL_COUNT];
        }

        const baseX1 = Number.isFinite(wall.baseX1) ? wall.baseX1 : wall.x1;
        const baseY1 = Number.isFinite(wall.baseY1) ? wall.baseY1 : wall.y1;
        const baseX2 = Number.isFinite(wall.baseX2) ? wall.baseX2 : wall.x2;
        const baseY2 = Number.isFinite(wall.baseY2) ? wall.baseY2 : wall.y2;
        const baseWidth = Number.isFinite(wall.baseWidth) ? wall.baseWidth : wall.width;

        return createInteriorWall(
          baseX1 * scaleX,
          baseY1 * scaleY,
          baseX2 * scaleX,
          baseY2 * scaleY,
          baseWidth * widthScale
        );
      })
      : settings.walls,
    catnips: Array.isArray(settings.catnips)
      ? settings.catnips.map((catnip) => ({
        x: catnip.x * scaleX,
        y: catnip.y * scaleY,
      }))
      : settings.catnips,
  };
}

function rescaleWorldState(previousWorldW, previousWorldH) {
  if (!Number.isFinite(previousWorldW) || !Number.isFinite(previousWorldH) || previousWorldW <= 0 || previousWorldH <= 0) {
    return;
  }

  const scaleX = worldW / previousWorldW;
  const scaleY = worldH / previousWorldH;
  const widthScale = (scaleX + scaleY) / 2;
  const scaledWalls = [];
  const borderWalls = buildBorderWalls();

  for (let index = 0; index < walls.length; index++) {
    if (index < BORDER_WALL_COUNT) {
      scaledWalls[index] = borderWalls[index];
      continue;
    }

    const wall = walls[index];
    scaledWalls[index] = createInteriorWall(
      wall.baseX1 * scaleX,
      wall.baseY1 * scaleY,
      wall.baseX2 * scaleX,
      wall.baseY2 * scaleY,
      wall.baseWidth * widthScale
    );
  }

  walls = scaledWalls;
  applyInteriorWallScale();
  particle.pos.x *= scaleX;
  particle.pos.y *= scaleY;
  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;
  catnips = catnips.map((catnip) => ({
    x: catnip.x * scaleX,
    y: catnip.y * scaleY,
  }));

  if (defaultState) {
    defaultState = scaleSettingsToWorld(defaultState, previousWorldW, previousWorldH, worldW, worldH);
  }
}

function styleSlider(slider, shortcutKey, label) {
  slider.addClass('hud-control');
  slider.addClass('hud-slider');
  slider.style('width', `${CONTROL_WIDTH}px`);
  slider.elt.title = `${shortcutKey} - ${label}`;
}

function createWallColorSlider(label, initialValue) {
  const slider = createSlider(0, 255, initialValue, 1);
  styleSlider(slider, 'C', label);
  slider.input(() => {
    showHudFeedback(label, `${Math.round(Number(slider.value()))}`);
  });
  slider.hide();
  return slider;
}

function getWallColorControls() {
  return [
    sliderNearWallR,
    sliderNearWallG,
    sliderNearWallB,
    sliderFarWallR,
    sliderFarWallG,
    sliderFarWallB,
  ].filter(Boolean);
}

function getColorControlLeft() {
  return viewW - CONTROL_WIDTH - 16;
}

function layoutWallColorControls() {
  const left = getColorControlLeft();
  const top = 72;
  const controls = getWallColorControls();

  for (let index = 0; index < controls.length; index++) {
    controls[index].position(left, top + (index * CONTROL_SPACING));
  }
}

function setWallColorControlsVisible(visible) {
  wallColorControlsVisible = visible;
  for (const control of getWallColorControls()) {
    if (hudVisible && wallColorControlsVisible) {
      control.show();
    } else {
      control.hide();
    }
  }
}

function getWallColorConfig() {
  return {
    near: {
      r: sliderNearWallR ? Number(sliderNearWallR.value()) : DEFAULT_NEAR_WALL_COLOR.r,
      g: sliderNearWallG ? Number(sliderNearWallG.value()) : DEFAULT_NEAR_WALL_COLOR.g,
      b: sliderNearWallB ? Number(sliderNearWallB.value()) : DEFAULT_NEAR_WALL_COLOR.b,
    },
    far: {
      r: sliderFarWallR ? Number(sliderFarWallR.value()) : DEFAULT_FAR_WALL_COLOR.r,
      g: sliderFarWallG ? Number(sliderFarWallG.value()) : DEFAULT_FAR_WALL_COLOR.g,
      b: sliderFarWallB ? Number(sliderFarWallB.value()) : DEFAULT_FAR_WALL_COLOR.b,
    },
  };
}

function showHudFeedback(label, value) {
  hudFeedbackLabel = label;
  hudFeedbackValue = value;
  hudFeedbackUntilMs = millis() + HUD_FEEDBACK_DURATION_MS;
}

function formatSliderValue(value, digits = 0) {
  return digits > 0 ? Number(value).toFixed(digits) : String(Math.round(value));
}

function applyInteriorWallScale(showFeedback = false) {
  const wallScalePercent = sliderWallScale ? Number(sliderWallScale.value()) : DEFAULT_WALL_SCALE;

  for (let index = BORDER_WALL_COUNT; index < walls.length; index++) {
    walls[index].applyScale(wallScalePercent);
  }

  if (showFeedback && sliderWallScale) {
    showHudFeedback('Interior wall scale', `${Math.round(wallScalePercent)}%`);
  }
}

function createControls() {
  sliderFOV = createSlider(10, MAX_VIEW_ANGLE, particle.viewAngle);
  sliderFOV.input(() => {
    particle.updateFOV(sliderFOV.value());
    syncViewPadFromSliders();
    showHudFeedback('Field of view', `${Math.round(Number(sliderFOV.value()))}°`);
  });
  styleSlider(sliderFOV, '1', 'Field of view');

  sliderWall = createSlider(BORDER_WALL_COUNT, 24, wallCount);
  sliderWall.input(() => updateWalls(true));
  styleSlider(sliderWall, '2', 'Wall count');

  sliderFish = createSlider(0, 100, 100);
  sliderFish.input(() => {
    syncViewPadFromSliders();
    showHudFeedback('Fish-eye correction', `${Math.round(Number(sliderFish.value()))}%`);
  });
  styleSlider(sliderFish, '3', 'Fish-eye correction');

  sliderDensity = createSlider(0.5, MAX_RAY_DENSITY, particle.rayDensity, 0.1);
  sliderDensity.input(() => {
    particle.updateDensity(sliderDensity.value());
    showHudFeedback('Ray density', formatSliderValue(sliderDensity.value(), 1));
  });
  styleSlider(sliderDensity, '4', 'Ray density');

  sliderCatnip = createSlider(0, 24, 0, 1);
  sliderCatnip.input(() => updateCatnipsFromSlider(true));
  styleSlider(sliderCatnip, '7', 'Catnip count');

  sliderWallScale = createSlider(WALL_SCALE_MIN, WALL_SCALE_MAX, DEFAULT_WALL_SCALE, 1);
  sliderWallScale.input(() => applyInteriorWallScale(true));
  styleSlider(sliderWallScale, '8', 'Interior wall scale');

  sliderWallRoundness = createSlider(0, 100, DEFAULT_WALL_ROUNDNESS, 1);
  sliderWallRoundness.input(() => {
    showHudFeedback('Wall roundness', `${Math.round(Number(sliderWallRoundness.value()))}%`);
  });
  styleSlider(sliderWallRoundness, '9', 'Wall roundness');

  sliderTopPerspective = createSlider(TOP_PERSPECTIVE_MIN, TOP_PERSPECTIVE_MAX, DEFAULT_TOP_PERSPECTIVE, 1);
  sliderTopPerspective.input(() => {
    showHudFeedback('Top depth', `${Math.round(Number(sliderTopPerspective.value()))}%`);
  });
  styleSlider(sliderTopPerspective, '0', 'Top depth');

  sliderSplitView = createSlider(SPLIT_VIEW_MIN, SPLIT_VIEW_MAX, DEFAULT_SPLIT_VIEW, 1);
  sliderSplitView.input(() => handleSplitViewChange(true));
  styleSlider(sliderSplitView, '-', 'Split height');

  sliderNearWallR = createWallColorSlider('Near wall red', DEFAULT_NEAR_WALL_COLOR.r);
  sliderNearWallG = createWallColorSlider('Near wall green', DEFAULT_NEAR_WALL_COLOR.g);
  sliderNearWallB = createWallColorSlider('Near wall blue', DEFAULT_NEAR_WALL_COLOR.b);
  sliderFarWallR = createWallColorSlider('Far wall red', DEFAULT_FAR_WALL_COLOR.r);
  sliderFarWallG = createWallColorSlider('Far wall green', DEFAULT_FAR_WALL_COLOR.g);
  sliderFarWallB = createWallColorSlider('Far wall blue', DEFAULT_FAR_WALL_COLOR.b);

  createChaosPad();
  createViewPad();
  createFpsCapSlider();

  shortcutBindings = [
    createSliderBinding(sliderFOV, 1, () => {
      particle.updateFOV(sliderFOV.value());
      syncViewPadFromSliders();
      showHudFeedback('Field of view', `${Math.round(Number(sliderFOV.value()))}°`);
    }),
    createSliderBinding(sliderWall, 1, () => updateWalls(true)),
    createSliderBinding(sliderFish, 1, () => {
      syncViewPadFromSliders();
      showHudFeedback('Fish-eye correction', `${Math.round(Number(sliderFish.value()))}%`);
    }),
    createSliderBinding(sliderDensity, 0.1, () => {
      particle.updateDensity(sliderDensity.value());
      showHudFeedback('Ray density', formatSliderValue(sliderDensity.value(), 1));
    }),
    createCustomBinding({
      min: 0,
      max: 100,
      step: 1,
      focus: () => focusChaosPad(),
      getValue: () => distanceSpreadValue,
      setValue: (value) => setChaosPadValues(value, depthContrastValue, true),
    }),
    createCustomBinding({
      min: 0,
      max: 100,
      step: 1,
      focus: () => focusChaosPad(),
      getValue: () => depthContrastValue,
      setValue: (value) => setChaosPadValues(distanceSpreadValue, value, true),
    }),
    createSliderBinding(sliderCatnip, 1, () => updateCatnipsFromSlider(true)),
    createSliderBinding(sliderWallScale, 1, () => applyInteriorWallScale(true)),
    createSliderBinding(sliderWallRoundness, 1, () => {
      showHudFeedback('Wall roundness', `${Math.round(Number(sliderWallRoundness.value()))}%`);
    }),
    createSliderBinding(sliderTopPerspective, 1, () => {
      showHudFeedback('Top depth', `${Math.round(Number(sliderTopPerspective.value()))}%`);
    }),
  ];
}

function layoutControls() {
  sliderFOV.position(CONTROL_LEFT, CONTROL_TOP);
  sliderWall.position(CONTROL_LEFT, CONTROL_TOP + CONTROL_SPACING);
  sliderFish.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 2));
  sliderDensity.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 3));
  sliderCatnip.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 4));
  sliderWallScale.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 5));
  sliderWallRoundness.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 6));
  sliderTopPerspective.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 7));
  sliderSplitView.position(CONTROL_LEFT, CONTROL_TOP + (CONTROL_SPACING * 8));
  layoutWallColorControls();

  if (chaosPad) {
    chaosPad.position(CONTROL_LEFT, getPadTop());
  }

  if (viewPad) {
    viewPad.position(VIEW_PAD_LEFT, getPadTop());
  }
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

function createChaosPad() {
  chaosPad = createDiv('');
  chaosPad.addClass('hud-control');
  chaosPad.addClass('hud-pad');
  chaosPad.attribute('title', 'Depth pad: X = distance spread, Y = depth contrast');
  chaosPad.elt.tabIndex = 0;

  chaosPadKnob = createDiv('');
  chaosPadKnob.addClass('hud-pad-knob');
  chaosPadKnob.parent(chaosPad);

  chaosPad.elt.addEventListener('pointerdown', (event) => {
    chaosPadActive = true;
    chaosPad.addClass('active');
    chaosPad.elt.setPointerCapture?.(event.pointerId);
    updateChaosPadFromPointer(event.clientX, event.clientY);
  });

  chaosPad.elt.addEventListener('pointermove', (event) => {
    if (chaosPadActive) {
      updateChaosPadFromPointer(event.clientX, event.clientY);
    }
  });

  chaosPad.elt.addEventListener('pointerup', () => {
    chaosPadActive = false;
    chaosPad.removeClass('active');
  });

  chaosPad.elt.addEventListener('pointercancel', () => {
    chaosPadActive = false;
    chaosPad.removeClass('active');
  });

  setChaosPadValues(0, 0);
}

function createViewPad() {
  viewPad = createDiv('');
  viewPad.addClass('hud-control');
  viewPad.addClass('hud-pad');
  viewPad.attribute('title', 'View pad: X = field of view, Y = lens correction');
  viewPad.elt.tabIndex = 0;

  viewPadKnob = createDiv('');
  viewPadKnob.addClass('hud-pad-knob');
  viewPadKnob.parent(viewPad);

  viewPad.elt.addEventListener('pointerdown', (event) => {
    viewPadActive = true;
    viewPad.addClass('active');
    viewPad.elt.setPointerCapture?.(event.pointerId);
    updateViewPadFromPointer(event.clientX, event.clientY);
  });

  viewPad.elt.addEventListener('pointermove', (event) => {
    if (viewPadActive) {
      updateViewPadFromPointer(event.clientX, event.clientY);
    }
  });

  viewPad.elt.addEventListener('pointerup', () => {
    viewPadActive = false;
    viewPad.removeClass('active');
  });

  viewPad.elt.addEventListener('pointercancel', () => {
    viewPadActive = false;
    viewPad.removeClass('active');
  });

  syncViewPadFromSliders();
}

function createFpsCapSlider() {
  sliderFpsCap = createSlider(FPS_CAP_MIN, FPS_CAP_MAX, DEFAULT_FPS_CAP, 1);
  sliderFpsCap.addClass('hud-slider');
  sliderFpsCap.style('width', '104px');
  sliderFpsCap.attribute('title', 'Max FPS');
  sliderFpsCap.hide();
  sliderFpsCap.input(() => {
    frameRate(Number(sliderFpsCap.value()));
    showHudFeedback('Max FPS', `${Math.round(Number(sliderFpsCap.value()))}`);
  });
  frameRate(DEFAULT_FPS_CAP);
}

function setHudVisible(visible) {
  hudVisible = visible;

  const domControls = [sliderFOV, sliderWall, sliderFish, sliderDensity, sliderCatnip, sliderWallScale, sliderWallRoundness, sliderTopPerspective, sliderSplitView, sliderFpsCap, chaosPad, viewPad];
  for (const control of domControls) {
    if (!control) {
      continue;
    }

    if (visible) {
      if (control === sliderFpsCap) {
        control.hide();
      } else {
        control.show();
      }
    } else {
      control.hide();
    }
  }

  setWallColorControlsVisible(wallColorControlsVisible);
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

  const track = PURR_TRACKS[activePurrTrackIndex];
  if (purrAudio.dataset.trackIndex !== String(activePurrTrackIndex)) {
    purrAudio.pause();
    purrAudio.src = track.src;
    purrAudio.dataset.trackIndex = String(activePurrTrackIndex);
    purrAudio.load();
  }

  if (shouldPlay) {
    ambientAudioStarted = true;
    const playPromise = purrAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }
}

function handleSplitViewChange(showFeedback = false, preserveDefaultState = false) {
  const previousWorldW = worldW;
  const previousWorldH = worldH;
  const savedDefaultState = preserveDefaultState ? defaultState : null;
  updateViewportSize();
  worldW = viewW * WORLD_SCALE;
  worldH = mapViewH * WORLD_SCALE;
  resizeCanvas(viewW, viewH);
  rescaleWorldState(previousWorldW, previousWorldH);
  if (preserveDefaultState) {
    defaultState = savedDefaultState;
  }
  layoutControls();
  rebuildFloorDots();
  syncViewPadFromSliders();
  setHudVisible(hudVisible);
  if (showFeedback) {
    showHudFeedback('Split height', `${Math.round(Number(sliderSplitView.value()))}% top`);
  }
}

function getExteriorCatButtons(camera) {
  return [
    { trackIndex: 0, icon: PURR_TRACKS[0].icon, worldX: worldW / 2, worldY: 32 },
    { trackIndex: 1, icon: PURR_TRACKS[1].icon, worldX: worldW - 32, worldY: worldH / 2 },
    { trackIndex: 2, icon: PURR_TRACKS[2].icon, worldX: 32, worldY: worldH / 2 },
    { trackIndex: activePurrTrackIndex, icon: PURR_TRACKS[activePurrTrackIndex].icon, worldX: worldW / 2, worldY: worldH - 32 },
  ].map((button) => ({
    ...button,
    screenX: button.worldX - camera.x,
    screenY: button.worldY - camera.y,
  }));
}

function clickExteriorCatTrack(pointerX, pointerY) {
  for (const button of exteriorCatButtons) {
    if (dist(pointerX, pointerY, button.screenX, button.screenY) <= 18) {
      setPurrTrack(button.trackIndex, true);
      return true;
    }
  }

  return false;
}

function focusChaosPad() {
  if (chaosPad) {
    chaosPad.elt.focus();
  }
}

function syncViewPadFromSliders() {
  if (!viewPadKnob || !sliderFOV || !sliderFish) {
    return;
  }

  const fovPercent = map(Number(sliderFOV.value()), Number(sliderFOV.elt.min), Number(sliderFOV.elt.max), 0, 100);
  const fishPercent = map(Number(sliderFish.value()), Number(sliderFish.elt.min), Number(sliderFish.elt.max), 0, 100);
  const knobX = map(fovPercent, 0, 100, 10, CHAOS_PAD_SIZE - 10);
  const knobY = map(fishPercent, 100, 0, 10, CHAOS_PAD_SIZE - 10);
  viewPadKnob.style('left', `${knobX}px`);
  viewPadKnob.style('top', `${knobY}px`);
}

function setChaosPadValues(distanceValue, contrastValue, showFeedback = false) {
  distanceSpreadValue = clamp(distanceValue, 0, 100);
  depthContrastValue = clamp(contrastValue, 0, 100);

  if (!chaosPadKnob) {
    if (showFeedback) {
      showHudFeedback('Depth pad', `Spread ${Math.round(distanceSpreadValue)}% · Contrast ${Math.round(depthContrastValue)}%`);
    }
    return;
  }

  const knobX = map(distanceSpreadValue, 0, 100, 10, CHAOS_PAD_SIZE - 10);
  const knobY = map(depthContrastValue, 100, 0, 10, CHAOS_PAD_SIZE - 10);
  chaosPadKnob.style('left', `${knobX}px`);
  chaosPadKnob.style('top', `${knobY}px`);

  if (showFeedback) {
    showHudFeedback('Depth pad', `Spread ${Math.round(distanceSpreadValue)}% · Contrast ${Math.round(depthContrastValue)}%`);
  }
}

function updateChaosPadFromPointer(clientX, clientY) {
  if (!chaosPad) {
    return;
  }

  const rect = chaosPad.elt.getBoundingClientRect();
  const localX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const localY = clamp((clientY - rect.top) / rect.height, 0, 1);

  setChaosPadValues(localX * 100, (1 - localY) * 100, true);
}

function updateViewPadFromPointer(clientX, clientY) {
  if (!viewPad) {
    return;
  }

  const rect = viewPad.elt.getBoundingClientRect();
  const localX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const localY = clamp((clientY - rect.top) / rect.height, 0, 1);
  const nextFov = Math.round(map(localX, 0, 1, Number(sliderFOV.elt.min), Number(sliderFOV.elt.max)));
  const nextFish = Math.round(map(1 - localY, 0, 1, Number(sliderFish.elt.min), Number(sliderFish.elt.max)));

  sliderFOV.value(nextFov);
  particle.updateFOV(nextFov);
  sliderFish.value(nextFish);
  syncViewPadFromSliders();
  showHudFeedback('View pad', `FOV ${nextFov}° · Lens ${nextFish}%`);
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
      return createInteriorWall(x1, y1, x2, y2, random(10, 18));
    }
  }

  return createInteriorWall(worldW * 0.35, worldH * 0.5, worldW * 0.65, worldH * 0.5, random(10, 18));
}

function createRandomCatnip() {
  return {
    x: random(40, worldW - 40),
    y: random(40, worldH - 40),
  };
}

function updateCatnipsFromSlider(showFeedback = false) {
  const nextTargetCount = Number(sliderCatnip.value());

  if (nextTargetCount > catnipTargetCount) {
    for (let index = 0; index < (nextTargetCount - catnipTargetCount); index++) {
      catnips.push(createRandomCatnip());
    }
  } else if (nextTargetCount < catnipTargetCount) {
    catnips.length = Math.max(0, catnips.length - (catnipTargetCount - nextTargetCount));
  }

  catnipTargetCount = nextTargetCount;

  if (showFeedback) {
    showHudFeedback('Catnip count', `${catnipTargetCount}`);
  }
}

function checkCatnipPickup() {
  for (let index = catnips.length - 1; index >= 0; index--) {
    const catnip = catnips[index];
    if (dist(particle.pos.x, particle.pos.y, catnip.x, catnip.y) <= CATNIP_PICKUP_RADIUS) {
      catnips.splice(index, 1);
      catnipBoostUntilMs = millis() + CATNIP_BOOST_DURATION_MS;
    }
  }
}

function drawCatnips() {
  if (catnips.length === 0) {
    return;
  }

  textAlign(CENTER, CENTER);
  textSize(16);
  noStroke();
  fill(120, 220, 130);

  for (const catnip of catnips) {
    text(CATNIP_ICON, catnip.x, catnip.y);
  }
}

function addWalls() {
  for (let index = BORDER_WALL_COUNT; index < wallCount; index++) {
    walls[index] = createRandomWall();
  }

  applyInteriorWallScale();
}

function updateWalls(showFeedback = false) {
  const nextWallCount = sliderWall.value();

  while (walls.length < nextWallCount) {
    walls.push(createRandomWall());
  }

  while (walls.length > nextWallCount) {
    walls.pop();
  }

  wallCount = nextWallCount;
  applyInteriorWallScale();

  if (showFeedback) {
    showHudFeedback('Wall count', `${wallCount}`);
  }
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
  const binding = shortcutBindings[index];
  if (binding) {
    binding.focus();
  }
}

function cloneWall(wall) {
  return new Boundary(wall.x1, wall.y1, wall.x2, wall.y2, wall.width, {
    isExterior: wall.isExterior,
    baseX1: wall.baseX1,
    baseY1: wall.baseY1,
    baseX2: wall.baseX2,
    baseY2: wall.baseY2,
    baseWidth: wall.baseWidth,
  });
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

  sliderFish.value(defaultState.fish);
  syncViewPadFromSliders();

  sliderDensity.value(defaultState.density);
  particle.updateDensity(defaultState.density);

  if (sliderWallScale && Number.isFinite(defaultState.wallScalePercent)) {
    sliderWallScale.value(defaultState.wallScalePercent);
  }

  if (sliderWallRoundness && Number.isFinite(defaultState.wallRoundness)) {
    sliderWallRoundness.value(defaultState.wallRoundness);
  }

  if (sliderTopPerspective && Number.isFinite(defaultState.topPerspective)) {
    sliderTopPerspective.value(defaultState.topPerspective);
  }

  if (sliderSplitView && Number.isFinite(defaultState.splitView)) {
    sliderSplitView.value(defaultState.splitView);
    handleSplitViewChange(false, true);
  }

  if (sliderFpsCap && Number.isFinite(defaultState.fpsCap)) {
    sliderFpsCap.value(defaultState.fpsCap);
    frameRate(defaultState.fpsCap);
  }

  if (sliderNearWallR && Number.isFinite(defaultState.nearWallR)) {
    sliderNearWallR.value(defaultState.nearWallR);
  }

  if (sliderNearWallG && Number.isFinite(defaultState.nearWallG)) {
    sliderNearWallG.value(defaultState.nearWallG);
  }

  if (sliderNearWallB && Number.isFinite(defaultState.nearWallB)) {
    sliderNearWallB.value(defaultState.nearWallB);
  }

  if (sliderFarWallR && Number.isFinite(defaultState.farWallR)) {
    sliderFarWallR.value(defaultState.farWallR);
  }

  if (sliderFarWallG && Number.isFinite(defaultState.farWallG)) {
    sliderFarWallG.value(defaultState.farWallG);
  }

  if (sliderFarWallB && Number.isFinite(defaultState.farWallB)) {
    sliderFarWallB.value(defaultState.farWallB);
  }

  if (Number.isFinite(defaultState.purrTrackIndex)) {
    setPurrTrack(defaultState.purrTrackIndex, ambientAudioStarted);
  }

  sliderCatnip.value(defaultState.catnipTargetCount);
  catnipTargetCount = defaultState.catnipTargetCount;
  catnips = defaultState.catnips.map((catnip) => ({ x: catnip.x, y: catnip.y }));
  catnipBoostUntilMs = millis() + defaultState.catnipBoostRemainingMs;

  setChaosPadValues(defaultState.distance, defaultState.depthContrast);

  particle.pos.x = defaultState.playerX;
  particle.pos.y = defaultState.playerY;
  particle.heading = defaultState.playerHeading;
  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;

  sliderWall.value(defaultState.wallCount);
  wallCount = defaultState.wallCount;
  walls = defaultState.walls.map(cloneWall);
  applyInteriorWallScale();

  for (const binding of shortcutBindings) {
    binding.lastTick = 0;
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
    wallScalePercent: sliderWallScale ? Number(sliderWallScale.value()) : DEFAULT_WALL_SCALE,
    wallRoundness: sliderWallRoundness ? Number(sliderWallRoundness.value()) : DEFAULT_WALL_ROUNDNESS,
    topPerspective: sliderTopPerspective ? Number(sliderTopPerspective.value()) : DEFAULT_TOP_PERSPECTIVE,
    splitView: sliderSplitView ? Number(sliderSplitView.value()) : DEFAULT_SPLIT_VIEW,
    nearWallR: sliderNearWallR ? Number(sliderNearWallR.value()) : DEFAULT_NEAR_WALL_COLOR.r,
    nearWallG: sliderNearWallG ? Number(sliderNearWallG.value()) : DEFAULT_NEAR_WALL_COLOR.g,
    nearWallB: sliderNearWallB ? Number(sliderNearWallB.value()) : DEFAULT_NEAR_WALL_COLOR.b,
    farWallR: sliderFarWallR ? Number(sliderFarWallR.value()) : DEFAULT_FAR_WALL_COLOR.r,
    farWallG: sliderFarWallG ? Number(sliderFarWallG.value()) : DEFAULT_FAR_WALL_COLOR.g,
    farWallB: sliderFarWallB ? Number(sliderFarWallB.value()) : DEFAULT_FAR_WALL_COLOR.b,
    fpsCap: sliderFpsCap ? Number(sliderFpsCap.value()) : DEFAULT_FPS_CAP,
    purrTrackIndex: activePurrTrackIndex,
    catnipTargetCount,
    catnipBoostRemainingMs: Math.max(0, catnipBoostUntilMs - millis()),
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
      isExterior: wall.isExterior,
      baseX1: wall.baseX1,
      baseY1: wall.baseY1,
      baseX2: wall.baseX2,
      baseY2: wall.baseY2,
      baseWidth: wall.baseWidth,
    })),
    catnips: catnips.map((catnip) => ({
      x: catnip.x,
      y: catnip.y,
    })),
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  if (sliderSplitView && Number.isFinite(settings.splitView)) {
    sliderSplitView.value(clamp(settings.splitView, SPLIT_VIEW_MIN, SPLIT_VIEW_MAX));
    handleSplitViewChange(false, true);
  }

  let effectiveSettings = settings;
  if (Number.isFinite(settings.worldWidth) && Number.isFinite(settings.worldHeight) && (settings.worldWidth !== worldW || settings.worldHeight !== worldH)) {
    effectiveSettings = scaleSettingsToWorld(settings, settings.worldWidth, settings.worldHeight, worldW, worldH);
  }

  if (Number.isFinite(effectiveSettings.fov)) {
    sliderFOV.value(clamp(effectiveSettings.fov, Number(sliderFOV.elt.min), Number(sliderFOV.elt.max)));
    particle.updateFOV(Number(sliderFOV.value()));
    syncViewPadFromSliders();
  }

  if (Number.isFinite(effectiveSettings.fish)) {
    sliderFish.value(clamp(effectiveSettings.fish, Number(sliderFish.elt.min), Number(sliderFish.elt.max)));
    syncViewPadFromSliders();
  }

  if (Number.isFinite(effectiveSettings.density)) {
    sliderDensity.value(clamp(effectiveSettings.density, Number(sliderDensity.elt.min), Number(sliderDensity.elt.max)));
    particle.updateDensity(Number(sliderDensity.value()));
  }

  if (sliderWallScale && Number.isFinite(effectiveSettings.wallScalePercent)) {
    sliderWallScale.value(clamp(effectiveSettings.wallScalePercent, WALL_SCALE_MIN, WALL_SCALE_MAX));
  }

  if (sliderWallRoundness && Number.isFinite(effectiveSettings.wallRoundness)) {
    sliderWallRoundness.value(clamp(effectiveSettings.wallRoundness, Number(sliderWallRoundness.elt.min), Number(sliderWallRoundness.elt.max)));
  }

  if (sliderTopPerspective && Number.isFinite(effectiveSettings.topPerspective)) {
    sliderTopPerspective.value(clamp(effectiveSettings.topPerspective, TOP_PERSPECTIVE_MIN, TOP_PERSPECTIVE_MAX));
  }

  if (sliderNearWallR && Number.isFinite(effectiveSettings.nearWallR)) {
    sliderNearWallR.value(clamp(effectiveSettings.nearWallR, 0, 255));
  }

  if (sliderNearWallG && Number.isFinite(effectiveSettings.nearWallG)) {
    sliderNearWallG.value(clamp(effectiveSettings.nearWallG, 0, 255));
  }

  if (sliderNearWallB && Number.isFinite(effectiveSettings.nearWallB)) {
    sliderNearWallB.value(clamp(effectiveSettings.nearWallB, 0, 255));
  }

  if (sliderFarWallR && Number.isFinite(effectiveSettings.farWallR)) {
    sliderFarWallR.value(clamp(effectiveSettings.farWallR, 0, 255));
  }

  if (sliderFarWallG && Number.isFinite(effectiveSettings.farWallG)) {
    sliderFarWallG.value(clamp(effectiveSettings.farWallG, 0, 255));
  }

  if (sliderFarWallB && Number.isFinite(effectiveSettings.farWallB)) {
    sliderFarWallB.value(clamp(effectiveSettings.farWallB, 0, 255));
  }

  if (sliderFpsCap && Number.isFinite(effectiveSettings.fpsCap)) {
    sliderFpsCap.value(clamp(effectiveSettings.fpsCap, FPS_CAP_MIN, FPS_CAP_MAX));
    frameRate(Number(sliderFpsCap.value()));
  }

  if (Number.isFinite(effectiveSettings.purrTrackIndex)) {
    setPurrTrack(effectiveSettings.purrTrackIndex, ambientAudioStarted);
  }

  const restoredCatnips = Array.isArray(effectiveSettings.catnips)
    ? effectiveSettings.catnips.filter((catnip) => catnip && Number.isFinite(catnip.x) && Number.isFinite(catnip.y))
    : [];

  if (Number.isFinite(effectiveSettings.catnipTargetCount)) {
    sliderCatnip.value(clamp(effectiveSettings.catnipTargetCount, Number(sliderCatnip.elt.min), Number(sliderCatnip.elt.max)));
    catnipTargetCount = Number(sliderCatnip.value());
    catnips = restoredCatnips.map((catnip) => ({ x: catnip.x, y: catnip.y }));
  } else {
    sliderCatnip.value(0);
    catnipTargetCount = 0;
    catnips = [];
  }

  catnipBoostUntilMs = millis() + Math.max(0, Number(effectiveSettings.catnipBoostRemainingMs) || 0);

  if (Number.isFinite(effectiveSettings.distance) || Number.isFinite(effectiveSettings.depthContrast)) {
    setChaosPadValues(
      Number.isFinite(effectiveSettings.distance) ? effectiveSettings.distance : distanceSpreadValue,
      Number.isFinite(effectiveSettings.depthContrast) ? effectiveSettings.depthContrast : depthContrastValue
    );
  }

  const restoredWalls = Array.isArray(effectiveSettings.walls)
    ? effectiveSettings.walls
      .filter((wall) => wall && [wall.x1, wall.y1, wall.x2, wall.y2].every(Number.isFinite))
      .map((wall, index) => {
        if (index < BORDER_WALL_COUNT || wall.isExterior) {
          return buildBorderWalls()[index] ?? buildBorderWalls()[index % BORDER_WALL_COUNT];
        }

        return createInteriorWall(
          Number.isFinite(wall.baseX1) ? wall.baseX1 : wall.x1,
          Number.isFinite(wall.baseY1) ? wall.baseY1 : wall.y1,
          Number.isFinite(wall.baseX2) ? wall.baseX2 : wall.x2,
          Number.isFinite(wall.baseY2) ? wall.baseY2 : wall.y2,
          Number.isFinite(wall.baseWidth) ? wall.baseWidth : (Number.isFinite(wall.width) ? wall.width : 20)
        );
      })
    : [];

  if (restoredWalls.length >= BORDER_WALL_COUNT) {
    walls = restoredWalls;
    wallCount = restoredWalls.length;
    sliderWall.value(clamp(wallCount, Number(sliderWall.elt.min), Number(sliderWall.elt.max)));
    applyInteriorWallScale();
  } else if (Number.isFinite(effectiveSettings.wallCount)) {
    sliderWall.value(clamp(effectiveSettings.wallCount, Number(sliderWall.elt.min), Number(sliderWall.elt.max)));
    updateWalls();
  }

  if (Number.isFinite(effectiveSettings.playerX)) {
    particle.pos.x = effectiveSettings.playerX;
  }

  if (Number.isFinite(effectiveSettings.playerY)) {
    particle.pos.y = effectiveSettings.playerY;
  }

  if (Number.isFinite(effectiveSettings.playerHeading)) {
    particle.heading = effectiveSettings.playerHeading;
  }

  lastPlayerX = particle.pos.x;
  lastPlayerY = particle.pos.y;

  return true;
}

function saveCurrentSettingsToStorage() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getCurrentSettings()));
    return true;
  } catch (error) {
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

function processSliderShortcuts() {
  const shortcutCodes = [49, 50, 51, 52, 53, 54, 55, 56, 57, 48];
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

function handleInput() {
  const speedBoost = millis() < catnipBoostUntilMs ? CATNIP_BOOST_MULTIPLIER : 1;
  const moveSpeed = MOVE_SPEED * speedBoost * (keyIsDown(16) ? SPRINT_MULTIPLIER : 1);

  if (keyIsDown(65)) {
    particle.rotate(-ROTATION_SPEED);
  }

  if (keyIsDown(68)) {
    particle.rotate(ROTATION_SPEED);
  }

  if (keyIsDown(87)) {
    particle.move(moveSpeed);
  }

  if (keyIsDown(83)) {
    particle.move(-moveSpeed);
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
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(1, WORLD_GRADIENT_END);
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

function drawExteriorWallScale(camera) {
  const labelValues = [1, 25, 50, 75, 100];
  const tickInsetMinor = 6;
  const tickInsetMajor = 12;
  const labelInset = 18;
  exteriorCatButtons = getExteriorCatButtons(camera);

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
  for (const button of exteriorCatButtons) {
    fill(button.trackIndex === activePurrTrackIndex ? color(255, 230, 160) : color(220, 228, 245, 150));
    text(button.icon, button.worldX, button.worldY);
  }
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

  drawCatnips();

  stroke(255, 100);
  strokeWeight(1);
  for (let index = 0; index < hitVisible.length; index++) {
    if (hitVisible[index]) {
      line(particle.pos.x, particle.pos.y, hitX[index], hitY[index]);
    }
  }

  particle.show();
  drawExteriorWallScale(camera);
  pop();

  noFill();
  stroke(255, 35);
  rect(0, 0, viewW - 1, mapViewH - 1);
}

function getTopHudCatButtons() {
  const spacing = 34;
  const centerX = viewW / 2;
  const y = 18;

  return PURR_TRACKS.map((track, index) => ({
    trackIndex: index,
    icon: track.icon,
    screenX: centerX + ((index - 1) * spacing),
    screenY: y,
  }));
}

function drawTopGrid() {
  stroke(42, 46, 56, 110);
  strokeWeight(1);

  for (let x = 0; x <= worldW; x += TOP_VIEW_GRID_STEP) {
    line(x, 0, x, worldH);
  }

  for (let y = 0; y <= worldH; y += TOP_VIEW_GRID_STEP) {
    line(0, y, worldW, y);
  }
}

function getTopWallCap(wall, depthStrength) {
  const baseCorners = wall.getCorners();
  const centerX = (wall.x1 + wall.x2) / 2;
  const centerY = (wall.y1 + wall.y2) / 2;
  const dirX = centerX - particle.pos.x;
  const dirY = centerY - particle.pos.y;
  const distance = Math.hypot(dirX, dirY) || 1;
  const distanceRatio = clamp(distance / Math.hypot(worldW, worldH), 0, 1);
  const offsetMagnitude = lerp(TOP_EXTRUSION_MIN, TOP_EXTRUSION_MAX, depthStrength) * lerp(1.2, 0.55, distanceRatio);
  const offsetX = (dirX / distance) * offsetMagnitude;
  const offsetY = (dirY / distance) * offsetMagnitude;
  const scaleAmount = 1 + (TOP_CAP_SCALE_MAX * depthStrength * lerp(1.15, 0.7, distanceRatio));

  return baseCorners.map((corner) => ({
    x: centerX + offsetX + ((corner.x - centerX) * scaleAmount),
    y: centerY + offsetY + ((corner.y - centerY) * scaleAmount),
  }));
}

function getTopFaceDepth(points) {
  let sumX = 0;
  let sumY = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }

  const centerX = sumX / points.length;
  const centerY = sumY / points.length;
  return dist(centerX, centerY, particle.pos.x, particle.pos.y);
}

function getTopLongFaceStartIndex(baseCorners) {
  const longEdgeStartIndices = [0, 2];
  let chosenStartIndex = longEdgeStartIndices[0];
  let nearestDistance = Infinity;

  for (const startIndex of longEdgeStartIndices) {
    const nextIndex = (startIndex + 1) % baseCorners.length;
    const midpointX = (baseCorners[startIndex].x + baseCorners[nextIndex].x) / 2;
    const midpointY = (baseCorners[startIndex].y + baseCorners[nextIndex].y) / 2;
    const edgeDistance = dist(midpointX, midpointY, particle.pos.x, particle.pos.y);

    if (edgeDistance < nearestDistance) {
      nearestDistance = edgeDistance;
      chosenStartIndex = startIndex;
    }
  }

  return chosenStartIndex;
}

function buildTopExtrudedWallFaces(wall, depthStrength) {
  const baseCorners = wall.getCorners();
  const capCorners = getTopWallCap(wall, depthStrength);
  const wallColorConfig = getWallColorConfig();
  const sideFill = color(
    wallColorConfig.near.r,
    wallColorConfig.near.g,
    wallColorConfig.near.b,
    255
  );
  const topFill = wall.isExterior ? color(88, 120, 94, 255) : color(88, 120, 94, 255);
  const longFaceStartIndex = getTopLongFaceStartIndex(baseCorners);
  const longFaceNextIndex = (longFaceStartIndex + 1) % baseCorners.length;
  const faces = [];
  const mainFacePoints = [
    baseCorners[longFaceStartIndex],
    baseCorners[longFaceNextIndex],
    capCorners[longFaceNextIndex],
    capCorners[longFaceStartIndex],
  ];

  faces.push({
    points: mainFacePoints,
    fillColor: sideFill,
    strokeColor: null,
    strokeWidth: 0,
    depth: getTopFaceDepth(mainFacePoints),
    kind: 'side',
  });

  const shortFaceStartIndices = [
    (longFaceStartIndex + 1) % baseCorners.length,
    (longFaceStartIndex + 3) % baseCorners.length,
  ];

  for (const startIndex of shortFaceStartIndices) {
    const nextIndex = (startIndex + 1) % baseCorners.length;
    const shortFacePoints = [
      baseCorners[startIndex],
      baseCorners[nextIndex],
      capCorners[nextIndex],
      capCorners[startIndex],
    ];

    faces.push({
      points: shortFacePoints,
      fillColor: sideFill,
      strokeColor: null,
      strokeWidth: 0,
      depth: getTopFaceDepth(shortFacePoints),
      kind: 'side',
    });
  }

  faces.push({
    points: capCorners,
    fillColor: topFill,
    strokeColor: null,
    strokeWidth: 0,
    depth: getTopFaceDepth(capCorners) - 0.01,
    kind: 'cap',
  });

  return faces;
}

function drawTopFace(face) {
  if (face.strokeColor) {
    stroke(face.strokeColor);
    strokeWeight(face.strokeWidth);
  } else {
    noStroke();
  }

  fill(face.fillColor);
  quad(
    face.points[0].x, face.points[0].y,
    face.points[1].x, face.points[1].y,
    face.points[2].x, face.points[2].y,
    face.points[3].x, face.points[3].y
  );
}

function drawTopCatnips() {
  if (catnips.length === 0) {
    return;
  }

  noStroke();
  for (const catnip of catnips) {
    fill(120, 240, 150, 120);
    circle(catnip.x, catnip.y, 24);
    fill(144, 255, 168, 225);
    circle(catnip.x, catnip.y, 10);
  }
}

function drawTopPlayer() {
  noStroke();
  fill(255);
  circle(particle.pos.x, particle.pos.y, 18);
}

function drawTopRays(hitX, hitY, hitVisible) {
  if (!hitX || !hitY || !hitVisible) {
    return;
  }

  stroke(255, 255, 255, 70);
  strokeWeight(1);
  for (let index = 0; index < hitVisible.length; index++) {
    if (hitVisible[index]) {
      line(particle.pos.x, particle.pos.y, hitX[index], hitY[index]);
    }
  }
}

function drawTopViewPurrButtons() {
  exteriorCatButtons = getTopHudCatButtons();

  push();
  textAlign(CENTER, CENTER);
  textSize(16);
  for (const button of exteriorCatButtons) {
    fill(button.trackIndex === activePurrTrackIndex ? color(255, 230, 160) : color(220, 228, 245, 160));
    noStroke();
    text(button.icon, button.screenX, button.screenY);
  }
  pop();
}

function drawTopPerspectiveView(hitX, hitY, hitVisible) {
  const camera = getCameraOffset();
  const depthStrength = sliderTopPerspective ? Number(sliderTopPerspective.value()) / 100 : (DEFAULT_TOP_PERSPECTIVE / 100);

  rectMode(CORNER);
  fill(8);
  noStroke();
  rect(0, 0, viewW, mapViewH);

  push();
  translate(-camera.x, -camera.y);
  drawWorldGradient();
  drawTopGrid();

  const topSideFaces = [];
  const topCapFaces = [];
  for (const wall of walls) {
    for (const face of buildTopExtrudedWallFaces(wall, depthStrength)) {
      if (face.kind === 'cap') {
        topCapFaces.push(face);
      } else {
        topSideFaces.push(face);
      }
    }
  }

  topSideFaces.sort((faceA, faceB) => faceB.depth - faceA.depth);
  for (const face of topSideFaces) {
    drawTopFace(face);
  }

  topCapFaces.sort((faceA, faceB) => faceB.depth - faceA.depth);
  for (const face of topCapFaces) {
    drawTopFace(face);
  }

  drawTopCatnips();
  drawTopRays(hitX, hitY, hitVisible);
  drawTopPlayer();
  drawExteriorWallScale(camera);
  pop();

  noFill();
  stroke(255, 30);
  rect(0, 0, viewW - 1, mapViewH - 1);
  drawTopViewPurrButtons();
}

function drawMiniMap() {
  const preferredWidth = clamp(viewW * 0.18, MINIMAP_MIN_WIDTH, MINIMAP_MAX_WIDTH);
  let miniScale = preferredWidth / worldW;
  if ((worldH * miniScale) > MINIMAP_MAX_HEIGHT) {
    miniScale = MINIMAP_MAX_HEIGHT / worldH;
  }

  const miniW = worldW * miniScale;
  const miniH = worldH * miniScale;
  const miniX = MINIMAP_MARGIN;
  const miniY = viewH - miniH - MINIMAP_MARGIN;
  const alpha = 255 * MINIMAP_OPACITY;

  push();
  rectMode(CORNER);
  noStroke();
  fill(8, alpha * 0.7);
  rect(miniX - 6, miniY - 6, miniW + 12, miniH + 12, 8);
  translate(miniX, miniY);
  scale(miniScale);

  noStroke();
  fill(10, alpha * 0.35);
  rect(0, 0, worldW, worldH);

  strokeWeight(2 / miniScale);
  stroke(210, 220, 235, alpha);
  noFill();
  for (const wall of walls) {
    const corners = wall.getCorners();
    quad(
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y
    );
  }

  noStroke();
  fill(120, 220, 130, alpha);
  for (const catnip of catnips) {
    circle(catnip.x, catnip.y, 14 / miniScale);
  }

  stroke(255, alpha);
  strokeWeight(3 / miniScale);
  line(
    particle.pos.x,
    particle.pos.y,
    particle.pos.x + (Math.cos(particle.heading) * 60),
    particle.pos.y + (Math.sin(particle.heading) * 60)
  );

  noStroke();
  fill(255, alpha);
  circle(particle.pos.x, particle.pos.y, 18 / miniScale);
  pop();
}

function drawSceneFloorGradient() {
  const gradient = drawingContext.createLinearGradient(0, renderViewH / 2, viewW, renderViewH);
  gradient.addColorStop(0, FLOOR_GRADIENT_START);
  gradient.addColorStop(1, FLOOR_GRADIENT_END);
  drawingContext.fillStyle = '#080808';
  drawingContext.fillRect(0, 0, viewW, renderViewH / 2);
  drawingContext.fillStyle = gradient;
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

function getClassicWallHeight(correctedDist) {
  const referenceDistance = Math.max(48, Math.min(worldW, worldH) * CLASSIC_WALL_REFERENCE_DISTANCE_RATIO);
  return clamp((referenceDistance / Math.max(1, correctedDist)) * renderViewH, 0, renderViewH);
}

function drawScene(scene) {
  const maxDepth = Math.hypot(worldW, worldH);
  const columnWidth = viewW / scene.length;
  const fishStrength = Math.pow(sliderFish.value() / 100, 0.85) * 0.92;
  const distanceStrength = distanceSpreadValue / 100;
  const depthContrastStrength = depthContrastValue / 100;
  const roundnessStrength = sliderWallRoundness ? Number(sliderWallRoundness.value()) / 100 : 0;
  const wallColorConfig = getWallColorConfig();

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(0, mapViewH, viewW, renderViewH);
  drawingContext.clip();
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
    const classicHeight = getClassicWallHeight(correctedDist);
    const stylizedHeight = map(shapedDist, 0, maxDepth, renderViewH * 1.28, 0, true);
    const h = Math.min(renderViewH, lerp(classicHeight, stylizedHeight, roundnessStrength));
    const t = shapedDepthRatio;
    const shadow = getProximityShadow(correctedDist);
    const r = Math.max(0, Math.min(255, lerp(wallColorConfig.near.r, wallColorConfig.far.r, t) - shadow));
    const g = Math.max(0, Math.min(255, lerp(wallColorConfig.near.g, wallColorConfig.far.g, t) - shadow));
    const b = Math.max(0, Math.min(255, lerp(wallColorConfig.near.b, wallColorConfig.far.b, t) - shadow));

    fill(r, g, b);
    rect((index * columnWidth) + (columnWidth / 2), renderViewH / 2, columnWidth + 1, h);
  }

  pop();
  drawingContext.restore();
}

function drawFpsOverlay() {
  const currentFps = frameRate();
  fpsSmoothed = lerp(fpsSmoothed, currentFps, 0.12);

  if (Number.isFinite(currentFps) && currentFps > 0) {
    fpsMin = Math.min(fpsMin, currentFps);
    fpsMax = Math.max(fpsMax, currentFps);
    fpsTotal += currentFps;
    fpsSamples += 1;
  }

  const avgFps = fpsSamples > 0 ? fpsTotal / fpsSamples : fpsSmoothed;
  const paddingX = 12;
  const paddingY = 8;
  const collapsedWidth = 88;
  const collapsedHeight = 28;
  const expandedWidth = 148;
  const expandedHeight = 142;
  const boxY = 16;
  const collapsedX = viewW - collapsedWidth - 16;
  const expandedX = viewW - expandedWidth - 16;

  const overCollapsed = mouseX >= collapsedX && mouseX <= (collapsedX + collapsedWidth) && mouseY >= boxY && mouseY <= (boxY + collapsedHeight);
  const overExpanded = mouseX >= expandedX && mouseX <= (expandedX + expandedWidth) && mouseY >= boxY && mouseY <= (boxY + expandedHeight);
  fpsPanelExpanded = fpsPanelExpanded ? overExpanded : overCollapsed;

  const boxWidth = fpsPanelExpanded ? expandedWidth : collapsedWidth;
  const boxHeight = fpsPanelExpanded ? expandedHeight : collapsedHeight;
  const boxX = fpsPanelExpanded ? expandedX : collapsedX;

  if (sliderFpsCap) {
    if (hudVisible && fpsPanelExpanded) {
      sliderFpsCap.show();
      sliderFpsCap.position(boxX + paddingX, boxY + 108);
    } else {
      sliderFpsCap.hide();
    }
  }

  push();
  rectMode(CORNER);
  noStroke();
  fill(0, 150);
  rect(boxX, boxY, boxWidth, boxHeight, 6);
  fill(235);

  if (fpsPanelExpanded) {
    textAlign(LEFT, TOP);
    textSize(12);
    text(`FPS ${fpsSmoothed.toFixed(1)}`, boxX + paddingX, boxY + paddingY);
    text(`SPD ${currentSpeedPxPerSecond.toFixed(0)} px/s`, boxX + paddingX, boxY + paddingY + 18);
    text(`AVG ${avgFps.toFixed(1)}`, boxX + paddingX, boxY + paddingY + 38);
    text(`MIN ${fpsMin.toFixed(1)}`, boxX + paddingX, boxY + paddingY + 56);
    text(`MAX ${fpsMax.toFixed(1)}`, boxX + paddingX, boxY + paddingY + 74);
    text(`CAP ${sliderFpsCap ? sliderFpsCap.value() : DEFAULT_FPS_CAP}`, boxX + paddingX, boxY + paddingY + 92);
  } else {
    textAlign(RIGHT, TOP);
    textSize(14);
    text(`${fpsSmoothed.toFixed(1)} FPS`, boxX + boxWidth - paddingX, boxY + paddingY);
  }

  pop();
}

function drawHudFeedback() {
  if (!hudVisible || millis() > hudFeedbackUntilMs || !hudFeedbackLabel) {
    return;
  }

  const boxWidth = 260;
  const boxHeight = 48;
  const boxX = Math.max(16, (viewW / 2) - (boxWidth / 2));
  const boxY = mapViewH + 18;

  push();
  rectMode(CORNER);
  noStroke();
  fill(0, 165);
  rect(boxX, boxY, boxWidth, boxHeight, 8);

  textAlign(CENTER, TOP);
  fill(235);
  textSize(12);
  text(hudFeedbackLabel, boxX + (boxWidth / 2), boxY + 8);
  textSize(16);
  text(hudFeedbackValue, boxX + (boxWidth / 2), boxY + 24);
  pop();
}

function draw() {
  background(0);
  handleInput();
  checkCatnipPickup();
  updateMovementSpeed();
  processSliderShortcuts();

  const { scene, hitX, hitY, hitVisible } = particle.look(walls);

  drawTopPerspectiveView(hitX, hitY, hitVisible);
  drawScene(scene);
  drawMiniMap();
  drawHudFeedback();
  if (hudVisible) {
    drawFpsOverlay();
  } else if (sliderFpsCap) {
    sliderFpsCap.hide();
  }
}

function keyPressed() {
  initAmbientAudio();

  if (key === 'h' || key === 'H') {
    setHudVisible(!hudVisible);
    return false;
  }

  if (key === 'c' || key === 'C') {
    setWallColorControlsVisible(!wallColorControlsVisible);
    showHudFeedback('Wall color controls', wallColorControlsVisible ? 'Shown' : 'Hidden');
    return false;
  }

  if ((key === 's' || key === 'S') && (keyIsDown(CONTROL) || keyIsDown(91) || keyIsDown(93))) {
    saveCurrentSettingsToStorage();
    return false;
  }

  if (key === 'r' || key === 'R') {
    resetToDefaults();
    return false;
  }

  if (key === '1') {
    focusSlider(0);
    return false;
  }

  if (key === '2') {
    focusSlider(1);
    return false;
  }

  if (key === '3') {
    focusSlider(2);
    return false;
  }

  if (key === '4') {
    focusSlider(3);
    return false;
  }

  if (key === '5') {
    focusSlider(4);
    return false;
  }

  if (key === '6') {
    focusSlider(5);
    return false;
  }

  if (key === '7') {
    focusSlider(6);
    return false;
  }

  if (key === '8') {
    focusSlider(7);
    return false;
  }

  if (key === '9') {
    focusSlider(8);
    return false;
  }

  if (key === '0') {
    focusSlider(9);
    return false;
  }
}

function mousePressed() {
  if (clickExteriorCatTrack(mouseX, mouseY)) {
    return false;
  }

  initAmbientAudio();
}

function touchStarted() {
  if (clickExteriorCatTrack(mouseX, mouseY)) {
    return false;
  }

  initAmbientAudio();
  return false;
}

function windowResized() {
  const previousWorldW = worldW;
  const previousWorldH = worldH;
  updateViewportSize();
  worldW = viewW * WORLD_SCALE;
  worldH = mapViewH * WORLD_SCALE;
  resizeCanvas(viewW, viewH);
  rescaleWorldState(previousWorldW, previousWorldH);
  layoutControls();
  rebuildFloorDots();
  syncViewPadFromSliders();
  setHudVisible(hudVisible);
}
