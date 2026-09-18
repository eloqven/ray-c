class Boundary {
  constructor(x1, y1, x2, y2) {
    this.a = createVector(x1, y1);
    this.b = createVector(x2, y2);
    this.dx = x2 - x1;
    this.dy = y2 - y1;
    this.minX = Math.min(x1, x2);
    this.maxX = Math.max(x1, x2);
    this.minY = Math.min(y1, y2);
    this.maxY = Math.max(y1, y2);
  }

  show() {
    stroke(175);
    line(this.a.x, this.a.y, this.b.x, this.b.y);
  }
}