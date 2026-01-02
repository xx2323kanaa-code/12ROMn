/* =========================================================
   ROM Analyzer
   MODE:
     EXT_OK = 伸展可能時測定（伸展位自動検出）
     EXT_NG = 伸展不能時測定（ROM弧のみ）
   ========================================================= */

const ROM_NAME = "12ROMn";
const ANALYZE_VERSION = "v1.2.0-dual";
const BUILD_TIME = "2026-01-02";

log(`Analyze.js loaded : ${ROM_NAME} ${ANALYZE_VERSION}`);
log(`BUILD ${BUILD_TIME}`);

/* ---------- Utility ---------- */

function angleDeg(a, b, c) {
  const BA = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const BC = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const dot = BA.x * BC.x + BA.y * BC.y + BA.z * BC.z;
  const magBA = Math.hypot(BA.x, BA.y, BA.z);
  const magBC = Math.hypot(BC.x, BC.y, BC.z);
  if (magBA * magBC === 0) return NaN;
  const cos = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
  return Math.acos(cos) * 180 / Math.PI;
}

/* ---------- Finger map (MediaPipe Hands) ---------- */

const FINGERS = {
  ring:  { mcp:13, pip:14, dip:15, tip:16 },
  pinky: { mcp:17, pip:18, dip:19, tip:20 }
};

/* ---------- Core ---------- */

async function analyze(mode = "EXT_OK") {

  log("--------------------------------------------------");
  log(`analyze() start`);
  log(`MODE = ${mode}`);
  log(`ROM = ${ROM_NAME}  VER = ${ANALYZE_VERSION}`);

  if (!window.video || !window.hands) {
    log("ERROR: video / hands not ready");
    return;
  }

  const duration = video.duration;
  const DT = 0.5;

  const data = {};
  for (const f in FINGERS) {
    data[f] = { MCP: [], PIP: [], DIP: [], score: [] };
  }

  /* ----- full scan ----- */
  for (let t = 0; t <= duration; t += DT) {
    video.currentTime = t;
    await new Promise(r => video.onseeked = r);

    try {
      await hands.send({ image: video });
    } catch {
      continue;
    }

    if (!window.lastLandmarks) continue;
    const lm = window.lastLandmarks;

    for (const f in FINGERS) {
      const idx = FINGERS[f];
      const mcp = angleDeg(lm[idx.mcp], lm[idx.pip], lm[idx.dip]);
      const pip = angleDeg(lm[idx.pip], lm[idx.dip], lm[idx.tip]);
      const dip = angleDeg(lm[idx.dip], lm[idx.tip], lm[idx.tip]); // 補助

      if ([mcp, pip, dip].some(v => isNaN(v))) continue;

      data[f].MCP.push(mcp);
      data[f].PIP.push(pip);
      data[f].DIP.push(dip);
      data[f].score.push(mcp + pip + dip);
    }
  }

  /* ----- compute ----- */
  for (const f in data) {

    const out = {};
    const d = data[f];

    if (d.MCP.length === 0) {
      log(`${f}: no valid frames`);
      continue;
    }

    const maxScore = Math.max(...d.score);
    const minScore = Math.min(...d.score);
    const idxExt = d.score.indexOf(maxScore);

    for (const j of ["MCP","PIP","DIP"]) {
      const arr = d[j];
      const max = Math.max(...arr);
      const min = Math.min(...arr);

      if (mode === "EXT_OK") {
        const base = arr[idxExt];
        out[j] = {
          flex: Math.max(0, base - min),
          ext:  Math.max(0, max - base)
        };
      } else { // EXT_NG
        out[j] = {
          arc: Math.max(0, max - min)
        };
      }
    }

    log(`--- ${f.toUpperCase()} ---`);

    if (mode === "EXT_OK") {
      log(`MCP: 屈曲 ${out.MCP.flex.toFixed(1)}° / 伸展 ${out.MCP.ext.toFixed(1)}°`);
      log(`PIP: 屈曲 ${out.PIP.flex.toFixed(1)}° / 伸展 ${out.PIP.ext.toFixed(1)}°`);
      log(`DIP: 屈曲 ${out.DIP.flex.toFixed(1)}° / 伸展 ${out.DIP.ext.toFixed(1)}°`);
      if (idxExt === 0 || idxExt === d.score.length - 1) {
        log(`⚠ 伸展位が十分でない可能性（参考値）`);
      }
    } else {
      log(`MCP ROM弧: ${out.MCP.arc.toFixed(1)}°`);
      log(`PIP ROM弧: ${out.PIP.arc.toFixed(1)}°`);
      log(`DIP ROM弧: ${out.DIP.arc.toFixed(1)}°`);
      log(`※伸展位未確認（拘縮・疼痛症例向け）`);
    }
  }

  log("analysis finished");
}

/* expose */
window.safeAnalyze = (mode) => analyze(mode);
