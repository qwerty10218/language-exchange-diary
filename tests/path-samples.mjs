import { svgPathProperties } from 'svg-path-properties';
// An independent SVG implementation reads full curves, not just M/L endpoints.
export function points(d) {
  const path = new svgPathProperties(d), length = path.getTotalLength();
  const count = Math.max(2, Math.ceil(length / 4) + 1);
  return Array.from({ length: count }, (_, i) => path.getPointAtLength(length * i / (count - 1)));
}
