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

  applyWidth(width) {
    if (this.isExterior) {
      return;
    }
    this.setGeometry(
      this.baseX1,
      this.baseY1,
      this.baseX2,
      this.baseY2,
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

  show() {
    const corners = this.getCorners();
    noFill();
    stroke(205, 215, 230, 185);
    strokeWeight(1.5);
    quad(
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y
    );
  }
}
