// assets/js/app.js
console.log("app.js loaded");

// ====== ストレージ（localStorage） ======
const KEY = "saunaLogs.v1";
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  },
  save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); },
  clear() { localStorage.removeItem(KEY); }
};

// ====== 公開API（後で一覧やエクスポートに使う） ======
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

// ====== ユーティリティ ======
const $ = (s) => document.querySelector(s);
const z2 = (n) => String(n).padStart(2, "0");
function nowLocalDatetimeValue() {
  const d = new Date();
  return `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}T${z2(d.getHours())}:${z2(d.getMinutes())}`;
}
function toJstIso(dtLocal) {
  // <input type="datetime-local"> の値を +09:00 付きISOへ
  if (!dtLocal) return null;
  return `${dtLocal}:00+09:00`;
}
function val(id) {
  const el = $(id.startsWith("#") ? id : `#${id}`);
  return el ? el.value.trim() : "";
}
function num(id) {
  const v = val(id);
  return v === "" ? null : Number(v);
}

// ====== フォーム結線（登録のみ） ======
document.addEventListener("DOMContentLoaded", () => {
  const dt = $("#dt");
  if (dt) dt.value = nowLocalDatetimeValue();

  const form = $("#log-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const entry = {
      when_jst: toJstIso(val("dt")),
      place: val("place"),
      location: val("location") || null,
      sets: num("sets"),
      sauna_c: num("saunaTemp"),
      water_c: num("waterTemp"),
      duration_min: num("duration"),
      rating: val("rating") || null,
      memo: val("memo") || null,
      source: "web-local-v1"
    };

    if (!entry.place || !entry.when_jst) {
      alert("日時と施設名は必須ばい！");
      return;
    }

    window.saunaLog.add(entry);

    // フォームをクリア & 日時を現在時刻に戻す
    form.reset();
    if (dt) dt.value = nowLocalDatetimeValue();

    // とりあえず通知（後で一覧に反映する）
    alert("登録したばい！");
  });
});
