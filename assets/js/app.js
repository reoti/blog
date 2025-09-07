/* ==============================
   サウナ部 活動記録 app.js
   - 平均点のライブ表示
   - 送信で一覧テーブルへ反映
   - LocalStorage 永続化
   - 削除ボタン対応
   ============================== */

document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM参照 ----
  const form = document.getElementById("log-form");
  if (!form) {
    console.warn("フォーム #log-form が見つかりません。HTMLを確認してください。");
    return;
  }

  const avgOutput = document.getElementById("avgScore");
  const tableBody = document.querySelector("#recordsTable tbody");

  // 入力要素
  const $ = (sel) => form.querySelector(sel);
  const inpFacility = $("#facilityName");     // id="facilityName" name="facility_name"
  const inpAddress  = $("#address");          // id="address"     name="address"
  const inpPrice    = $("#price");            // id="price"       name="price"
  const inpComment  = $("#comment");          // id="comment"     name="comment"

  // 評価対象（HTMLの name と一致させる）
  const METRICS = ["bath", "sauna", "mood", "creativity", "appearance"];

  // ---- ストレージ鍵 ----
  const STORAGE_KEY = "sauna_records_v1";

  // ======================
  // ユーティリティ
  // ======================
  const round1 = (num) => (Math.round(num * 10) / 10).toFixed(1);

  const parseIntSafe = (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const nowISO = () => new Date().toISOString();

  const uid = () =>
    Math.random().toString(36).slice(2, 8) + "-" + Date.now().toString(36);

  // ======================
  // 平均の計算・表示
  // ======================
  function readRatings() {
    const values = {};
    let sum = 0;
    let count = 0;

    METRICS.forEach((name) => {
      const checked = form.querySelector(`input[name="${name}"]:checked`);
      if (checked) {
        const v = Number(checked.value);
        if (Number.isFinite(v)) {
          values[name] = v;
          sum += v;
          count += 1;
        }
      }
    });

    const avg = count > 0 ? sum / count : null;
    return { values, avg, count };
  }

  function updateAverageOutput() {
    const { avg, count } = readRatings();
    avgOutput.textContent = count > 0 ? round1(avg) : "—";
  }

  // ラジオ変更で平均をライブ更新（フォーム全体にデリゲート）
  form.addEventListener("change", (e) => {
    if (e.target.matches('input[type="radio"]')) {
      updateAverageOutput();
    }
  });

  // リセット時は平均も戻す
  form.addEventListener("reset", () => {
    // setTimeoutでリセット反映後に実行
    setTimeout(() => {
      avgOutput.textContent = "—";
    }, 0);
  });

  // 初期表示で一応更新しておく
  updateAverageOutput();

  // ======================
  // LocalStorage（保存/読込）
  // ======================
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn("ストレージ読み込み失敗:", e);
      return [];
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn("ストレージ保存失敗:", e);
    }
  }

  // ======================
  // テーブル描画
  // ======================
  function makeTd(text) {
    const td = document.createElement("td");
    td.textContent = text ?? "";
    return td;
  }

  function renderRecords(records) {
    if (!tableBody) return;

    // 既存行クリア
    tableBody.innerHTML = "";

    // 新しい順に並べる（作成日時 desc）
    const rows = [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    rows.forEach((rec) => {
      const tr = document.createElement("tr");

      tr.appendChild(makeTd(rec.facility_name));
      tr.appendChild(makeTd(rec.address ?? ""));
      tr.appendChild(makeTd(getRating(rec, "bath")));
      tr.appendChild(makeTd(getRating(rec, "sauna")));
      tr.appendChild(makeTd(getRating(rec, "mood")));
      tr.appendChild(makeTd(getRating(rec, "creativity")));
      tr.appendChild(makeTd(getRating(rec, "appearance")));
      tr.appendChild(makeTd(rec.avg != null ? round1(rec.avg) : "—"));
      tr.appendChild(makeTd(isFinite(rec.price) ? `${rec.price}` : ""));
      tr.appendChild(makeTd(rec.comment ?? ""));

      // 削除ボタン
      const tdOps = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "削除";
      delBtn.addEventListener("click", () => deleteRecord(rec.id));
      tdOps.appendChild(delBtn);
      tr.appendChild(tdOps);

      tableBody.appendChild(tr);
    });
  }

  function getRating(rec, key) {
    return rec?.ratings?.[key] ?? "";
  }

  // ======================
  // 送信処理
  // ======================
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // 必須：施設名
    const facilityName = (inpFacility?.value ?? "").trim();
    if (!facilityName) {
      alert("施設名を入力してね。");
      inpFacility?.focus();
      return;
    }

    // 評価の読み取り
    const { values: ratings, avg, count } = readRatings();
    if (count === 0) {
      // 全部未選択でもOKにするならコメントアウト
      if (!confirm("評価が未選択です。このまま保存しますか？")) {
        return;
      }
    }

    const record = {
      id: uid(),
      facility_name: facilityName,
      address: (inpAddress?.value ?? "").trim(),
      price: parseIntSafe(inpPrice?.value),
      ratings,                 // {bath: 4, sauna:5, ...}
      avg,                     // 数値 or null
      comment: (inpComment?.value ?? "").trim(),
      createdAt: nowISO(),
    };

    const records = loadRecords();
    records.push(record);
    saveRecords(records);
    renderRecords(records);

    // 送信後クリア
    form.reset();
    updateAverageOutput();

    // フォーカス戻し（連投が楽）
    inpFacility?.focus();
  });

  // ======================
  // 削除処理
  // ======================
  function deleteRecord(id) {
    const records = loadRecords();
    const next = records.filter((r) => r.id !== id);
    saveRecords(next);
    renderRecords(next);
  }

  // ======================
  // 初期描画
  // ======================
  renderRecords(loadRecords());
});
