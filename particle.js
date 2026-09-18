class Particle {
  constructor() {
    this.pos = createVector(width / 2, height / 4);
    this.rays = [];
    this.heading = 0;
    this.viewAngle = 46;
    this.rayMultiplier = 0.89;
    this.eyes = [];
    this.hitTypes = [];
    this.initRays();
  }

  initRays() {
    this.rays = [];
    const halfFOV = this.viewAngle / 2;
    for (let a = -halfFOV; a < halfFOV; a += this.rayMultiplier) {
      const relAngle = radians(a);
      this.rays.push(new Ray(this.pos, relAngle + this.heading, relAngle));
    }
    if (this.rays.length > 0) {
      this.eyes = [this.rays[0], this.rays[this.rays.length - 1]];
    } else {
      this.eyes = [];
    }
  }

  updateFOV(fov) {
    this.viewAngle = fov;
    this.initRays();
  }

  updateDensity(multiplier) {
    this.rayMultiplier = Math.max(0.05, multiplier);
    this.initRays();
  }

  rotate(angle) {
    this.heading += angle;
    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];
      ray.setAngle(ray.relAngle + this.heading);
    }
  }

  move(amount) {
    const vel = p5.Vector.fromAngle(this.heading);
    vel.setMag(amount);
    this.pos.add(vel); 
  }

  update(x, y) {
    this.pos.set(x, y);
  }

  look(walls, drawLines = true, singularity = null, globalCurve = 0, fishEye = 0.0, escapeFactor = 0.0) {
    const scene = [];
    const hitTypes = [];
    let leftEyeDist = null;
    let rightEyeDist = null;

    const isCurved = (singularity && singularity.mass > 0) || (globalCurve !== 0);

    if (!isCurved) {
      // Fast path: pure straight line analytic raycasting
      for (let i = 0; i < this.rays.length; i++) {
        const ray = this.rays[i];
        let closest = null;
        let record = Infinity;

        for (let wall of walls) {
          const pt = ray.cast(wall);
          if (pt) {
            const d = dist(this.pos.x, this.pos.y, pt.x, pt.y);
            // Near-plane clipping: ignore self-intersection when player is crossing through wall
            if (d < 3.0) continue;
            if (d < record) {
              record = d;
              closest = pt;
            }
          }
        }

        if (closest && drawLines) {
          const closeC = (typeof colorCloseRgb !== 'undefined') ? colorCloseRgb : { r: 255, g: 115, b: 26 };
          const farC = (typeof colorFarRgb !== 'undefined') ? colorFarRgb : { r: 30, g: 8, b: 0 };
          const t = (this.rays.length > 1) ? (i / (this.rays.length - 1)) : 0;

          const r = lerp(closeC.r, farC.r, t);
          const g = lerp(closeC.g, farC.g, t);
          const b = lerp(closeC.b, farC.b, t);

          stroke(r, g, b, 100);
          strokeWeight(1);
          line(this.pos.x, this.pos.y, closest.x, closest.y);
        }

        // Fish Eye perspective modulation:
        const fishFactor = Math.cos(ray.relAngle) * (1.0 - fishEye) + 1.0 * fishEye;
        const finalD = Math.max(1, record * fishFactor);

        scene[i] = finalD;
        hitTypes[i] = 'wall';
        if (i === 0) leftEyeDist = record;
        if (i === this.rays.length - 1) rightEyeDist = record;
      }

      this.hitTypes = hitTypes;
      return {
        scene: scene,
        hitTypes: hitTypes,
        leftD: leftEyeDist,
        rightD: rightEyeDist
      };
    }

    // Curved ray marching path: Gravitational lensing & global uniform curvature
    const ds = 8;
    const maxDist = Math.max(typeof sceneW !== 'undefined' ? sceneW : width, typeof sceneH !== 'undefined' ? sceneH : height) * 1.5;
    const maxSteps = Math.min(220, Math.ceil(maxDist / ds));
    const radCurve = (globalCurve * Math.PI) / 180;
    const hasGravity = singularity && singularity.mass > 0;
    const sRadSq = hasGravity ? singularity.radius * singularity.radius : 0;

    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];
      let theta = this.heading + ray.relAngle;
      let px = this.pos.x;
      let py = this.pos.y;
      const path = [{ x: px, y: py }];
      let totalDist = 0;
      let hitType = 'none';

      for (let s = 0; s < maxSteps; s++) {
        // 1. Gravitational deflection towards singularity
        if (hasGravity) {
          const dx = singularity.x - px;
          const dy = singularity.y - py;
          const distSq = dx * dx + dy * dy;
          if (singularity.radius > 0 && distSq <= sRadSq) {
            totalDist += Math.sqrt(distSq);
            hitType = 'singularity';
            path.push({ x: singularity.x, y: singularity.y });
            break;
          }
          const distR = Math.sqrt(distSq);
          const cross = Math.cos(theta) * dy - Math.sin(theta) * dx;
          let dTheta = (singularity.mass * cross / (distSq * distR + 3000)) * (ds / 10);

          // Ray inclination / Escape boost: pushes ray heading radially outwards
          if (escapeFactor > 0) {
            const outwardX = -dx / distR;
            const outwardY = -dy / distR;
            const escapeCross = Math.cos(theta) * outwardY - Math.sin(theta) * outwardX;
            dTheta += escapeFactor * escapeCross * (ds / 25);
          }

          theta += dTheta;
        }

        // 2. Global uniform curvature
        if (globalCurve !== 0) {
          theta += radCurve * (ds / 600);
        }

        const nx = px + Math.cos(theta) * ds;
        const ny = py + Math.sin(theta) * ds;

        // Fast AABB rejection against wall bounding boxes
        const sMinX = px < nx ? px : nx;
        const sMaxX = px > nx ? px : nx;
        const sMinY = py < ny ? py : ny;
        const sMaxY = py > ny ? py : ny;

        let closestT = null;
        for (let wall of walls) {
          if (sMinX > wall.maxX || sMaxX < wall.minX || sMinY > wall.maxY || sMaxY < wall.minY) {
            continue;
          }
          const x1 = wall.a.x, y1 = wall.a.y;
          const x2 = wall.b.x, y2 = wall.b.y;
          const den = (x1 - x2) * (py - ny) - (y1 - y2) * (px - nx);
          if (den === 0) continue;
          const wt = ((x1 - px) * (py - ny) - (y1 - py) * (px - nx)) / den;
          const rt = -((x1 - x2) * (y1 - py) - (y1 - y2) * (x1 - px)) / den;
          if (wt >= 0 && wt <= 1 && rt >= 0 && rt <= 1) {
            // Near-plane clipping on step 0: ignore self-intersection when player is crossing through wall
            if (s === 0 && rt < 0.35) continue;
            if (closestT === null || rt < closestT) {
              closestT = rt;
            }
          }
        }

        if (closestT !== null) {
          const hx = px + closestT * (nx - px);
          const hy = py + closestT * (ny - py);
          path.push({ x: hx, y: hy });
          totalDist += closestT * ds;
          hitType = 'wall';
          break;
        }

        path.push({ x: nx, y: ny });
        totalDist += ds;
        px = nx;
        py = ny;

        const boundW = typeof sceneW !== 'undefined' ? sceneW : width;
        const boundH = typeof sceneH !== 'undefined' ? sceneH : height;
        if (px < -50 || px > boundW + 50 || py < -50 || py > boundH + 50) {
          break;
        }
      }

      if (drawLines && path.length >= 2) {
        const closeC = (typeof colorCloseRgb !== 'undefined') ? colorCloseRgb : { r: 255, g: 115, b: 26 };
        const farC = (typeof colorFarRgb !== 'undefined') ? colorFarRgb : { r: 30, g: 8, b: 0 };
        const t = (this.rays.length > 1) ? (i / (this.rays.length - 1)) : 0;

        const r = lerp(closeC.r, farC.r, t);
        const g = lerp(closeC.g, farC.g, t);
        const b = lerp(closeC.b, farC.b, t);

        stroke(r, g, b, 120);
        strokeWeight(1);
        noFill();
        beginShape();
        for (let pt of path) {
          vertex(pt.x, pt.y);
        }
        endShape();
      }

      // Fish Eye perspective modulation:
      const fishFactor = Math.cos(ray.relAngle) * (1.0 - fishEye) + 1.0 * fishEye;
      const finalD = Math.max(1, totalDist * fishFactor);

      scene[i] = finalD;
      hitTypes[i] = hitType;
      if (i === 0) leftEyeDist = totalDist;
      if (i === this.rays.length - 1) rightEyeDist = totalDist;
    }

    this.hitTypes = hitTypes;
    return {
      scene: scene,
      hitTypes: hitTypes,
      leftD: leftEyeDist,
      rightD: rightEyeDist
    };
  }

  show() {
    push();
    const closeC = (typeof colorCloseRgb !== 'undefined') ? colorCloseRgb : { r: 255, g: 115, b: 26 };
    fill(closeC.r, closeC.g, closeC.b);
    stroke(255, 180);
    strokeWeight(1.5);
    ellipse(this.pos.x, this.pos.y, 8);
    pop();
  }
}