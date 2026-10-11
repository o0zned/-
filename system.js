// ── 데이터 ──────────────────────────────────────
const LOCATIONS = [
  { id: 1, name: '도서관',    hint: '풋활동한다',      emoji: '📚', piece: '첫 번째 조각', pieceEmoji: '🏎️', pieceLabel: '미래의 F1 드라이버',   stampImg: '/assets/puzzle/stamp1.png' },
  { id: 2, name: '창의융합실',     hint: '쏘놀이들활동한다',      emoji: '👾', piece: '두 번째 조각', pieceEmoji: '🥤', pieceLabel: '속임수의 달인', stampImg: '/assets/puzzle/stamp2.png' },
  { id: 3, name: '중앙현관',      hint: '해랑본관의꽃',         emoji: '🚪', piece: '세 번째 조각', pieceEmoji: '📚', pieceLabel: '책 많이 읽으면 안 잡아먹지', stampImg: '/assets/puzzle/stamp3.png' },
  { id: 4, name: '가사실',      hint: '배고프지않나요',      emoji: '🍳', piece: '네 번째 조각', pieceEmoji: '🧩', pieceLabel: '코드 오타도 잘 찾으시겠네요',  stampImg: '/assets/puzzle/stamp4.png' },
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
// 완료 순서대로 1, 2, 3, 4... 발급되는 번호.
// 정적 사이트라 서버 DB가 없어서, 모두의 기기가 같은 숫자를 함께 올리는
// 공용 카운터를 하나 둬서 거기서 "다음 번호"를 받아온다.
// (원래 쓰던 CountAPI(api.countapi.xyz)는 서비스가 죽어서 매번 실패하고
// 있었음 — 같은 방식의 대체 서비스(abacus, jasoncameron.dev)로 교체함.
// 이것도 네트워크가 막혀있거나 다운됐을 때를 대비해, 실패하면 그냥 랜덤
// 4자리 숫자로 대신 발급한다(이 경우는 순서가 보장되지 않음 — 드문
// 경우라 큰 문제는 안 됨).
const COUNTER_NAMESPACE = 'hrsxnlxbook-poot-puzzle-2026';
const COUNTER_KEY = 'complete-code';

async function getOrCreateCode() {
  let c = localStorage.getItem(KEY_CODE);
  if (c) return c;

  try {
    const res = await fetch(`https://abacus.jasoncameron.dev/hit/${COUNTER_NAMESPACE}/${COUNTER_KEY}`);
    const data = await res.json();
    if (data && typeof data.value === 'number') {
      c = String(data.value);
    }
  } catch (e) {
    // 네트워크 실패 — 아래 폴백으로 넘어감
  }

  if (!c) {
    c = String(Math.floor(1000 + Math.random() * 9000)); // 폴백: 랜덤 4자리
  }
  localStorage.setItem(KEY_CODE, c);
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
        ${filled
          ? `<img class="piece-stamp" src="${loc.stampImg}" alt="${loc.pieceLabel}">`
          : `<span class="piece-emoji">❓</span>`}
        <span class="piece-num">${loc.piece}</span>
        <span class="piece-label">${filled ? loc.pieceLabel : '미발견'}</span>
      </div>`;
    grid.appendChild(div);
  });

  // 위치 카드
  list.innerHTML = '';
  LOCATIONS.forEach(loc => {
    const done = collected.includes(loc.id);

    const card = document.createElement('div');
    card.className = 'location-card' + (done ? ' done' : '');

    // 실제 운영용 — 데모용 바로가기 링크/가짜 스캔 버튼 제거.
    // 현장에 붙은 진짜 QR코드를 카메라로 스캔해야만 게임으로 이동하고,
    // 피스는 게임을 클리어했을 때(?piece=N 리다이렉트)만 수집됨.
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
async function showComplete() {
  const codeEl = document.getElementById('complete-code');
  codeEl.textContent = '...'; // 번호 받아오는 동안 잠깐 표시
  const ov = document.getElementById('complete-overlay');
  ov.classList.add('show');
  codeEl.textContent = await getOrCreateCode();
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
