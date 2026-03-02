/**
 * wordle_color_logic.js
 * =====================
 * Wordle tile color detection.
 * Assumes input image contains only the tile grid (5 cols, 1-6 rows).
 * No keyboard or title handling needed.
 *
 * Node usage (via wordle_tester.py):
 *   echo '<json>' | node wordle_color_logic.js
 */

const PARAMS = {
  CHROMA_MIN:    8,
  REL_SAT_MIN:   0.03,
  YELLOW_HUE_LO: 40,
  YELLOW_HUE_HI: 70,
  GREEN_HUE_LO:  71,
  GREEN_HUE_HI:  165,
  SAMPLE_OFFSET: 0.30,
};

function classifyColor(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < PARAMS.CHROMA_MIN) return "gray";
  let h;
  if (max === r)      h = ((g - b) / chroma + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / chroma + 2) * 60;
  else                h = ((r - g) / chroma + 4) * 60;
  if (chroma / Math.max((r + g + b) / 3, 1) < PARAMS.REL_SAT_MIN) return "gray";
  if (h >= PARAMS.YELLOW_HUE_LO && h <= PARAMS.YELLOW_HUE_HI) return "yellow";
  if (h >= PARAMS.GREEN_HUE_LO  && h <= PARAMS.GREEN_HUE_HI)  return "green";
  return "gray";
}

function isTilePixel(r, g, b) {
  const brightness = (r + g + b) / 3;
  return brightness >= 25 && brightness <= 200;
}

function detectBoardBounds(getPixel, W, H) {
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const [r, g, b] = getPixel(x, y);
      if (isTilePixel(r, g, b)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  if (maxX <= minX || maxY <= minY) return { x: 0, y: 0, w: W, h: H };
  const pad = 4;
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
  return { x: x0, y: y0, w: Math.min(W, maxX + pad) - x0, h: Math.min(H, maxY + pad) - y0 };
}

function sampleTileColor(getPixel, bounds, numRows, row, col, W, H) {
  const cellW = bounds.w / 5, cellH = bounds.h / numRows;
  const cx = bounds.x + (col + 0.5) * cellW;
  const cy = bounds.y + (row + 0.5) * cellH;
  const ox = cellW * PARAMS.SAMPLE_OFFSET, oy = cellH * PARAMS.SAMPLE_OFFSET;
  const pts = [
    [cx-ox,cy-oy],[cx,cy-oy],[cx+ox,cy-oy],
    [cx-ox,cy],              [cx+ox,cy],
    [cx-ox,cy+oy],[cx,cy+oy],[cx+ox,cy+oy],
  ];
  let rSum = 0, gSum = 0, bSum = 0;
  for (const [sx, sy] of pts) {
    const [r, g, b] = getPixel(Math.max(0,Math.min(W-1,Math.round(sx))), Math.max(0,Math.min(H-1,Math.round(sy))));
    rSum += r; gSum += g; bSum += b;
  }
  const n = pts.length;
  return classifyColor(rSum/n|0, gSum/n|0, bSum/n|0);
}

function detectColorsFromPixels(dataUrl, numRows = 6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const W = img.width, H = img.height;
      const getPixel = (x, y) => { const d = ctx.getImageData(x,y,1,1).data; return [d[0],d[1],d[2]]; };
      const bounds = detectBoardBounds(getPixel, W, H);
      const colors = [];
      for (let row = 0; row < numRows; row++)
        for (let col = 0; col < 5; col++)
          colors.push(sampleTileColor(getPixel, bounds, numRows, row, col, W, H));
      resolve(colors);
    };
    img.src = dataUrl;
  });
}

if (typeof process !== "undefined" && typeof window === "undefined") {
  let raw = "";
  process.stdin.on("data", chunk => raw += chunk);
  process.stdin.on("end", () => {
    const { pixels, width: W, height: H, numRows } = JSON.parse(raw);
    const getPixel = (x, y) => pixels[y * W + x];
    const bounds = detectBoardBounds(getPixel, W, H);
    const colors = [];
    for (let row = 0; row < numRows; row++)
      for (let col = 0; col < 5; col++)
        colors.push(sampleTileColor(getPixel, bounds, numRows, row, col, W, H));
    process.stdout.write(JSON.stringify({ colors }));
  });
}

if (typeof module !== "undefined") {
  module.exports = { classifyColor, isTilePixel, detectBoardBounds, sampleTileColor, detectColorsFromPixels, PARAMS };
}
