// assets/js/app.js
"use strict";
console.log("app.js loaded");

// ===== localStorage（安全ラッパ） =====
const KEY = "saunaLogs.v1";
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  },
  save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); },
  clear() { localStorage.removeItem(KEY); }
};

// ===== デバッグ用の公開API =====
window.saunaLog = {
  add(entry) {
    const now = new Date();
    const rec = {
      id: `log_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2,8)}`,
      created_at: now.toISOString(),
      ...entry
    };
    const arr = store.load(); arr.push(rec); store.save(arr);
    return rec;
  },
  all: () => store.load(),
  clear: () => store.clear()
};

// ===== ユーティリティ =====
const $  = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const z2 = (n) => String(n).padStart(2,"0");

function nowLocalDatetimeValue() {
  const d = new Date();
  return `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}T${z2(d.getHours())}:${z2(d.getMinutes())}`;
}
function toJstIso(dtLocal) { return dtLocal ? `${dtLocal}:00+09:00` : null; }
function val(id){ const el = $(id.startsWith("#")? id : `#${id}`); return el ? el.value.trim() : ""; }
function num(id){ const v = val(id); return v === "" ? null : Number(v); }

function getStar(name){
  const el = $(`input[name="${name}"]:checked`);
  return el ? Number(el.value) : null;
}

// 平均（★が入ってる項目だけで平均）
function computeAvg(){
  const arr = ["bath","sauna","mood","creative","look"]
    .map(getStar)
    .filter(v => v != null);
  if (!arr.length) return null;
  const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
  return Math.round(avg * 10) / 10; // 小数1位
}
function setAvg(avg){
  const out = $("#scoreAvg");
  if (!out) return;
  const txt = (avg == null) ? "—" : avg.toFixed(1);
  out.textContent = txt;
  try { out.value = txt; } catch {}
}
function updateAvgView(){ setAvg(computeAvg()); }

function showMsg(text, kind="ok"){
  const el = $("#msg"); if (!el) return;
  el.textContent = text;
  el.style.color = kind === "ok" ? "#0a0" : "#c00";
  el.style.margin = "8px 0 0";
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(()=>{ el.textContent = ""; }, 2000);
}

// ===== 起動時の結線 =====
document.addEventListener("DOMContentLoaded", () => {
  // 日時初期値
  const dt = $("#dt");
  if (dt) dt.value = nowLocalDatetimeValue();

  // ★変更で平均再計算（確実に個別バインド）
  $$('.stars input[type="radio"]').forEach(el => {
    el.addEventListener('change', updateAvgView);
  });
  updateAvgView(); // 初期表示

  // 送信
  const form = $("#log-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const entry = {
      when_jst: toJstIso(val("dt")),
      place:    val("place"),
      address:  val("address") || null,
      location: val("location") || null,   // 使ってなければnullのままでOK
      price_yen: num("price"),

      // 星評価（1〜5）
      bath: getStar("bath"),
      sauna: getStar("sauna"),
      mood: getStar("mood"),
      creative: getStar("creative"),
      look: getStar("look"),
      score_avg: computeAvg(),

      // 既存の温度・滞在系（任意）
      sauna_c: num("saunaTemp"),
      water_c: num("waterTemp"),
      duration_min: num("duration"),

      // 感想
      comment: val("comment") || val("memo") || null,

      source: "web-local-v1"
    };

    // 必須チェック
    if (!entry.when_jst || !entry.place){
      showMsg("日時と施設名は必須ばい！", "ng");
      return;
    }

    // ざっくりバリデーション
    if (entry.sauna_c != null && (entry.sauna_c < 40 || entry.sauna_c > 130)) {
      showMsg("サウナ温度は 40〜130℃ くらいでお願い〜", "ng"); return;
    }
    if (entry.water_c != null && (entry.water_c < 0 || entry.water_c > 40)) {
      showMsg("水風呂は 0〜40℃ くらいでお願い〜", "ng"); return;
    }
    if (entry.price_yen != null && entry.price_yen < 0) {
      showMsg("料金は 0 円以上で頼むばい", "ng"); return;
    }

    window.saunaLog.add(entry);

    form.reset();
    if (dt) dt.value = nowLocalDatetimeValue();
    updateAvgView();
    showMsg("登録成功　最高！");
  });
});
