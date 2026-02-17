// 2D Visibility
// Ray Casting

let walls = [];
let ray;
let particle;

let xoff = 0;
let yoff = 0;

const rotationOffset = 0.02;
const movingOffset = 2;
// let rotationCorrection = 0;

let FPS = 30;
let lastFPS = 0;
let averageFPS = 0;
let maxFPS = 0;
let minFPS = 99999999;
let wallCount = 6;

// let tooClose = false;

const sceneW = 1000;
let eyesDist = [1000, 1000];

let sceneH = 480;

let sliderFOV;
let sliderWall;

function setup() {
  // noCursor();
  // frameRate(FPS);
  sceneH = (windowHeight/2)-5;
  createCanvas(sceneW, sceneH*2);
  // createCanvas(windowWidth, windowHeight);

  walls.push(new Boundary(0, 0, sceneW, 0));
  walls.push(new Boundary(sceneW, 0, sceneW, sceneH));
  walls.push(new Boundary(sceneW, sceneH, 0, sceneH));
  walls.push(new Boundary(0, sceneH, 0, 0));
  particle = new Particle();
  addWalls();

  sliderFOV = createSlider(0, 721, particle.viewAngle);
  sliderFOV.position(10, 5);
  sliderFOV.style('width', '180px');
  sliderFOV.input(changeFOV);

  sliderWall = createSlider(4, 10, wallCount);
  sliderWall.position(10, 25);
  sliderWall.style('width', '180px');
  sliderWall.input(updateWalls);
}

function updateWalls() {
  const newWallCount = sliderWall.value();

  if (newWallCount > walls.length) {
    for (let i = walls.length; i < newWallCount; i++) {
      let x1 = random(sceneW);
      let x2 = random(sceneW);
      let y1 = random(sceneH);
      let y2 = random(sceneH);
      walls[i] = new Boundary(x1/1.2, y1, x2*1.4, y2);
    }
  } else if (newWallCount < walls.length) {
    while (walls.length != newWallCount) {
      walls.pop();
    }
  }
}

function changeFOV() {
  const fov = sliderFOV.value();
  particle.updateFOV(fov);
}

function addWalls() {
  for (let i = 4; i < wallCount; i++) {
    let x1 = random(sceneW);
    let x2 = random(sceneW);
    let y1 = random(sceneH);
    let y2 = random(sceneH);
    walls[i] = new Boundary(x1, y1, x2, y2);
  }
}

function keyPressed() {
  if (keyIsDown(65)) { // a
    particle.rotate(-rotationOffset);
  } else if (keyIsDown(68)) { // d
    particle.rotate(rotationOffset);
  }
  if (keyIsDown(87)) { // w
    particle.move(movingOffset);
  } else if (keyIsDown(83)) { // s
    particle.move(-movingOffset);
  }
}

function draw() {
  keyPressed();
  background(0);
  for (let wall of walls) {
    wall.show();
  }
  // particle.update(mouseX, mouseY);
  // if (eyesDist[0] < 4 || eyesDist[1] < 4) {
  //   if (eyesDist[0] < eyesDist[1]) {
  //     particle.rotate(noise(radians(rotationOffset)));
  //   } else {
  //     particle.rotate(-noise(radians(rotationOffset)));
  //   }
  //   // movingOffset -= 0.1;
  //   // particle.move(movingOffset/10);
  //   particle.rotate(noise(radians(rotationCorrection)));
  //   rotationCorrection += 0.001;
  //   // particle.rotate(noise(-xoff, xoff));
  // } else {
  //   // const rotation = noise(radians(rotationOffset))/180;
  //   // particle.rotate(rotation);
  //   // rotationOffset = rotationOffset < 0.2 ? rotationOffset : 0.2;
  //   // if (movingOffset < 2) movingOffset = 2;
  //   // movingOffset += (movingOffset / 100);
  //   // rotationOffset -= (rotationOffset / 100);
  //   // if (rotationOffset )
  //   rotationCorrection -= (rotationCorrection / 10);
  //   // console.log(rotation);
  //   // random(-1, 1) > 0 ? particle.rotate(radians(-noise(rotationOffset))) : particle.rotate(radians(noise(rotationOffset)));
  // }
  // let avgDist = (eyesDist[0] + eyesDist[1]) / 2;

  // const speed = map(eyesDist[0], sceneW, 0 , 0, rotationAngle/10);
  // let rotationAngle;
  // let speed;
  // particle.move(2);
  // if (eyesDist[0] < sceneW || eyesDist[1] < sceneW) {
  //   if (eyesDist[0] < eyesDist[1]) {
  //     rotationAngle = map(eyesDist[0]*eyesDist[0], sceneW*sceneW, 0, -2, 6);
  //     // particle.rotate(noise(radians(rotationOffset)));
  //     particle.rotate(noise((rotationAngle))/45);
  //     // particle.rotate(noise(radians(rotationAngle))/45);
  //   } else {
  //     rotationAngle = map(eyesDist[1]*eyesDist[1], sceneW*sceneW, 0, 2, -6);
  //     particle.rotate(-noise((rotationAngle))/45);
  //   }
  // }
  // if (abs(eyesDist[0] + eyesDist[1]) < 25) {
  //   particle.rotate(180);
  // }
  // console.log(rotationAngle);
  // if ((eyesDist[0] > 10 || eyesDist[1] > 10)) {
  // } else {
  //   particle.rotate(noise(radians(rotationAngle)));
  // }
  // particle.update(noise(xoff) * sceneW, noise(yoff) * sceneH);
  // particle.move(noise(movingOffset));
  // particle.rotate(noise(radians(rotationOffset))/360);
  // particle.updateFOV(noise(xoff) * 360);

  keyIsDown(65);

  particle.show();

  // xoff += 0.002;
  // yoff += 0.003;
  // rotationOffset += random(-0.0001, 0.0001);
  
  const {scene, leftD, rightD} = particle.look(walls);
  // tooClose = near ? true : false;
  eyesDist = [leftD ? leftD : sceneW, rightD ? rightD : sceneW];
  const w = sceneW / scene.length;

  push();
  translate(0, sceneH);
  for (let i = 0; i < scene.length; i++) {
    noStroke();
    const sq = scene[i] * scene[i];
    const wSq = sceneW/2 * sceneW*2;
    // const wSq = sceneW * sceneW;
    const b = map(sq, 0, wSq/3, 0, 255);
    // const b = map(sq, 0, wSq, 255, 0);
    const h = map(scene[i], sceneW, 0, 0, sceneH);
    // stroke(b);
    fill(255-b, 115-particle.viewAngle/4, h/6, h);
    // fill(b);
    rectMode(CENTER);
    rect(i * w + w / 2, sceneH / 2, w+1, h);
  }
  pop();

  // FPS += 0.01;

  // updateFPS(frameRate());
}

function updateFPS(currFPS) {
  lastFPS = averageFPS;
  averageFPS = ((lastFPS * 99) + currFPS) / 100;

  if (currFPS > maxFPS) {
    maxFPS = currFPS;
  }
  if (currFPS > 0 && currFPS < minFPS) {
    minFPS = currFPS;
  }

  logFPSinfo();
}

function logFPSinfo() {
  // console.clear();
  console.log(`maxFPS: ${maxFPS.toFixed(3)}`);
  console.log(`minFPS: ${minFPS.toFixed(3)}`);
  console.log(`averege FPS: ${averageFPS.toFixed(3)}`);
}
