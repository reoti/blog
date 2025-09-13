/* ==== サウナ部 活動記録（写真対応） ==== */

const STORAGE_KEY = 'sauna_records_v2'; // 画像対応の新キー
const IMG_MAX_W   = 1280;
const IMG_MAX_H   = 1280;
const IMG_QUALITY = 0.8; // JPEG品質

// DOM
const form          = document.getElementById('log-form');
const facilityInput = document.getElementById('facilityName');
const addressInput  = document.getElementById('address');
const priceInput    = document.getElementById('price');
const commentInput  = document.getElementById('comment');
const avgOutput     = document.getElementById('avgScore');
const tableBody     = document.querySelector('#recordsTable tbody');

const photoInput    = document.getElementById('photo');
const photoPreview  = document.getElementById('photoPreview');

const imgModal = document.getElementById('imgModal');
const modalImg = document.getElementById('modalImg');

// 評価ラジオの名前一覧
const RATE_FIELDS = ['bath', 'sauna', 'mood', 'creativity', 'appearance'];

/* ===== 画像プレビュー ===== */
photoInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) {
    photoPreview.style.display = 'none';
    photoPreview.src = '';
    delete photoPreview.dataset.dataUrl;
    return;
  }
  try {
    const dataUrl = await fileToDataURL(file, IMG_MAX_W, IMG_MAX_H, IMG_QUALITY);
    photoPreview.src = dataUrl;
    photoPreview.style.display = 'block';
    photoPreview.dataset.dataUrl = dataUrl;
  } catch (err) {
    console.error(err);
    alert('画像の読み込みに失敗しました。HEICの場合は設定変更や別アプリでJPEGに変換してみてください。');
  }
});

/* ===== 平均スコアの自動計算 ===== */
RATE_FIELDS.forEach(name => {
  document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
    radio.addEventListener('change', updateAverage);
  });
});
function updateAverage() {
  const values = RATE_FIELDS.map(name => {
    const v = document.querySelector(`input[name="${name}"]:checked`)?.value;
    return v ? Number(v) : null;
  }).filter(v => v != null);

  if (values.length === 0) {
    avgOutput.textContent = '—';
    return;
  }
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  avgOutput.textContent = avg.toFixed(2);
}

/* ===== フォーム送信（保存） ===== */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const facility = facilityInput.value.trim();
  if (!facility) {
    alert('施設名を入力してください');
    return;
  }

  // 評価値を取得（未選択は0）
  const scores = {};
  RATE_FIELDS.forEach(name => {
    scores[name] = Number(document.querySelector(`input[name="${name}"]:checked`)?.value || 0);
  });

  const avg =
    (scores.bath + scores.sauna + scores.mood + scores.creativity + scores.appearance) / RATE_FIELDS.length;

  // 画像（プレビュー済みDataURLがあればそれを使用）
  const photoDataUrl = photoPreview.dataset.dataUrl || null;

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    facility: facility,
    address: addressInput.value.trim(),
    price: priceInput.value ? Number(priceInput.value) : null,
    comment: commentInput.value.trim(),
    ...scores,
    avg: Number.isFinite(avg) ? Number(avg.toFixed(2)) : null,
    photo: photoDataUrl
  };

  const list = loadRecords();
  list.unshift(entry);
  saveRecords(list);

  form.reset();
  avgOutput.textContent = '—';
  photoPreview.style.display = 'none';
  photoPreview.src = '';
  delete photoPreview.dataset.dataUrl;

  renderTable();
  alert('保存しました');
});

