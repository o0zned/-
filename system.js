const LOCATIONS = [
  { id: 1, name: '도서관',    hint: '풋활동한다',      emoji: '📚', piece: '첫 번째 조각', pieceEmoji: '🏎️', pieceLabel: '미래 F1 드라이버',   stampImg: '/assets/puzzle/stamp1.png' },
  { id: 2, name: '창의융합실',     hint: '쏘놀이들활동한다',      emoji: '👾', piece: '두 번째 조각', pieceEmoji: '🥤', pieceLabel: '속임수의 달인', stampImg: '/assets/puzzle/stamp2.png' },
  { id: 3, name: '중앙현관',      hint: '해랑본관의꽃',         emoji: '🚪', piece: '세 번째 조각', pieceEmoji: '📚', pieceLabel: '책 많이 읽자', stampImg: '/assets/puzzle/stamp3.png' },
  { id: 4, name: '가사실',      hint: '배고프지않나요',      emoji: '🍳', piece: '네 번째 조각', pieceEmoji: '🧩', pieceLabel: '끝!',  stampImg: '/assets/puzzle/stamp4.png' },
];

const GAME_LINKS = {
  1: '/car/',
  2: '/yabawi.html',
  3: '/dodge-books.html',
  4: '/hidden-picture.html'
};

const KEY_COLLECTED = 'poot_collected_v1';
const KEY_CODE      = 'poot_complete_code';

const memoryStore = {};
function storageGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? (memoryStore[key] ?? null) : v;
  } catch (e) {
    return memoryStore[key] ?? null;
  }
}
function storageSet(key, value) {
  memoryStore[key] = value;
  try { localStorage.setItem(key, value); } catch (e) {}
}
function storageRemove(key) {
  delete memoryStore[key];
  try { localStorage.removeItem(key); } catch (e) {}
}

