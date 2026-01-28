import type { Color } from '../types/data';

export interface Dream7Options {
  type: string;
  width: number;
  height: number;
  reelColor: Color;
  glow: number;
  shear: number;
  thickness: number;
  segments?: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function prepend(m: Matrix, op: Matrix): Matrix {
  return multiply(m, op);
}

function apply(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function translate(tx: number, ty: number): Matrix {
  return [1, 0, 0, 1, tx, ty];
}

function scale(sx: number, sy: number): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

function shear(sx: number, sy: number): Matrix {
  return [1, sy, sx, 1, 0, 0];
}

function rotate(deg: number): Matrix {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

enum Cap {
  Standard,
  Flat,
  MoreLeft,
  Left,
  MoreRight,
  Right,
}

interface Pt {
  x: number;
  y: number;
}

interface SegmentDef {
  name: string;
  points: Pt[];
  lights: Pt[];
  dot: { x: number; y: number; r: number } | null;
  own: Matrix;
}

function capValues(cap: Cap, width: number, capAngle: number): { left: number; right: number; delta: number } {
  let left = 0;
  let right = 0;
  switch (cap) {
    case Cap.Standard:
    case Cap.Flat:
      left = width / 2;
      right = width / 2;
      break;
    case Cap.Left:
      left = 0;
      right = width;
      break;
    case Cap.Right:
      left = width;
      right = 0;
      break;
    case Cap.MoreLeft:
      left = width / 4;
      right = (width * 3) / 4;
      break;
    case Cap.MoreRight:
      left = (width * 3) / 4;
      right = width / 4;
      break;
  }
  const delta = left;
  const t = Math.tan((capAngle / 180) * Math.PI);
  return { left: t * left, right: t * right, delta };
}

function seg(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  topCap: Cap = Cap.Standard,
  bottomCap: Cap = Cap.Standard,
  capAngle = 45,
  glow = 0
): SegmentDef {
  const top = capValues(topCap, width, capAngle);
  const bottom = capValues(bottomCap, width, capAngle);
  const points: Pt[] = [
    { x: top.delta, y: 0 },
    { x: width, y: topCap === Cap.Flat ? 0 : top.right },
    { x: width, y: height - (bottomCap === Cap.Flat ? 0 : bottom.right) },
    { x: bottom.delta, y: height },
    { x: 0, y: height - (bottomCap === Cap.Flat ? 0 : bottom.left) },
    { x: 0, y: topCap === Cap.Flat ? 0 : top.left },
  ];
  const lights: Pt[] = [
    { x: points[0].x, y: points[0].y - glow },
    { x: points[1].x + glow, y: points[1].y },
    { x: points[2].x + glow, y: points[2].y },
    { x: points[3].x, y: points[3].y + glow },
    { x: points[4].x - glow, y: points[4].y },
    { x: points[5].x - glow, y: points[5].y },
  ];
  return { name, points, lights, dot: null, own: prepend(translate(x, y), rotate(angle)) };
}

function dot(x: number, y: number, radius: number): SegmentDef {
  return {
    name: '.',
    points: [{ x: radius, y: radius }],
    lights: [],
    dot: { x: radius, y: radius, r: radius },
    own: translate(x, y),
  };
}

function buildSegments(type: string, TH: number, glow: number): SegmentDef[] {
  const T4 = TH / 4;
  const T2 = TH / 2;
  const S = (
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    a: number,
    tc: Cap = Cap.Standard,
    bc: Cap = Cap.Standard,
    ca = 45
  ): SegmentDef => seg(name, x, y, w, h, a, tc, bc, ca, glow);

  if (type === '14') {
    const angleDiag = 26.5 + T4;
    const MT = TH - T4;
    const sinA = Math.sin((angleDiag / 180) * Math.PI);
    const cosA = Math.cos((angleDiag / 180) * Math.PI);
    const tanA = Math.tan((angleDiag / 180) * Math.PI);
    const diagX = cosA * MT;
    const diagY = sinA * MT;
    const diagHeight = (58 - TH - MT / 2) / sinA + MT / tanA;
    return [
      S('a', T4 + 2, TH, TH, 120 - T2, -90, Cap.MoreRight, Cap.MoreRight),
      S('b', 124 - TH, T4 + 2, TH, 110 - T4, 0, Cap.MoreRight, Cap.Standard),
      S('c', 124 - TH, 116, TH, 110 - T4, 0, Cap.Standard, Cap.MoreRight),
      S('d', T4 + 2, 228, TH, 120 - T2, -90, Cap.MoreLeft, Cap.MoreLeft),
      S('e', 0, 116, TH, 110 - T4, 0, Cap.Standard, Cap.MoreLeft),
      S('f', 0, T4 + 2, TH, 110 - T4, 0, Cap.MoreLeft, Cap.Standard),
      S('g1', T2 + 2, 114 + T2, TH, 59 - T2, -90, Cap.Standard, Cap.Flat),
      dot(135 - T4 * 5, 224 - T4 * 6, TH),
      S('h', TH - diagX + 2, TH + 2 + diagY, MT, diagHeight, -angleDiag, Cap.Right, Cap.Left, 90 - angleDiag),
      S('i', 62 - MT / 2, TH + 2, MT, 110 - TH - T2, 0, Cap.Flat, Cap.Flat),
      S('j', 122 - TH, TH + 2, MT, diagHeight, angleDiag, Cap.Left, Cap.Right, 90 - angleDiag),
      S('g2', 63, 114 + T2, TH, 59 - T2, -90, Cap.Flat, Cap.Standard),
      S('m', MT / 2 - diagX + 64, 116 + T2 + diagY, MT, diagHeight, -angleDiag, Cap.Right, Cap.Left, 90 - angleDiag),
      S('l', 62 - MT / 2, 116 + T2, MT, 110 - TH - T2, 0, Cap.Flat, Cap.Flat),
      S('k', 60 - MT / 2, 116 + TH / 2, MT, diagHeight, angleDiag, Cap.Left, Cap.Right, 90 - angleDiag),
      dot(131 - T4 * 5, 230 - T4 * 4, TH),
    ];
  }
  if (type === '10' || type === '9') {
    return [
      S('a', T4 + 2, TH, TH, 120 - T2, -90, Cap.MoreRight, Cap.MoreRight),
      S('b', 124 - TH, T4 + 2, TH, 110 - T4, 0, Cap.MoreRight, Cap.Standard),
      S('c', 124 - TH, 116, TH, 110 - T4, 0, Cap.Standard, Cap.MoreRight),
      S('d', T4 + 2, 228, TH, 120 - T2, -90, Cap.MoreLeft, Cap.MoreLeft),
      S('e', 0, 116, TH, 110 - T4, 0, Cap.Standard, Cap.MoreLeft),
      S('f', 0, T4 + 2, TH, 110 - T4, 0, Cap.MoreLeft, Cap.Standard),
      S('g1', T2 + 2, 114 + T2, TH, 69 - T2, -90, Cap.Standard, Cap.Standard),
      S('g2', 73, 114 + T2, TH, 49 - T2, -90, Cap.Standard, Cap.Standard),
      S('i', 72 - T2, T2 + 2, TH, 110 - T2, 0, Cap.Standard, Cap.Standard),
      S('l', 72 - T2, 116, TH, 110 - T2, 0, Cap.Standard, Cap.Standard),
    ];
  }
  return [
    S('a', T4 + 2, TH, TH, 120 - T2, -90, Cap.MoreRight, Cap.MoreRight),
    S('b', 124 - TH, T4 + 2, TH, 110 - T4, 0, Cap.MoreRight, Cap.Standard),
    S('c', 124 - TH, 116, TH, 110 - T4, 0, Cap.Standard, Cap.MoreRight),
    S('d', T4 + 2, 228, TH, 120 - T2, -90, Cap.MoreLeft, Cap.MoreLeft),
    S('e', 0, 116, TH, 110 - T4, 0, Cap.Standard, Cap.MoreLeft),
    S('f', 0, T4 + 2, TH, 110 - T4, 0, Cap.MoreLeft, Cap.Standard),
    S('g', T2 + 2, 114 + T2, TH, 120 - TH, -90),
    dot(135 - T4 * 5, 228 - T4 * 5, TH),
  ];
}

function rgba(c: Color, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a / 255})`;
}

function addColor(c: Color, n: number): Color {
  return { r: Math.min(c.r + n, 255), g: Math.min(c.g + n, 255), b: Math.min(c.b + n, 255), a: 255 };
}

function polygonCenter(points: Pt[]): { cx: number; cy: number; r: number } {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  let r = 0;
  for (const p of points) {
    r = Math.max(r, Math.hypot(p.x - cx, p.y - cy));
  }
  return { cx, cy, r: Math.max(r, 1) };
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function traceClosedCurve(ctx: CanvasRenderingContext2D, points: Pt[], tension: number): void {
  const n = points.length;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const c1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const c2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const c2y = p2.y - ((p3.y - p1.y) * tension) / 3;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  ctx.closePath();
}

export function renderDream7Digit(opts: Dream7Options): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const W = Math.max(1, Math.round(opts.width));
  const H = Math.max(1, Math.round(opts.height));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const black: Color = { r: 15, g: 15, b: 15, a: 255 };
  const isBlack = opts.reelColor.r === 0 && opts.reelColor.g === 0 && opts.reelColor.b === 0;
  const lightColor = isBlack ? black : opts.reelColor;
  const glassColor = isBlack ? black : addColor(opts.reelColor, 50);
  const glassColorCenter = isBlack ? black : addColor(opts.reelColor, 70);
  const offColor = black;
  const glassAlpha = 140;
  const glassAlphaCenter = 255;
  const glow = opts.glow;
  const thickness = 16;
  let nShear = opts.shear;
  if (nShear < 0) nShear = 0;
  if (nShear > 2) nShear = 2;
  const scaleFactor = 0.5;

  let style: Matrix = IDENTITY;
  style = prepend(style, shear(-nShear, 0));
  style = prepend(style, scale(scaleFactor, scaleFactor));
  style = prepend(style, translate(10, 10));

  const boundsRect = { x: -10, y: -10, w: 154 + 15, h: 264 };
  const corners = [
    apply(style, boundsRect.x, boundsRect.y),
    apply(style, boundsRect.x + boundsRect.w, boundsRect.y),
    apply(style, boundsRect.x + boundsRect.w, boundsRect.y + boundsRect.h),
    apply(style, boundsRect.x, boundsRect.y + boundsRect.h),
  ];
  const minX = Math.min(...corners.map(p => p.x));
  const maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y));
  const maxY = Math.max(...corners.map(p => p.y));

  let m: Matrix = IDENTITY;
  const sx = (W + 3) / (maxX - minX);
  const sy = (H - 1) / (maxY - minY);
  if (sx > 0 && sy > 0) m = prepend(m, scale(sx, sy));
  m = prepend(m, translate(-minX, -minY));
  m = multiply(m, style);

  const segments = buildSegments(opts.type, thickness, glow);
  const litMask = opts.segments ?? 65535;
  const isOn = (i: number, s: SegmentDef): boolean => {
    if ((opts.type === '10' || opts.type === '9') && s.name === 'g2') return (litMask & (1 << (i - 1))) !== 0;
    return (litMask & (1 << i)) !== 0;
  };

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const withTransform = (s: SegmentDef, fn: () => void): void => {
    const t = multiply(m, s.own);
    ctx.save();
    ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
    fn();
    ctx.restore();
  };

  const traceGlass = (s: SegmentDef): void => {
    if (s.dot) {
      ctx.beginPath();
      ctx.ellipse(s.dot.x + s.dot.r / 2, s.dot.y + s.dot.r / 2, s.dot.r / 2, s.dot.r / 2, 0, 0, Math.PI * 2);
    } else {
      tracePolygon(ctx, s.points);
    }
  };

  segments.forEach((s, i) => {
    if (isOn(i, s)) return;
    withTransform(s, () => {
      traceGlass(s);
      ctx.fillStyle = rgba(offColor, 255);
      ctx.fill();
    });
  });

  if (glow > 0) {
    segments.forEach((s, i) => {
      if (!isOn(i, s)) return;
      withTransform(s, () => {
        let cx: number;
        let cy: number;
        let r: number;
        if (s.dot) {
          const d = s.dot;
          ctx.beginPath();
          ctx.ellipse(d.x + d.r / 2, d.y + d.r / 2, d.r / 2 + glow, d.r / 2 + glow, 0, 0, Math.PI * 2);
          cx = d.x + d.r / 2;
          cy = d.y + d.r / 2;
          r = d.r / 2 + glow;
        } else {
          traceClosedCurve(ctx, s.lights, 0.5);
          const c = polygonCenter(s.lights);
          cx = c.cx;
          cy = c.cy;
          r = c.r;
        }
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, rgba(lightColor, 255));
        grad.addColorStop(1, rgba(lightColor, 0));
        ctx.fillStyle = grad;
        ctx.fill();
      });
    });
  }

  segments.forEach((s, i) => {
    if (!isOn(i, s)) return;
    withTransform(s, () => {
      traceGlass(s);
      let cx: number;
      let cy: number;
      let r: number;
      if (s.dot) {
        cx = s.dot.x + s.dot.r / 2;
        cy = s.dot.y + s.dot.r / 2;
        r = s.dot.r / 2;
      } else {
        const c = polygonCenter(s.points);
        cx = c.cx;
        cy = c.cy;
        r = c.r;
      }
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, rgba(glassColorCenter, glassAlphaCenter));
      grad.addColorStop(1, rgba(glassColor, glassAlpha));
      ctx.fillStyle = grad;
      ctx.fill();
    });
  });

  return canvas;
}
