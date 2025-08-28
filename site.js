// Bowlliards: 10 frames; 2 rolls per frame (first 9); 10th may have bonus.
// Scoring matches bowling: strike adds next two rolls; spare adds next roll.

const STORAGE_KEY = 'bowlliards.games.v1';

// --- State ---
let game = freshGame();
let active = { frame: 0, roll: 0 }; // roll: 0,1,2 (2 only in 10th)

function freshGame() {
  return {
    date: todayISO(),
    frames: Array.from({ length: 10 }, () => ({ r1: null, r2: null, r3: null, cumul: 0 })),
    total: 0
  };
}

function todayISO() {
  const d = new Date(), off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// --- Helpers ---
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

// Build mini boxes inside frame cells
function buildFrames() {
  $$('.frame').forEach((cell) => {
    const idx = +cell.dataset.frame;
    cell.innerHTML = '';
    const count = idx === 9 ? 3 : 2;
    for (let r = 0; r < count; r++) {
      const mini = document.createElement('div');
      mini.className = 'mini';
      mini.dataset.frame = idx;
      mini.dataset.roll = r;
      mini.addEventListener('click', () => { active.frame = idx; active.roll = r; render(); });
      cell.appendChild(mini);
    }
  });
}

// --- Scoring ---
function allRolls() {
  const rolls = [];
  for (let f = 0; f < 9; f++) {
    const { r1, r2 } = game.frames[f];
    if (r1 == null) break;
    if (r1 === 10) rolls.push(10);
    else { rolls.push(r1); if (r2 != null) rolls.push(r2); }
  }
  // 10th
  const F = game.frames[9];
  if (F.r1 != null) {
    rolls.push(F.r1);
    if (F.r2 != null) rolls.push(F.r2);
    if (F.r3 != null) rolls.push(F.r3);
  }
  return rolls;
}

function computeScores() {
  const rolls = allRolls();
  let i = 0, cumul = 0;
  for (let f = 0; f < 10; f++) {
    if (i >= rolls.length) { game.frames[f].cumul = cumul; continue; }
    let frameScore = 0;
    const r1 = rolls[i];
    if (f < 9) {
      if (r1 === 10) {                    // strike
        frameScore = 10 + (rolls[i+1] || 0) + (rolls[i+2] || 0);
        i += 1;
      } else {
        const r2 = rolls[i+1] || 0;
        const sum = r1 + r2;
        frameScore = (sum === 10) ? 10 + (rolls[i+2] || 0) : sum;
        i += 2;
      }
    } else {
      const r2 = rolls[i+1] || 0, r3 = rolls[i+2] || 0;
      frameScore = r1 + r2 + r3;
      i = rolls.length;
    }
    cumul += frameScore;
    game.frames[f].cumul = cumul;
  }
  game.total = cumul;
}

// --- Rendering ---
function markSymbol(fr, idx, frameIndex) {
  const val = idx === 0 ? fr.r1 : idx === 1 ? fr.r2 : fr.r3;
  if (val == null) return '';
  if (frameIndex < 9) {
    if (idx === 0 && val === 10) return 'X';
    if (idx === 1 && (fr.r1 || 0) + (fr.r2 || 0) === 10) return '/';
    return String(val);
  } else {
    // 10th frame symbols
    if (idx === 0) return val === 10 ? 'X' : String(val);
    if (idx === 1) {
      if (fr.r1 === 10) return val === 10 ? 'X' : String(val);
      return (fr.r1 || 0) + (fr.r2 || 0) === 10 ? '/' : String(val);
    }
    // idx === 2
    if (fr.r1 === 10) {
      if (fr.r2 === 10) return val === 10 ? 'X' : String(val);
      return (fr.r2 || 0) + (fr.r3 || 0) === 10 ? '/' : String(val);
    } else {
      return (fr.r1 || 0) + (fr.r2 || 0) === 10 ? (val === 10 ? 'X' : String(val)) : '';
    }
  }
}

function render() {
  $('#gameDate').value = game.date;

  computeScores();
  $('#grandTotal').textContent = game.total;
  for (let i = 0; i < 10; i++) $('#cum' + i).textContent = game.frames[i].cumul;

  $$('.frame').forEach(cell => {
    const fIdx = +cell.dataset.frame;
    const minis = $$('.mini', cell);
    const fr = game.frames[fIdx];
    minis.forEach((m, i) => {
      m.textContent = markSymbol(fr, i, fIdx);
      m.classList.toggle('selected', active.frame === fIdx && active.roll === i);
      // enable r3 in 10th only when earned
      if (fIdx === 9 && i === 2) {
        const eligible = fr.r1 === 10 || ((fr.r1 || 0) + (fr.r2 || 0) === 10);
        m.classList.toggle('disabled', !eligible);
      } else {
        m.classList.remove('disabled');
      }
    });
  });
}

// --- Input constraints & actions ---
function maxFor(frameIndex, rollIndex) {
  const fr = game.frames[frameIndex];
  if (frameIndex < 9) {
    if (rollIndex === 0) return 10;
    return Math.max(0, 10 - (fr.r1 || 0));
  } else {
    if (rollIndex === 0) return 10;
    if (rollIndex === 1) return (fr.r1 === 10) ? 10 : Math.max(0, 10 - (fr.r1 || 0));
    // rollIndex === 2
    if (fr.r1 === 10) return (fr.r2 === 10) ? 10 : Math.max(0, 10 - (fr.r2 || 0));
    return ((fr.r1 || 0) + (fr.r2 || 0) === 10) ? 10 : 0;
  }
}

function setValue(value) {
  const f = active.frame, r = active.roll, fr = game.frames[f];

  // Clear
  if (value === 'CLR') {
    if (r === 0) fr.r1 = null;
    if (r === 1) fr.r2 = null;
    if (r === 2) fr.r3 = null;
    computeScores(); render();
    return;
  }

  // Convert symbols
  if (value === 'X') value = 10;
  if (value === '/') {
    if (f < 9 && r === 1 && fr.r1 != null && fr.r1 < 10) {
      fr.r2 = 10 - fr.r1;
    } else if (f === 9) {
      if (r === 1 && fr.r1 != null && fr.r1 < 10) {
        fr.r2 = 10 - fr.r1;
      } else if (r === 2 && fr.r1 === 10 && fr.r2 != null && fr.r2 < 10) {
        fr.r3 = 10 - fr.r2;
      }
    }
    computeScores(); render();
    autoAdvance();
    return;
  }

  // Numeric
  const n = Number(value);
  if (Number.isNaN(n)) return;

  const max = maxFor(f, r);
  const clamped = Math.min(Math.max(0, n), max);
  if (r === 0) {
    fr.r1 = clamped;
    if (f < 9 && clamped === 10) fr.r2 = null; // strike clears 2nd in frames 1–9
  } else if (r === 1) {
    fr.r2 = clamped;
  } else {
    fr.r3 = clamped;
  }

  computeScores(); render();
  autoAdvance();
}

function autoAdvance() {
  let f = active.frame, r = active.roll, fr = game.frames[f];
  if (f < 9) {
    if (r === 0) {
      if ((fr.r1 || 0) === 10) { active = { frame: f + 1, roll: 0 }; }
      else active = { frame: f, roll: 1 };
    } else {
      active = { frame: f + 1, roll: 0 };
    }
  } else {
    // 10th
    if (r === 0) active = { frame: f, roll: 1 };
    else if (r === 1) {
      const earnR3 = fr.r1 === 10 || ((fr.r1 || 0) + (fr.r2 || 0) === 10);
      active = { frame: f, roll: earnR3 ? 2 : 1 };
    } else {
      active = { frame: f, roll: 2 };
    }
  }
  render();
}

// --- Keypad wiring ---
$('#keypad').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-k]');
  if (!b) return;
  setValue(b.dataset.k);
});

// --- Add another game (saves current then resets) ---
$('#btnAddGame').addEventListener('click', () => {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  list.unshift(JSON.parse(JSON.stringify(game)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  game = freshGame();
  active = { frame: 0, roll: 0 };
  $('#gameDate').value = game.date;
  render();
});

// --- Init ---
window.addEventListener('DOMContentLoaded', () => {
  $('#gameDate').value = game.date;
  buildFrames();
  render();
});