/* ===== 記録一覧レンダリング ===== */
function renderTable() {
  const list = loadRecords();
  tableBody.innerHTML = '';

  if (list.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 12;
    td.textContent = 'まだ記録がありません。';
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  list.forEach(entry => {
    const tr = document.createElement('tr');

    // 写真サムネ
    const tdPhoto = document.createElement('td');
    if (entry.photo) {
      const img = document.createElement('img');
      img.src = entry.photo;
      img.alt = `${entry.facility} の写真`;
      img.className = 'thumb';
      img.addEventListener('click', () => openModal(entry.photo));
      tdPhoto.appendChild(img);
    } else {
      tdPhoto.textContent = '—';
    }
    tr.appendChild(tdPhoto);

    // 施設名
    tr.appendChild(tdText(entry.facility || ''));
    // 住所
    tr.appendChild(tdText(entry.address || ''));
    // スコア
    tr.appendChild(tdText(nz(entry.bath)));
    tr.appendChild(tdText(nz(entry.sauna)));
    tr.appendChild(tdText(nz(entry.mood)));
    tr.appendChild(tdText(nz(entry.creativity)));
    tr.appendChild(tdText(nz(entry.appearance)));
    // 平均
    tr.appendChild(tdText(entry.avg != null ? entry.avg.toFixed(2) : '—'));
    // 料金
    tr.appendChild(tdText(entry.price != null ? entry.price.toString() : '—'));
    // 感想（長文は少し短縮）
    tr.appendChild(tdText(shorten(entry.comment || '', 80)));

    // 操作
    const tdOps = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      if (confirm('この記録を削除しますか？')) {
        removeRecord(entry.id);
      }
    });
    tdOps.appendChild(delBtn);
    tr.appendChild(tdOps);

    tableBody.appendChild(tr);
  });
}

function tdText(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}
function shorten(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function nz(v) {
  return (v != null && v !== 0) ? String(v) : '—';
}

/* ===== モーダル ===== */
function openModal(src) {
  modalImg.src = src;
  imgModal.setAttribute('aria-hidden', 'false');
}
imgModal.addEventListener('click', (ev) => {
  if (ev.target.hasAttribute('data-close')) {
    imgModal.setAttribute('aria-hidden', 'true');
    modalImg.src = '';
  }
});

/* ===== ストレージ ===== */
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveRecords(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function removeRecord(id) {
  const list = loadRecords().filter(e => e.id !== id);
  saveRecords(list);
  renderTable();
}

/* ===== 画像ユーティリティ（圧縮してDataURLに） ===== */
function fileToDataURL(file, maxW = 1280, maxH = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const { canvas, ctx, w, h } = fitToCanvas(img, maxW, maxH);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}
function fitToCanvas(img, maxW, maxH) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(maxW / w, maxH / h, 1);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  canvas.width = w;
  canvas.height = h;

  // 透明対策（PNG→JPEGで白背景）
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  return { canvas, ctx, w, h };
}

/* 初期描画 */
renderTable();
updateAverage();
/* ==== 粒子（湯気/泡）背景 ==== */
(function(){
  const cv = document.getElementById('bg-canvas');
  if(!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = cv.getContext('2d', { alpha:true });
  let w=0, h=0, dpr=1, rafId=null;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth = window.innerWidth;
    h = cv.clientHeight = window.innerHeight;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize, { passive:true });
  resize();

  // 粒子を“湯気/泡”っぽく
  const COUNT = Math.round(Math.min(100, (w*h)/25000)); // 画面に応じて自動調整
  const particles = Array.from({length: COUNT}, () => spawn());

  function spawn(){
    const r = rand(2, 6);
    return {
      x: Math.random()*w,
      y: h + rand(0, h*0.4),
      r,
      vx: rand(-0.15, 0.15),
      vy: rand(-0.55, -0.25),   // 上昇
      alpha: rand(0.3, 0.85),
      drift: rand(-0.003, 0.003),
    };
  }
  function rand(a,b){ return a + Math.random()*(b-a); }

  function step(){
    ctx.clearRect(0,0,w,h);

    // ふわっとした円（グラデで湯気感）
    for(const p of particles){
      p.x += p.vx + Math.sin(p.y*0.01)*p.drift;
      p.y += p.vy;
      p.alpha *= 0.999; // 徐々に薄く

      // 再出現
      if(p.y < -20 || p.alpha < 0.12){
        Object.assign(p, spawn(), { y: h+20 });
      }

      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r*3);
      grd.addColorStop(0, `rgba(255,255,255,${0.20*p.alpha})`);
      grd.addColorStop(1, `rgba(255,255,255,0)`);

      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r*3, 0, Math.PI*2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(step);
  }
  step();

  // ページ非表示で休止（バッテリー配慮）
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ cancelAnimationFrame(rafId); }
    else { step(); }
  });
})();
