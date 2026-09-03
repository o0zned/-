// ── 데이터 ──────────────────────────────────────
const LOCATIONS = [
  { id: 1, name: '도서관 입구',    hint: '1층 도서관 메인 문 옆 벽',   emoji: '📚', piece: '조각 1', pieceEmoji: '🌱', pieceLabel: '새싹' },
  { id: 2, name: '3학년 복도',     hint: '3-2반 교실 앞 게시판',      emoji: '🚪', piece: '조각 2', pieceEmoji: '🌿', pieceLabel: '잎사귀' },
  { id: 3, name: '학교 정원',      hint: '중앙 화단 벤치 앞',         emoji: '🌳', piece: '조각 3', pieceEmoji: '🍏', pieceLabel: '풋사과' },
  { id: 4, name: '급식실 앞',      hint: '급식실 입구 공지 보드',      emoji: '🍽️', piece: '조각 4', pieceEmoji: '🏆', pieceLabel: '완성!' },
];

// ── 미니게임 링크 매핑 ────────────────────────────
// 이제 4개 위치 전부 게임으로 연결됨 (예전엔 1,3,5만 게임이고 나머지는
// 순수 스캔 위치였는데, 게임이 4개로 늘어서 5번 위치를 없애고
// 1,2,3,4 전부 게임 launcher로 통일함).
const GAME_LINKS = {
  1: '/car/',              // 조각 1 (도서관 입구) → 풋 레이서
  2: '/yabawi.html',       // 조각 2 (3학년 복도)   → 야바위
  3: '/dodge-books.html',  // 조각 3 (학교 정원)    → 책피하기
  4: '/hidden-picture.html' // 조각 4 (급식실 앞)   → 숨은그림찾기
};

// ── 스토리지 키 ──────────────────────────────────
const KEY_COLLECTED = 'poot_collected_v1';
const KEY_CODE      = 'poot_complete_code';

function getCollected() {
  try { return JSON.parse(localStorage.getItem(KEY_COLLECTED) || '[]'); } catch { return []; }
}
function saveCollected(arr) {
  localStorage.setItem(KEY_COLLECTED, JSON.stringify(arr));
}
function getOrCreateCode() {
  let c = localStorage.getItem(KEY_CODE);
  if (!c) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    c = 'FOT-' + Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    localStorage.setItem(KEY_CODE, c);
  }
  return c;
}

// ── 퍼즐 그리드 배치 ─────────────────────────────
// 4조각 2x2 균등 배치 (예전엔 5조각용 1+2+2 비대칭 배치였음)
const LAYOUT = [
  { id:1, style:'grid-column:1; grid-row:1;' },
  { id:2, style:'grid-column:2; grid-row:1;' },
  { id:3, style:'grid-column:1; grid-row:2;' },
  { id:4, style:'grid-column:2; grid-row:2;' },
];

// ── 렌더 ─────────────────────────────────────────
function render(newlyFilledId = null) {
  const collected = getCollected();
  const grid = document.getElementById('puzzle-grid');
  const list = document.getElementById('location-list');

  // 퍼즐 그리드
  grid.innerHTML = '';
  LAYOUT.forEach(l => {
    const loc = LOCATIONS.find(x => x.id === l.id);
    const filled = collected.includes(l.id);
    const div = document.createElement('div');
    div.className = 'puzzle-piece' + (filled ? ' filled' : '') + (l.id === newlyFilledId ? ' just-filled' : '');
    div.setAttribute('style', l.style);
    div.innerHTML = `
      <div class="piece-inner">
        <span class="piece-emoji">${filled ? loc.pieceEmoji : '❓'}</span>
        <span class="piece-num">${loc.piece}</span>
        <span class="piece-label">${filled ? loc.pieceLabel : '미발견'}</span>
      </div>`;
    grid.appendChild(div);
  });

  // 위치 카드
  list.innerHTML = '';
  LOCATIONS.forEach(loc => {
    const done = collected.includes(loc.id);
    const gameLink = GAME_LINKS[loc.id]; // undefined면 게임 연결 없는 위치

    const card = document.createElement('div');
    card.className = 'location-card' + (done ? ' done' : '');

    let actionHtml;
    if (gameLink) {
      // 게임이 연결된 위치: QR스캐너 대신 바로 게임 페이지로 이동하는 링크.
      // scan-btn과 동일한 스타일이라 버튼처럼 보이지만 실제로는 <a> 태그.
      actionHtml = `<a class="scan-btn" href="${gameLink}" style="text-decoration:none;">🎮 이동</a>`;
    } else if (done) {
      actionHtml = '<button class="scan-btn scanned" disabled>완료 ✓</button>';
    } else {
      actionHtml = `<button class="scan-btn" onclick="collect(${loc.id}, event)">📷 스캔</button>`;
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

  // 프로그레스
  const cnt = collected.length;
  const total = LOCATIONS.length;
  document.getElementById('progress-text').innerHTML = `퍼즐 <strong>${cnt} / ${total}</strong>개 수집 완료`;
  document.getElementById('progress-bar').style.width = (cnt / total * 100) + '%';
  document.getElementById('count-badge').textContent = cnt + '/' + total;
}

// ── 수집 ─────────────────────────────────────────
function collect(id, e) {
  const collected = getCollected();
  if (collected.includes(id)) return;
  collected.push(id);
  saveCollected(collected);

  // 파티클
  spawnParticles(e);

  render(id);
  const loc = LOCATIONS.find(x => x.id === id);
  showToast(`🍏 ${loc.pieceLabel} 조각 획득!`);

  if (collected.length === LOCATIONS.length) {
    setTimeout(() => showComplete(), 900);
  }
}

// ── 파티클 ───────────────────────────────────────
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

// ── 완료 화면 ────────────────────────────────────
function showComplete() {
  document.getElementById('complete-code').textContent = getOrCreateCode();
  const ov = document.getElementById('complete-overlay');
  ov.classList.add('show');
  // 완료 파티클 폭발
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

// ── 토스트 ───────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── 리셋 ─────────────────────────────────────────
function resetAll() {
  localStorage.removeItem(KEY_COLLECTED);
  localStorage.removeItem(KEY_CODE);
  render();
  showToast('🔄 초기화 완료!');
}

// ── URL 파라미터로 QR 링크 처리 ─────────────────
// 실제 서비스 시: ?piece=1 형태로 QR 제작
function checkUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const piece = parseInt(params.get('piece'));
  if (piece && piece >= 1 && piece <= LOCATIONS.length) {
    const collected = getCollected();
    if (!collected.includes(piece)) {
      setTimeout(() => {
        collect(piece, null);
      }, 600);
    } else {
      showToast('이미 수집한 조각이에요!');
    }
    // URL 정리
    history.replaceState({}, '', window.location.pathname);
  }
}

// ── 초기화 ───────────────────────────────────────
render();
checkUrlParam();
