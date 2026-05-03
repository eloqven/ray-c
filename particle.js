class Particle {
  constructor() {
    this.pos = { x: 0, y: 0 };
    this.heading = 0;
    this.viewAngle = 60;
    this.rayDensity = 2;
    this.scene = new Float32Array(0);
    this.hitX = new Float32Array(0);
    this.hitY = new Float32Array(0);
    this.hitVisible = new Uint8Array(0);
    this.rayCos = new Float32Array(0);
    this.raySin = new Float32Array(0);
    this.rebuildRayData();
  }

  updateFOV(fov) {
    if (this.viewAngle === fov) {
      return;
    }

    this.viewAngle = fov;
    this.rebuildRayData();
  }

  updateDensity(density) {
    if (this.rayDensity === density) {
      return;
    }

    this.rayDensity = density;
    this.rebuildRayData();
  }

  rebuildRayData() {
    const rayCount = Math.max(1, Math.floor(this.viewAngle * this.rayDensity) + 1);
    const halfView = (this.viewAngle * Math.PI) / 360;
    const step = rayCount > 1 ? (halfView * 2) / (rayCount - 1) : 0;

    this.scene = new Float32Array(rayCount);
    this.hitX = new Float32Array(rayCount);
    this.hitY = new Float32Array(rayCount);
    this.hitVisible = new Uint8Array(rayCount);
    this.rayCos = new Float32Array(rayCount);
    this.raySin = new Float32Array(rayCount);

    for (let index = 0; index < rayCount; index++) {
      const offset = -halfView + (step * index);
      this.rayCos[index] = Math.cos(offset);
      this.raySin[index] = Math.sin(offset);
    }
  }

  rotate(angle) {
    this.heading += angle;
  }

  move(amount, worldWidth = Number.POSITIVE_INFINITY, worldHeight = Number.POSITIVE_INFINITY) {
    const nextX = this.pos.x + (Math.cos(this.heading) * amount);
    const nextY = this.pos.y + (Math.sin(this.heading) * amount);

    if (Number.isFinite(worldWidth) && Number.isFinite(worldHeight)) {
      const padding = 6;
      const maxX = worldWidth - padding;
      const maxY = worldHeight - padding;

      this.pos.x = Math.min(maxX, Math.max(padding, nextX));
      this.pos.y = Math.min(maxY, Math.max(padding, nextY));
      return;
    }

    this.pos.x = nextX;
    this.pos.y = nextY;
  }

  look(walls) {
    const posX = this.pos.x;
    const posY = this.pos.y;
    const cosHeading = Math.cos(this.heading);
    const sinHeading = Math.sin(this.heading);

    for (let rayIndex = 0; rayIndex < this.scene.length; rayIndex++) {
      const localCos = this.rayCos[rayIndex];
      const localSin = this.raySin[rayIndex];
      const dx = (cosHeading * localCos) - (sinHeading * localSin);
      const dy = (sinHeading * localCos) + (cosHeading * localSin);

      let closestDist = Infinity;

      for (let wallIndex = 0; wallIndex < walls.length; wallIndex++) {
        const dist = this.intersect(posX, posY, dx, dy, walls[wallIndex]);
        if (dist !== null && dist < closestDist) {
          closestDist = dist;
        }
      }

      this.scene[rayIndex] = closestDist;

      if (closestDist < Infinity) {
        this.hitVisible[rayIndex] = 1;
        this.hitX[rayIndex] = posX + (dx * closestDist);
        this.hitY[rayIndex] = posY + (dy * closestDist);
      } else {
        this.hitVisible[rayIndex] = 0;
      }
    }

    return {
      scene: this.scene,
      hitX: this.hitX,
      hitY: this.hitY,
      hitVisible: this.hitVisible,
      rayCos: this.rayCos,
    };
  }

  intersect(posX, posY, dx, dy, wall) {
    const segments = typeof wall.getSegments === 'function'
      ? wall.getSegments()
      : [[{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]];

    let closestDistance = null;

    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      const distance = this.intersectSegment(posX, posY, dx, dy, segment[0].x, segment[0].y, segment[1].x, segment[1].y);
      if (distance !== null && (closestDistance === null || distance < closestDistance)) {
        closestDistance = distance;
      }
    }

    return closestDistance;
  }

  intersectSegment(posX, posY, dx, dy, x1, y1, x2, y2) {
    const x4 = posX + dx;
    const y4 = posY + dy;

    const den = ((x1 - x2) * (posY - y4)) - ((y1 - y2) * (posX - x4));
    if (den === 0) {
      return null;
    }

    const t = (((x1 - posX) * (posY - y4)) - ((y1 - posY) * (posX - x4))) / den;
    const u = -(((x1 - x2) * (y1 - posY)) - ((y1 - y2) * (x1 - posX))) / den;

    if (t > 0 && t < 1 && u > 0) {
      return u;
    }

    return null;
  }

  show() {
    fill(255);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 6);
  }
}
