class Particle {
  constructor() {
    this.pos = createVector(width / 2, height / 4);
    this.rays = [];
    this.heading = 0;
    this.viewAngle = 46;
    this.rayMultiplier = 0.89;
    this.eyes = [];
    for (let a = -this.viewAngle / 2; a < this.viewAngle / 2; a += this.rayMultiplier) {
      this.rays.push(new Ray(this.pos, radians(a)));
    }
    this.eyes = [this.rays[0], this.rays[this.rays.length-1]];
  }

  updateFOV(fov) {
    this.viewAngle = fov;
    this.rays = [];
    for (let a = -this.viewAngle / 2; a < this.viewAngle / 2; a += this.rayMultiplier) {
      this.rays.push(new Ray(this.pos, radians(a) + this.heading));
    }
    this.eyes = [this.rays[0], this.rays[this.rays.length-1]];
  }

  rotate(angle) {
    this.heading += angle;
    let index = 0;
    for (let a = -this.viewAngle / 2; a < this.viewAngle / 2; a += this.rayMultiplier) {
      this.rays[index].setAngle(radians(a) + this.heading);
      index++;
    }
  }

  move(ammount) {
    const vel = p5.Vector.fromAngle(this.heading);
    vel.setMag(ammount);
    this.pos.add(vel); 
  }

  update(x, y) {
    this.pos.set(x, y);
  }

  look(walls) {
    const scene = [];
    let leftEyeDist = null;
    let rightEyeDist = null;
    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];

      let closest = null;
      let record = Infinity;

      for (let wall of walls) {
        const pt = ray.cast(wall);
        if (pt) {
          const d = p5.Vector.dist(this.pos, pt);
          if (d < record) {
            record = d;
            closest = pt;
            if (ray == this.eyes[0]) {
              leftEyeDist = d;
            } else if (ray == this.eyes[1]) {
              rightEyeDist = d;
            }
          }
        }
      }
      if (closest) {
        if (ray == this.eyes[0] || ray == this.eyes[1]) {
          stroke(55, 255, 225);
        } else {
          stroke(255, 75);
        }
        line(this.pos.x, this.pos.y, closest.x, closest.y);
      }
      scene[i] = record;
    }
    
    return {
      scene: scene,
      leftD: leftEyeDist,
      rightD: rightEyeDist
    }
  }

  show() {
    // fill(255);
    ellipse(this.pos.x, this.pos.y, 4);
    // for (let ray of this.rays) {
    //   ray.show();
    // }
  }
}