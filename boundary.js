const DEFAULT_WALL_WIDTH = 20;

class Boundary {
  constructor(x1, y1, x2, y2, width = DEFAULT_WALL_WIDTH, options = {}) {
    this.isExterior = Boolean(options.isExterior);
    this.baseX1 = Number.isFinite(options.baseX1) ? options.baseX1 : x1;
    this.baseY1 = Number.isFinite(options.baseY1) ? options.baseY1 : y1;
    this.baseX2 = Number.isFinite(options.baseX2) ? options.baseX2 : x2;
    this.baseY2 = Number.isFinite(options.baseY2) ? options.baseY2 : y2;
    this.baseWidth = Number.isFinite(options.baseWidth) ? options.baseWidth : width;
    this.setGeometry(x1, y1, x2, y2, width);
  }

  setGeometry(x1, y1, x2, y2, width = this.width) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.width = width;
    this._corners = null;
    this._segments = null;
  }

  applyLengthAndWidth(scalePercent = 100, width = this.baseWidth) {
    if (this.isExterior) {
      return;
    }

    const scale = scalePercent / 100;
    const centerX = (this.baseX1 + this.baseX2) / 2;
    const centerY = (this.baseY1 + this.baseY2) / 2;
    const halfDX = ((this.baseX2 - this.baseX1) / 2) * scale;
    const halfDY = ((this.baseY2 - this.baseY1) / 2) * scale;

    this.setGeometry(
      centerX - halfDX,
      centerY - halfDY,
      centerX + halfDX,
      centerY + halfDY,
      Math.max(1, width)
    );
  }

  getCorners() {
    if (this._corners) {
      return this._corners;
    }

    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const length = Math.hypot(dx, dy) || 1;
    const halfWidth = this.width / 2;
    const offsetX = (-dy / length) * halfWidth;
    const offsetY = (dx / length) * halfWidth;

    this._corners = [
      { x: this.x1 + offsetX, y: this.y1 + offsetY },
      { x: this.x2 + offsetX, y: this.y2 + offsetY },
      { x: this.x2 - offsetX, y: this.y2 - offsetY },
      { x: this.x1 - offsetX, y: this.y1 - offsetY },
    ];

    return this._corners;
  }

  getSegments() {
    if (this._segments) {
      return this._segments;
    }

    const corners = this.getCorners();
    this._segments = [
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[3]],
      [corners[3], corners[0]],
    ];

    return this._segments;
  }

  getLength() {
    return Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
  }

  getAngle() {
    return Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
  }

  getCenter() {
    return {
      x: (this.x1 + this.x2) / 2,
      y: (this.y1 + this.y2) / 2,
    };
  }

  getCornerRadius() {
    return Math.min(this.width * 0.33, this.width / 2, this.getLength() / 2);
  }

  show() {
    const center = this.getCenter();
    const length = this.getLength();
    const angle = this.getAngle();
    const radius = this.getCornerRadius();

    push();
    translate(center.x, center.y);
    rotate(angle);
    rectMode(CENTER);
    noFill();
    stroke(205, 215, 230, 185);
    strokeWeight(1.5);
    rect(0, 0, length, this.width, radius);
    pop();
  }
}