function getCollected() {
  try {
    const arr = JSON.parse(storageGet(KEY_COLLECTED) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(id => LOCATIONS.some(l => l.id === id));
  } catch (e) {
    return [];
  }
}
function saveCollected(arr) {
  storageSet(KEY_COLLECTED, JSON.stringify(arr));
}

const COUNTER_NAMESPACE = 'hrsxnlxbook-poot-puzzle-2026';
const COUNTER_KEY = 'complete-code';

async function fetchNextNumber() {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 5000);
  try {
    const res = await fetch(
      `https://abacus.jasoncameron.dev/hit/${COUNTER_NAMESPACE}/${COUNTER_KEY}`,
      ctrl ? { signal: ctrl.signal } : undefined
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data && Number.isInteger(data.value) && data.value > 0 ? data.value : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let codePromise = null;
function getOrCreateCode() {
  const saved = storageGet(KEY_CODE);
  if (saved) return Promise.resolve(saved);
  if (!codePromise) {
    codePromise = (async () => {
      const n = await fetchNextNumber();
      const c = n !== null ? String(n) : String(Math.floor(1000 + Math.random() * 9000));
      storageSet(KEY_CODE, c);
      return c;
    })().finally(() => { codePromise = null; });
  }
  return codePromise;
}

const LAYOUT = [
  { id:1, style:'grid-column:1; grid-row:1;' },
  { id:2, style:'grid-column:2; grid-row:1;' },
  { id:3, style:'grid-column:1; grid-row:2;' },
  { id:4, style:'grid-column:2; grid-row:2;' },
];

function render(newlyFilledId = null) {
  const collected = getCollected();
  const grid = document.getElementById('puzzle-grid');
  const list = document.getElementById('location-list');

  grid.innerHTML = '';
  LAYOUT.forEach(l => {
    const loc = LOCATIONS.find(x => x.id === l.id);
    const filled = collected.includes(l.id);
    const div = document.createElement('div');
    div.className = 'puzzle-piece' + (filled ? ' filled' : '') + (l.id === newlyFilledId ? ' just-filled' : '');
    div.setAttribute('style', l.style);
    div.innerHTML = `
      <div class="piece-inner">
        ${filled
          ? `<img class="piece-stamp" src="${loc.stampImg}" alt="${loc.pieceLabel}">`
          : `<span class="piece-emoji">❓</span>`}
        <span class="piece-num">${loc.piece}</span>
        <span class="piece-label">${filled ? loc.pieceLabel : '미발견'}</span>
      </div>`;
    grid.appendChild(div);
  });

  list.innerHTML = '';
  LOCATIONS.forEach(loc => {
    const done = collected.includes(loc.id);

    const card = document.createElement('div');
    card.className = 'location-card' + (done ? ' done' : '');

    let actionHtml;
    if (done) {
      actionHtml = '<button class="scan-btn scanned" disabled>완료 ✓</button>';
    } else {
      actionHtml = `<a class="scan-btn" href="/qr-scan.html" style="text-decoration:none;">📷 스캔</a>`;
    }

    card.innerHTML = `
      <div class="loc-icon">${loc.emoji}</div>
      <div class="loc-info">
        <h4>${loc.name}</h4>
        <p>${done ? '✅ 수집 완료' : loc.hint}</p>
      </div>
      <span class="loc-piece-badge">${loc.piece}</span>
      ${actionHtml}`;
    list.appendChild(card);
  });

  const cnt = collected.length;
  const total = LOCATIONS.length;
  document.getElementById('progress-text').innerHTML = `퍼즐 <strong>${cnt} / ${total}</strong>개 수집 완료`;
  document.getElementById('progress-bar').style.width = (cnt / total * 100) + '%';
  document.getElementById('count-badge').textContent = cnt + '/' + total;

  const codeAgain = document.getElementById('code-again');
  if (codeAgain) codeAgain.hidden = cnt < total;
}

function collect(id, e) {
  const collected = getCollected();
  if (collected.includes(id)) return;
  collected.push(id);
  saveCollected(collected);

  spawnParticles(e);

  render(id);
  const loc = LOCATIONS.find(x => x.id === id);
  showToast(`🍏 ${loc.pieceLabel} 조각 획득!`);

  if (collected.length === LOCATIONS.length) {
    setTimeout(() => showComplete(), 900);
  }
}

function spawnParticles(e) {
  const emojis = ['🍏','✨','🌿','⭐','💚'];
  const x = e?.clientX ?? window.innerWidth/2;
  const y = e?.clientY ?? window.innerHeight/2;
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    const angle = (Math.PI * 2 / 8) * i + (Math.random()-0.5)*0.5;
    const dist = 80 + Math.random()*60;
    p.style.cssText = `left:${x}px;top:${y}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist - 40}px;--tr:${(Math.random()-0.5)*360}deg;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}

async function showComplete() {
  const codeEl = document.getElementById('complete-code');
  codeEl.textContent = '...';
  const ov = document.getElementById('complete-overlay');
  ov.classList.add('show');
  try {
    codeEl.textContent = await getOrCreateCode();
  } catch (e) {
    codeEl.textContent = String(Math.floor(1000 + Math.random() * 9000));
  }

  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const emojis = ['🎉','🍏','🌟','💚','🎊','✨'];
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = emojis[Math.floor(Math.random()*emojis.length)];
      p.style.cssText = `left:${Math.random()*window.innerWidth}px;top:${Math.random()*window.innerHeight*0.6}px;--tx:${(Math.random()-0.5)*120}px;--ty:${Math.random()*-200+50}px;--tr:${(Math.random()-0.5)*720}deg;font-size:${14+Math.random()*20}px;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }, i * 60);
  }
}
function closeComplete() {
  document.getElementById('complete-overlay').classList.remove('show');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function resetAll() {
  storageRemove(KEY_COLLECTED);
  storageRemove(KEY_CODE);
  closeComplete();
  render();
  showToast('🔄 초기화 완료!');
}

function checkUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const piece = parseInt(params.get('piece'), 10);
  if (Number.isInteger(piece) && LOCATIONS.some(l => l.id === piece)) {
    const collected = getCollected();
    if (!collected.includes(piece)) {
      setTimeout(() => {
        collect(piece, null);
      }, 600);
    } else {
      showToast('이미 수집한 조각이에요!');
    }

    history.replaceState({}, '', window.location.pathname);
  }
}

render();
checkUrlParam();
