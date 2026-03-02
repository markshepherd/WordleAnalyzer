import { useState, useCallback, useEffect } from "react";

// ── INLINED FROM wordle_color_logic.js — edit that file, not here ────────────
const PARAMS = {
  CHROMA_MIN: 8, REL_SAT_MIN: 0.03,
  YELLOW_HUE_LO: 40, YELLOW_HUE_HI: 70,
  GREEN_HUE_LO: 71, GREEN_HUE_HI: 165,
  SAMPLE_OFFSET: 0.30,
};

const classifyColor = (r, g, b) => {
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
};

const isTilePixel = (r, g, b) => {
  const brightness = (r + g + b) / 3;
  return brightness >= 25 && brightness <= 200;
};

const detectBoardBounds = (getPixel, W, H) => {
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
};

const sampleTileColor = (getPixel, bounds, numRows, row, col, W, H) => {
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
};

const detectColorsFromPixels = (dataUrl, numRows = 6) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const W = img.width, H = img.height;
      const getPixel = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
      const bounds = detectBoardBounds(getPixel, W, H);
      const colors = [];
      for (let row = 0; row < numRows; row++)
        for (let col = 0; col < 5; col++)
          colors.push(sampleTileColor(getPixel, bounds, numRows, row, col, W, H));
      resolve(colors);
    };
    img.src = dataUrl;
  });
