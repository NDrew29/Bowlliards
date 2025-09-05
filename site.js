/* Shared JS for: Home, Bowlliards, Ghost 9-Ball, RDS */

const $  = (q,root=document)=>root.querySelector(q);
const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));
const todayISO = ()=>{const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10);};

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'bowlliards') initBowlliards();
  else if (page === 'ghost9') initGhost();
  else if (page === 'rds') initRDS();
  else initHome();
});

/* ========= Home ========= */
function initHome(){ /* links only */ }

/* ========= Bowlliards ========= */
/* (Use your latest working Bowlliards implementation here – unchanged) */
/* ... (bowlliards code from earlier message remains exactly the same) ... */

/* ========= Ghost 9-Ball ========= */
/* (Use your latest working Ghost 9-Ball implementation here – unchanged) */
/* ... (ghost code from earlier message remains exactly the same) ... */

/* ========= RDS – Runout Drill System ========= */
function initRDS(){
  const LS_HISTORY = 'rds.sessions.v1';

  // Level descriptions & ratings (summary from BU Exam IV – RDS)
  // Rating label per level (concise)
  const levelInfo = {
    1:  { desc: 'Optional: 6 balls, pocket OBs directly with no cue ball.',      rating:'lower novice' },
    2:  { desc: '6 balls, any order, BIH on every shot.',                        rating:'mid novice' },
    3:  { desc: '6 balls, any order, 3 extra BIHs.',                             rating:'upper novice' },
    4:  { desc: '6 balls, any order, 2 extra BIHs.',                             rating:'lower beginner (D-)' },
    5:  { desc: '6 balls, any order, 1 extra BIH.',                              rating:'mid beginner (D)' },
    6:  { desc: '7 balls (3 solids, 3 stripes, 8), 8-ball rules, 1 extra BIH.',  rating:'upper beginner (D+)' },
    7:  { desc: '9 balls, any order, 1 extra BIH.',                              rating:'lower intermediate (C-)' },
    8:  { desc: '9 balls (4 solids, 4 stripes, 8), 8-ball rules, 1 extra BIH.',  rating:'mid intermediate (C)' },
    9:  { desc: '15 balls, any order, 2 extra BIHs.',                            rating:'upper intermediate (C+)' },
    10: { desc: '6 balls, in order (rotation).',                                  rating:'lower advanced (B-)' },
    11: { desc: '15 balls, any order.',                                           rating:'mid advanced (B)' },
    12: { desc: '15 balls, 8-ball rules.',                                        rating:'upper advanced (B+)' },
    13: { desc: '9 balls (4 solids, 4 stripes, 8), 8-ball rules, then remaining in order.', rating:'lower shortstop (A-)' },
    14: { desc: '9 balls, 9-ball rules. 9 early is a win; credit for all balls.', rating:'upper shortstop (A)' },
    15: { desc: '15 balls, 8-ball rules, then remaining in order.',               rating:'semipro / pro (A+/AA)' },
    16: { desc: '15 balls, in order (rotation).',                                 rating:'world class pro (A++/AAA)' }
  };

  function emptySession(){
    return {
      date: todayISO(),
      level: 1,
      attempts: [null, null, null], // true=run, false=miss, null=pending
      log: [], // [{level, attempts:[...], result:'advance|stay|drop'}]
      timer: { elapsedMs: 0, running: false, lastStart: null }
    };
  }

  let session = emptySession();
  let history = loadHistory();

  // Elements
  const elDate = $('#rDate');
  const elStart = $('#rStart');
  const elLevel = $('#rLevel');
  const elLevelRating = $('#rLevelRating');
  const elLevelDesc = $('#rLevelDesc');
  const elAttemptsBody = $('#rAttempts');
  const elStatus = $('#rStatus');
  const elLog = $('#rLog');
  const elHistory = $('#rHistory');
  const elTimer = $('#rTimer');

  // Init controls
  (function fillStartSelect(){
    elStart.innerHTML = Array.from({length:16},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
  })();

  // Timer helpers
  const two = n=>String(n).padStart(2,'0');
  const fmt = ms=>{ const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; return `${two(h)}:${two(m)}:${two(ss)}`; };
  const curElapsed = ()=> session.timer.running ? session.timer.elapsedMs + (Date.now()-(session.timer.lastStart||Date.now())) : session.timer.elapsedMs;
  function start(){ if(session.timer.running) return; session.timer.running=true; session.timer.lastStart=Date.now(); saveTemp(); paintTimer(); }
  function pause(){ if(!session.timer.running) return; session.timer.elapsedMs=curElapsed(); session.timer.running=false; session.timer.lastStart=null; saveTemp(); paintTimer(); }
  function stop(){ session.timer.running=false; session.timer.elapsedMs=0; session.timer.lastStart=null; saveTemp(); paintTimer(); }
  function paintTimer(){ elTimer.textContent = fmt(curElapsed()); }

  // Attempt rendering
  function renderAttempts(){
    elAttemptsBody.innerHTML = '';
    for(let i=0;i<3;i++){
      const state = session.attempts[i]; // true/false/null
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Attempt ${i+1}</td>
        <td>
          <button class="ok" data-run="${i}">Run</button>
          <button class="bad" data-fail="${i}">Fail</button>
          <span class="subtitle" style="margin-left:8px">${state===true?'✅ Run':state===false?'❌ Fail':'—'}</span>
        </td>
      `;
      elAttemptsBody.appendChild(tr);
    }
  }

  function resolveProgress(){
    const filled = session.attempts.filter(a=>a!==null).length;
    if(filled<3){
      elStatus.textContent = 'Waiting for results…';
      return null;
    }
    const wins = session.attempts.filter(Boolean).length;
    let result='stay';
    if(wins>=2) result='advance';
    if(wins===0) result='drop';
    elStatus.textContent = result==='advance' ? 'Advance to next level' : result==='drop' ? 'Drop to previous level' : 'Stay on this level';
    return result;
  }

  function applyProgress(result){
    if(!result) return;
    // Log this set
    session.log.push({ level: session.level, attempts: [...session.attempts], result });
    // Move level
    if(result==='advance') session.level = Math.min(16, session.level+1);
    else if(result==='drop') session.level = Math.max(1, session.level-1);
    // Reset attempts
    session.attempts = [null,null,null];
  }

  function renderHeader(){
    const info = levelInfo[session.level];
    elLevel.textContent = String(session.level);
    elLevelRating.textContent = info?.rating || '—';
    elLevelDesc.textContent = info?.desc || '';
    elStart.value = String(session.level);
    elDate.value = session.date;
  }

  function renderLog(){
    elLog.innerHTML = '';
    if(!session.log.length){ elLog.innerHTML = '<p class="subtitle">No attempts logged yet.</p>'; return; }
    session.log.slice().reverse().forEach(entry=>{
      const div = document.createElement('div');
      const icon = entry.result==='advance'?'⬆️':entry.result==='drop'?'⬇️':'➡️';
      const txt = entry.attempts.map(a=>a===true?'✅':a===false?'❌':'—').join(' ');
      div.className='rds-card';
      div.innerHTML = `<strong>Level ${entry.level}</strong> — ${icon} ${entry.result}<br/><span class="subtitle">${txt}</span>`;
      elLog.appendChild(div);
    });
  }

  function saveHistory(){ localStorage.setItem(LS_HISTORY, JSON.stringify(history)); }
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_HISTORY)||'[]'); }catch{ return []; } }
  function renderHistory(){
    elHistory.innerHTML = '';
    if(!history.length){ elHistory.innerHTML='<p class="subtitle">No saved sessions.</p>'; return; }
    history.forEach((s,idx)=>{
      const div=document.createElement('div'); div.className='rds-card';
      const end = s.log.length ? s.log[s.log.length-1].level : s.level;
      div.innerHTML = `
        <h3>${s.date}</h3>
        <div><strong>End Level:</strong> ${end}</div>
        <div><strong>Rating:</strong> ${levelInfo[end]?.rating || '—'}</div>
        <div><strong>Attempts:</strong> ${s.log.length}</div>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button data-act="load" data-i="${idx}" class="tbtn">Load</button>
          <button data-act="delete" data-i="${idx}" class="tbtn stop">Delete</button>
        </div>
      `;
      elHistory.appendChild(div);
    });

    elHistory.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-act]');
      if(!btn) return;
      const i = +btn.dataset.i;
      if(btn.dataset.act==='load'){ session = structuredClone(history[i]); paintAll(); }
      if(btn.dataset.act==='delete'){ if(confirm('Delete this session?')){ history.splice(i,1); saveHistory(); renderHistory(); } }
    }, { once: true });
  }

  // temp persistence for in-progress session
  function saveTemp(){ sessionStorage.setItem('rds.current', JSON.stringify(session)); }
  function loadTemp(){ try{ const s=sessionStorage.getItem('rds.current'); if(s) session=JSON.parse(s); }catch{} }

  function paintAll(){
    renderHeader();
    renderAttempts();
    resolveProgress();
    renderLog();
    paintTimer();
  }

  // Wire controls
  elDate.addEventListener('change', e=>{ session.date=e.target.value||session.date; saveTemp(); });
  elStart.addEventListener('change', e=>{ session.level = +e.target.value; session.attempts=[null,null,null]; saveTemp(); paintAll(); });

  $('.rds-controls').addEventListener('click', e=>{
    const btn=e.target.closest('button.tbtn'); if(!btn) return;
    if(btn.dataset.act==='start') start();
    if(btn.dataset.act==='pause') pause();
    if(btn.dataset.act==='stop')  stop();
  });

  $('#rNewSession').addEventListener('click', ()=>{
    session = emptySession();
    paintAll(); saveTemp();
  });

  $('#rSaveSession').addEventListener('click', ()=>{
    // Resolve pending set before saving
    const res = resolveProgress();
    if(res) applyProgress(res);
    history.unshift(structuredClone(session));
    saveHistory(); renderHistory();
    alert('RDS session saved!');
  });

  // Attempts: Run / Fail
  elAttemptsBody.addEventListener('click', e=>{
    const run = e.target.closest('button[data-run]');
    const fail = e.target.closest('button[data-fail]');
    if(!run && !fail) return;
    const i = +(run?.dataset.run ?? fail?.dataset.fail);
    session.attempts[i] = !!run;
    const res = resolveProgress();
    saveTemp();
    renderAttempts();
    if(res){
      applyProgress(res);
      saveTemp();
      paintAll();
    }else{
      paintAll();
    }
  });

  // Tick timer
  setInterval(()=>{ if(session.timer.running){ paintTimer(); saveTemp(); } }, 1000);

  // Boot
  loadTemp();
  paintAll();
  renderHistory();
}
