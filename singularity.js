class Singularity {
  constructor(x, y, mass = 350, radius = 15) {
    this.x = x;
    this.y = y;
    this.mass = mass;
    this.radius = radius;
    this.isDragging = false;
    this.pulse = 0;
  }

  update() {
    this.pulse += 0.04;
  }

  show() {
    if (this.mass <= 0) return;
    push();
    translate(this.x, this.y);

    // 1. Outer gravitational distortion wave (dashed pulsing ring)
    noFill();
    const waveRadius = Math.max(14, this.radius + 16 + Math.sin(this.pulse) * 5);
    stroke(55, 255, 225, 60);
    strokeWeight(1.5);
    drawingContext.setLineDash([4, 4]);
    ellipse(0, 0, waveRadius * 2);
    drawingContext.setLineDash([]);

    // 2. Lensing influence zone (subtle glow ring)
    stroke(55, 255, 225, 30);
    strokeWeight(6);
    ellipse(0, 0, Math.max(12, this.radius + 8) * 2);

    // 3. Accretion disk photon ring (warm amber glow)
    stroke(255, 115, 26, 180);
    strokeWeight(2.5);
    ellipse(0, 0, Math.max(10, this.radius + 3) * 2);

    // 4. Event horizon / Orb core
    if (this.radius > 0) {
      // Black hole event horizon (pitch black sphere with glowing rim)
      fill(0);
      stroke(55, 255, 225, 230);
      strokeWeight(2);
      ellipse(0, 0, this.radius * 2);
    }

    // 5. Center singularity spark / core orb
    fill(255);
    stroke(55, 255, 225, 200);
    strokeWeight(1);
    ellipse(0, 0, Math.max(4, this.radius > 0 ? 4 : 8));

    pop();
  }

  contains(mx, my) {
    return dist(mx, my, this.x, this.y) <= Math.max(25, this.radius + 10);
  }
}
