import type { Color } from '../types/data';

const TL = 8;

type Poly = [number, number][];

const LED8: Poly[] = [
  [
    [22, 5],
    [26, 2],
    [88, 2],
    [92, 5],
    [85, 11],
    [29, 11],
  ],
  [
    [93, 7],
    [96, 10],
    [96 - TL, 46],
    [93 - TL, 49],
    [87 - TL, 43],
    [87, 12],
  ],
  [
    [92 - TL, 51],
    [95 - TL, 54],
    [96 - 2 * TL, 90],
    [93 - 2 * TL, 93],
    [87 - 2 * TL, 88],
    [86 - TL, 57],
  ],
  [
    [22 - 2 * TL, 95],
    [29 - 2 * TL, 89],
    [85 - 2 * TL, 89],
    [92 - 2 * TL, 95],
    [88 - 2 * TL, 98],
    [26 - 2 * TL, 98],
  ],
  [
    [20 - TL, 51],
    [26 - TL, 57],
    [27 - 2 * TL, 88],
    [21 - 2 * TL, 93],
    [17 - 2 * TL, 90],
    [17 - TL, 54],
  ],
  [
    [21, 7],
    [27, 12],
    [27 - TL, 43],
    [21 - TL, 49],
    [18 - TL, 46],
    [18, 10],
  ],
  [
    [23 - TL, 50],
    [27 - TL, 46],
    [86 - TL, 46],
    [90 - TL, 50],
    [86 - TL, 54],
    [27 - TL, 54],
  ],
];

const LED10: Poly[] = [
  [
    [22, 5],
    [26, 2],
    [88, 2],
    [92, 5],
    [85, 11],
    [72, 11],
    [67, 6],
    [62, 11],
    [29, 11],
  ],
  LED8[1],
  LED8[2],
  [
    [22 - 2 * TL, 95],
    [29 - 2 * TL, 89],
    [61 - 2 * TL, 89],
    [66 - 2 * TL, 94],
    [71 - 2 * TL, 89],
    [85 - 2 * TL, 89],
    [92 - 2 * TL, 95],
    [88 - 2 * TL, 98],
    [26 - 2 * TL, 98],
  ],
  LED8[4],
  LED8[5],
  [
    [23 - TL, 50],
    [27 - TL, 46],
    [63 - TL, 46],
    [68 - TL, 51],
    [73 - TL, 46],
    [86 - TL, 46],
    [90 - TL, 50],
    [86 - TL, 54],
    [72 - TL, 54],
    [67 - TL, 49],
    [62 - TL, 54],
    [27 - TL, 54],
  ],
  [
    [67, 9],
    [71, 13],
    [71 - TL, 45],
    [67 - TL, 49],
    [63 - TL, 45],
    [63, 13],
  ],
  [
    [68, 7],
    [72, 11],
    [72 - TL, 43],
    [68 - TL, 47],
    [64 - TL, 43],
    [64, 7],
  ],
  [
    [66 - TL, 51],
    [70 - TL, 55],
    [70 - 2 * TL, 88],
    [66 - 2 * TL, 92],
    [62 - 2 * TL, 88],
    [62 - TL, 51],
  ],
];

const LED14: Poly[] = [
  LED8[0],
  LED8[1],
  LED8[2],
  LED8[3],
  LED8[4],
  LED8[5],
  [
    [23 - TL, 50],
    [27 - TL, 46],
    [52 - TL, 46],
    [55 - TL, 50],
    [52 - TL, 54],
    [27 - TL, 54],
  ],
  [
    [104 - 2 * TL, 87],
    [109 - 2 * TL, 90],
    [109 - 2 * TL, 95],
    [104 - 2 * TL, 99],
    [100 - 2 * TL, 95],
    [100 - 2 * TL, 90],
  ],
  [
    [30, 13],
    [34, 17],
    [54 - TL, 38],
    [51 - TL, 43],
    [48 - TL, 40],
    [27, 16],
  ],
  [
    [57, 13],
    [61, 13],
    [61 - TL, 46],
    [57 - TL, 48],
    [53 - TL, 46],
    [53, 13],
  ],
  [
    [82, 13],
    [85, 16],
    [68 - TL, 42],
    [65 - TL, 44],
    [63 - TL, 39],
    [77, 17],
  ],
  [
    [58 - TL, 50],
    [62 - TL, 46],
    [86 - TL, 46],
    [90 - TL, 50],
    [86 - TL, 54],
    [62 - TL, 54],
  ],
  [
    [82 - 2 * TL, 85],
    [87 - 2 * TL, 86],
    [67 - TL, 57],
    [62 - TL, 57],
    [62 - TL, 60],
    [79 - 2 * TL, 86],
  ],
  [
    [57 - TL, 52],
    [61 - TL, 54],
    [61 - 2 * TL, 88],
    [57 - 2 * TL, 88],
    [53 - 2 * TL, 88],
    [53 - TL, 54],
  ],
  [
    [30 - 2 * TL, 83],
    [33 - 2 * TL, 86],
    [50 - TL, 60],
    [47 - TL, 57],
    [42 - TL, 61],
    [27 - 2 * TL, 86],
  ],
  [
    [102 - 2 * TL, 97],
    [107 - 2 * TL, 100],
    [107 - 2 * TL, 105],
    [102 - 2 * TL, 109],
    [98 - 2 * TL, 105],
    [98 - 2 * TL, 100],
  ],
];

const LED16: Poly[] = [LED8[0]];

export function ledSegmentPolygons(type: string): Poly[] {
  switch (type) {
    case '9':
    case '10':
      return LED10;
    case '14':
      return LED14;
    case '16':
      return LED16;
    default:
      return LED8;
  }
}

export function renderLedDigit(type: string, color: Color | null, segments = 65535): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 30;
  canvas.height = 40;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 30, 40);

  const sx = 30 / 103;
  const sy = 40 / 103;
  const c0 = color ? `rgb(${color.r},${color.g},${color.b})` : 'rgb(254,50,25)';
  const c1 = color ? `rgb(${color.r},${color.g},${color.b})` : 'rgb(247,40,30)';
  const grad = ctx.createLinearGradient(0, 0, 70, 70);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  const gray = 'rgb(15,15,15)';

  const polys = ledSegmentPolygons(type);
  polys.forEach((poly, i) => {
    ctx.beginPath();
    poly.forEach(([x, y], idx) => {
      if (idx === 0) ctx.moveTo(x * sx, y * sy);
      else ctx.lineTo(x * sx, y * sy);
    });
    ctx.closePath();
    ctx.fillStyle = (segments & (1 << i)) !== 0 ? grad : gray;
    ctx.fill();
  });
  return canvas;
}
