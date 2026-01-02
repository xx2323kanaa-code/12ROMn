/* =====================================================
   Hand ROM Analyzer
   FULL REPLACEMENT analyze.js
   ROM : 12ROMn
   VER : v1.3.0-romfix
   BUILD : 2026-01-02
===================================================== */

log("Analyze.js loaded : 12ROMn v1.3.0-romfix");
log("BUILD 2026-01-02");

const ANALYZE_VERSION = "v1.3.0-romfix";

/* ---------- Utility ---------- */

function vec(a, b){
  return { x:b.x-a.x, y:b.y-a.y, z:(b.z??0)-(a.z??0) };
}
function dot(v1, v2){
  return v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
}
function mag(v){
  return Math.sqrt(dot(v,v));
}

/* raw angle (0–180) */
function angleDeg(a, b, c){
  const v1 = vec(b,a);
  const v2 = vec(b,c);
  const m1 = mag(v1), m2 = mag(v2);
  if(m1===0 || m2===0) return NaN;
  let cos = dot(v1,v2)/(m1*m2);
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos)*180/Math.PI;
}

/* ROM definition
   - extension ≈ 0
   - flexion   ≈ positive
*/
function jointROM(a,b,c){
  const raw = angleDeg(a,b,c);
  if(isNaN(raw)) return NaN;
  return 180 - raw;
}

/* ---------- Index map ---------- */

const IDX = {
  thumb:{
    mcp:2, pip:3, dip:4, tip:4
  },
  index:{
    mcp:5, pip:6, dip:7, tip:8
  },
  middle:{
    mcp:9, pip:10, dip:11, tip:12
  },
  ring:{
    mcp:13, pip:14, dip:15, tip:16
  },
  pinky:{
    mcp:17, pip:18, dip:19, tip:20
  }
};

/* ---------- Safe entry ---------- */

function safeAnalyze(mode){
  log("--------------------------------------------------");
  analyze(mode);
}

/* ---------- Main ---------- */

function analyze(mode){
  log("analyze() start");
  log(`MODE = ${mode}`);
  log(`ROM = 12ROMn  VER = ${ANALYZE_VERSION}`);

  if(!window.video || !window.hands){
    log("ERROR: video / hands not ready");
    return;
  }

  const group = window.selectedGroup || "pinky";
  const fingerSet =
    (group==="thumb")
      ? ["index","middle"]
      : ["ring","pinky"];

  const results = [];
  let seekT = 0;
  const SEEK_STEP = 0.5;

  video.currentTime = 0;

  function step(){
    if(seekT > video.duration){
      finish();
      return;
    }

    video.currentTime = seekT;
    seekT += SEEK_STEP;

    setTimeout(()=>{
      if(!window.lastLandmarks){
        log("No landmarks");
        step();
        return;
      }

      const lm = window.lastLandmarks;

      fingerSet.forEach(f=>{
        const i = IDX[f];
        if(!i) return;

        const mcp = jointROM(lm[i.mcp], lm[i.pip], lm[i.dip]);
        const pip = jointROM(lm[i.pip], lm[i.dip], lm[i.tip]);
        const dip = jointROM(lm[i.pip], lm[i.dip], lm[i.tip]); // ← FIXED

        if(
          [mcp,pip,dip].some(v=>isNaN(v))
        ) return;

        const score = mcp + pip + dip;

        results.push({
          finger:f,
          mcp, pip, dip,
          score
        });
      });

      step();
    },120);
  }

  function finish(){
    if(results.length===0){
      log("No valid frames");
      return;
    }

    const byFinger = {};
    results.forEach(r=>{
      if(!byFinger[r.finger]) byFinger[r.finger]=[];
      byFinger[r.finger].push(r);
    });

    let out = "";
    Object.keys(byFinger).forEach(f=>{
      const arr = byFinger[f];

      let flex, ext;

      if(mode==="EXT_OK"){
        ext = arr.reduce((a,b)=>a.score<b.score?a:b);
      }else{
        ext = arr[0];
      }
      flex = arr.reduce((a,b)=>a.score>b.score?a:b);

      out += `\n${f}\n`;
      out += `MCP：屈曲 ${flex.mcp.toFixed(1)}° / 伸展 ${ext.mcp.toFixed(1)}°\n`;
      out += `PIP：屈曲 ${flex.pip.toFixed(1)}° / 伸展 ${ext.pip.toFixed(1)}°\n`;
      out += `DIP：屈曲 ${flex.dip.toFixed(1)}° / 伸展 ${ext.dip.toFixed(1)}°\n`;
    });

    document.getElementById("result").innerText = out;
    log("analysis finished");
  }

  step();
}