// ── END wordle_color_logic.js ─────────────────────────────────────────────────

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #f0f0f0; font-family: 'Space Mono', monospace; min-height: 100vh; }
  .app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; background: radial-gradient(ellipse at 20% 50%, #1a1a2e 0%, #0a0a0a 60%); }
  h1 { font-family: 'Syne', sans-serif; font-weight: 800; font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.02em; margin-bottom: 8px; background: linear-gradient(135deg, #6aaa64 0%, #c9b458 60%, #ffffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .subtitle { color: #aaa; font-size: 0.8rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 48px; }
  .upload-zone { width: 100%; max-width: 480px; border: 2px dashed #333; border-radius: 4px; padding: 48px 32px; text-align: center; cursor: pointer; transition: all 0.2s; background: #111; position: relative; overflow: hidden; }
  .upload-zone::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(106,170,100,0.05), rgba(201,180,88,0.05)); opacity: 0; transition: opacity 0.2s; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: #6aaa64; transform: translateY(-2px); }
  .upload-zone:hover::before, .upload-zone.drag-over::before { opacity: 1; }
  .upload-icon { font-size: 2.5rem; margin-bottom: 16px; display: block; }
  .upload-label { font-size: 0.85rem; color: #888; line-height: 1.6; }
  .upload-label strong { color: #6aaa64; display: block; font-size: 1rem; margin-bottom: 4px; }
  .preview-area { width: 100%; max-width: 480px; margin-top: 24px; }
  .preview-img { width: 100%; border-radius: 4px; border: 1px solid #222; display: block; }
  .analyze-btn { width: 100%; max-width: 480px; margin-top: 16px; padding: 16px; background: #6aaa64; color: #000; border: none; border-radius: 4px; font-family: 'Space Mono', monospace; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .analyze-btn:hover:not(:disabled) { background: #79c173; transform: translateY(-1px); }
  .analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .loading { display: flex; align-items: center; gap: 12px; color: #666; font-size: 0.8rem; letter-spacing: 0.1em; margin-top: 24px; }
  .spinner { width: 18px; height: 18px; border: 2px solid #333; border-top-color: #6aaa64; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .results { width: 100%; max-width: 480px; margin-top: 32px; background: #111; border: 1px solid #222; border-radius: 4px; padding: 28px; }
  .results-title { font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: #555; margin-bottom: 20px; }
  .letters-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .letter-tile { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.5rem; border-radius: 3px; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
  @keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .letter-tile.green { background: #6aaa64; color: #fff; }
  .letter-tile.yellow { background: #c9b458; color: #fff; }
  .letter-tile.gray { background: #787c7e; color: #f0f0f0; }
  .no-letters { color: #555; font-size: 0.85rem; text-align: center; padding: 16px 0; }
  .row-breakdown { margin-top: 24px; border-top: 1px solid #1e1e1e; padding-top: 20px; }
  .row-line { font-size: 0.72rem; font-family: 'Space Mono', monospace; color: #666; margin-bottom: 8px; line-height: 1.5; white-space: nowrap; }
  .row-line .row-label { color: #aaa; margin-right: 6px; }
  .row-line .c-green { color: #6aaa64; font-weight: 700; }
  .row-line .c-yellow { color: #c9b458; font-weight: 700; }
  .row-line .c-gray { color: #d0d0d0; }
  .col-analysis .row-line { font-size: 0.9rem; color: #fff; }
  .col-analysis .row-line .row-label { color: #fff; }
  .reset-btn { margin-top: 20px; background: none; border: 1px solid #333; color: #aaa; padding: 10px 20px; border-radius: 4px; font-family: 'Space Mono', monospace; font-size: 0.75rem; cursor: pointer; letter-spacing: 0.1em; transition: all 0.2s; }
  .reset-btn:hover { border-color: #555; color: #fff; }
  .error { width: 100%; max-width: 480px; margin-top: 16px; padding: 16px; background: rgba(255,80,80,0.1); border: 1px solid rgba(255,80,80,0.3); border-radius: 4px; color: #ff8080; font-size: 0.8rem; line-height: 1.5; }
  input[type="file"] { display: none; }
`;

export default function WordleAnalyzer() {
  const [image, setImage] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rawTiles, setRawTiles] = useState(null);
  const [rawRows, setRawRows] = useState(null); // array of {word, tiles:[{letter,color}]}
  const [error, setError] = useState(null);

  const results = rawTiles ? (() => {
    const greenSet = new Set(), yellowSet = new Set(), graySet = new Set();
    for (const tile of rawTiles) {
      const l = tile.letter?.toUpperCase();
      if (!l) continue;
      if (tile.color === "green")  greenSet.add(l);
      if (tile.color === "yellow") yellowSet.add(l);
      if (tile.color === "gray")   graySet.add(l);
    }
    const used = new Set([...greenSet, ...yellowSet, ...graySet]);
    const unused = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(l => !used.has(l));
    return { green: [...greenSet].sort(), yellow: [...yellowSet].sort(), gray: [...graySet].sort(), unused };
  })() : null;

  const totalLetters = results ? [...new Set([...results.green, ...results.yellow, ...results.gray])].length : 0;

  const cycleColor = (index) => {
    const order = ["gray", "green", "yellow"];
    setRawTiles(prev => prev.map((t, i) => i !== index ? t : { ...t, color: order[(order.indexOf(t.color) + 1) % order.length] }));
  };

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImage({ dataUrl, base64: dataUrl.split(",")[1], mediaType: file.type });
      setRawTiles(null); setRawRows(null); setError(null);
    };
    reader.readAsDataURL(file);
  };

  const onFileInput = (e) => processFile(e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); };

  useEffect(() => { if (image && !rawTiles) analyze(); }, [image]);

  const analyze = async () => {
    if (!image) return;
    setLoading(true); setError(null); setRawTiles(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
              { type: "text", text: `This is a Wordle board: 5 columns and 1-6 rows of letter tiles.\n\nRead the letters row by row, left to right. Use "." for any empty tile.\nReturn ONLY a JSON array of exactly 6 strings, each exactly 5 characters.\nExample: ["CRANE", "STOMP", "BIRDS", ".....", ".....", "....."]\n\nOnly return the JSON array, nothing else.` },
            ],
          }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Could not parse letters from response. Raw: " + text.slice(0, 300));
      const rows = JSON.parse(match[0]);
      const numRows = rows.filter(r => r.replace(/\./g, "").length > 0).length;
      const pixelColors = await detectColorsFromPixels(image.dataUrl, numRows);
      const tiles = [];
      const rowsData = [];
      let pixelRow = 0;
      for (let r = 0; r < 6; r++) {
        const rowStr = (rows[r] || "").padEnd(5, ".");
        if (rowStr.replace(/\./g, "").length === 0) continue;
        const rowTiles = [];
        for (let c = 0; c < 5; c++) {
          const letter = rowStr[c];
          if (letter && letter !== ".") {
            const tile = { letter: letter.toUpperCase(), color: pixelColors[pixelRow * 5 + c] };
            tiles.push(tile);
            rowTiles.push(tile);
          }
        }
        rowsData.push({ word: rowStr.replace(/\./g, ""), tiles: rowTiles });
        pixelRow++;
      }
      setRawTiles(tiles);
      setRawRows(rowsData);
    } catch (err) {
      setError(`Error: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setImage(null); setRawTiles(null); setRawRows(null); setError(null); };

  const onPaste = useCallback((e) => {
    if (image) return;
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith("image/"));
    if (item) processFile(item.getAsFile());
  }, [image]);

  useEffect(() => {
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPaste]);

  // ── column analysis helper (used in render) ─────────────────────────────────
  const colData = rawRows && rawRows.length > 0 ? (() => {
    const greenByCol = {}, yellowByCol = {}, forbiddenByCol = {};
    for (let col = 1; col <= 5; col++) { yellowByCol[col] = new Set(); forbiddenByCol[col] = new Set(); }
    for (const row of rawRows) {
      row.tiles.forEach((t, i) => {
        const col = i + 1;
        if (t.color === "green") greenByCol[col] = t.letter;
        else if (t.color === "yellow") { yellowByCol[col].add(t.letter); forbiddenByCol[col].add(t.letter); }
      });
    }
    const greenCols = Object.keys(greenByCol).map(Number).sort();
    const nonGreenCols = [1,2,3,4,5].filter(c => !greenByCol[c]);
    const n = nonGreenCols.length;
    const greenLetters = new Set(Object.values(greenByCol));
    const yellowOnlyLetters = [...new Set(
      rawRows.flatMap(row => row.tiles.filter(t => t.color === "yellow").map(t => t.letter))
    )].filter(l => !greenLetters.has(l)).sort();
    const candidateList = [...yellowOnlyLetters];
    while (candidateList.length < n) candidateList.push("_");
    const permute = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((v, i) => permute([...arr.slice(0,i),...arr.slice(i+1)]).map(p => [v,...p]));
    const words = [...new Set(permute(candidateList)
      .map(p => { let pi = 0; return [1,2,3,4,5].map(col => greenByCol[col] || p[pi++]).join(""); })
      .filter(word => nonGreenCols.every(col => !forbiddenByCol[col].has(word[col-1])))
    )];
    return { greenByCol, yellowByCol, greenCols, nonGreenCols, n, candidateList, words };
  })() : null;

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 480, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>WORDLE SCAN</h1>
          {image && rawTiles && <button className="reset-btn" style={{ margin: 0 }} onClick={reset}>← New Screenshot</button>}
        </div>
        {!image ? (
          <label className={`upload-zone ${dragging ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <span className="upload-icon">⬜</span>
            <div className="upload-label">
              <strong>Ctrl+V to paste screenshot</strong>
              or drop a file here · or click to browse
            </div>
            <input type="file" accept="image/*" onChange={onFileInput} />
          </label>
        ) : (
          <>
            {loading && <div className="loading"><div className="spinner" />Reading the board...</div>}
            {error && <div className="error">{error}</div>}

            {/* ── post-analysis results ── */}
            {rawTiles && results && (
              <div className="results">
                {/* 1. image */}
                <img src={image.dataUrl} alt="Wordle board" style={{ maxWidth: 300, maxHeight: 300, width: "auto", height: "auto", borderRadius: 4, border: "1px solid #222", display: "block", marginBottom: 20 }} />

                {/* 2. permutations */}
                {colData && colData.words.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="results-title" style={{ marginBottom: 8, color: "#aaa" }}>Permutations</div>
                    {colData.words.map((word, i) => (
                      <div key={i} style={{ fontFamily: "'Space Mono', monospace", fontSize: "1rem", color: "#fff", marginBottom: 4 }}>{word}</div>
                    ))}
                  </div>
                )}

                {/* 3. unused letters line */}
                {results.unused.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="results-title" style={{ marginBottom: 6, color: "#fff" }}>Unused</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "1rem", color: "#fff", letterSpacing: "0.1em" }}>
                      {results.unused.join(" ")}
                    </div>
                  </div>
                )}

                {/* 4. green / yellow / gray / unused tiles */}
                <div className="results-title" style={{ marginBottom: 10 }}>
                  {totalLetters === 0 ? "No colored letters found" : `${totalLetters} unique letter${totalLetters !== 1 ? "s" : ""} found`}
                </div>
                {results.green.length > 0 && <>
                  <div className="results-title" style={{ marginBottom: 10, color: "#6aaa64" }}>● Green — correct position</div>
                  <div className="letters-grid" style={{ marginBottom: 20 }}>
                    {results.green.map((l, i) => <div key={l} className="letter-tile green" style={{ animationDelay: `${i * 0.06}s` }}>{l}</div>)}
                  </div>
                </>}
                {results.yellow.length > 0 && <>
                  <div className="results-title" style={{ marginBottom: 10, color: "#c9b458" }}>● Yellow — in word, wrong position</div>
                  <div className="letters-grid" style={{ marginBottom: 20 }}>
                    {results.yellow.map((l, i) => <div key={l} className="letter-tile yellow" style={{ animationDelay: `${(results.green.length + i) * 0.06}s` }}>{l}</div>)}
                  </div>
                </>}
                {results.gray.length > 0 && <>
                  <div className="results-title" style={{ marginBottom: 10, color: "#787c7e" }}>● Gray — not in word</div>
                  <div className="letters-grid" style={{ marginBottom: 20 }}>
                    {results.gray.map((l, i) => <div key={l} className="letter-tile gray" style={{ animationDelay: `${(results.green.length + results.yellow.length + i) * 0.06}s` }}>{l}</div>)}
                  </div>
                </>}
                {results.unused.length > 0 && <>
                  <div className="results-title" style={{ marginBottom: 10, color: "#aaa" }}>● Unused — not yet tried</div>
                  <div className="letters-grid" style={{ marginBottom: 20 }}>
                    {results.unused.map((l, i) => (
                      <div key={l} className="letter-tile" style={{ background: "#1a1a1a", color: "#555", border: "1px solid #2a2a2a", animationDelay: `${(results.green.length + results.yellow.length + results.gray.length + i) * 0.03}s` }}>{l}</div>
                    ))}
                  </div>
                </>}
                {totalLetters === 0 && <div className="no-letters">No tiles detected in this image.</div>}

                {/* 4. column analysis */}
                {colData && (
                  <div className="row-breakdown col-analysis" style={{ marginTop: 20 }}>
                    <div className="results-title" style={{ marginBottom: 12, color: "#aaa" }}>Column analysis</div>
                    <div className="row-line" style={{ marginBottom: 6 }}>
                      <span className="row-label">Green cols: </span>
                      {colData.greenCols.length === 0
                        ? <span style={{ color: "#555" }}>none</span>
                        : colData.greenCols.map(c => <span key={c} className="c-green" style={{ marginRight: 8 }}>col{c}={colData.greenByCol[c]}</span>)
                      }
                    </div>
                    {colData.nonGreenCols.map(col => (
                      <div key={col} className="row-line">
                        <span className="row-label">Col {col} yellow: </span>
                        {colData.yellowByCol[col].size === 0
                          ? <span style={{ color: "#555" }}>none</span>
                          : <span className="c-yellow">{[...colData.yellowByCol[col]].sort().join(", ")}</span>
                        }
                      </div>
                    ))}
                    <div className="row-line" style={{ marginTop: 8 }}>
                      <span className="row-label">n (non-green cols): </span>
                      <span style={{ color: "#d0d0d0" }}>{colData.n}</span>
                    </div>
                    <div className="row-line">
                      <span className="row-label">Candidates: </span>
                      <span style={{ color: "#c9b458" }}>[{colData.candidateList.join(", ")}]</span>
                    </div>
                  </div>
                )}

                {/* 5. row breakdown */}
                {rawRows && rawRows.length > 0 && (
                  <div className="row-breakdown">
                    <div className="results-title" style={{ marginBottom: 12, color: "#aaa" }}>Row breakdown</div>
                    {rawRows.map((row, i) => (
                      <div key={i} className="row-line">
                        <span className="row-label">Row {i + 1} {row.word}:</span>
                        {row.tiles.map((t, j) => (
                          <span key={j}>
                            {j > 0 && <span style={{ color: "#333" }}>, </span>}
                            <span className={`c-${t.color}`}>{t.letter}={t.color}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>
    </>
  );
}
