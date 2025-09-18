/* Shared JS (router + Ghost 9-Ball) */

/* ---------- tiny helpers ---------- */
const $  = (q,root=document)=>root.querySelector(q);
const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));
const todayISO = ()=>{
  const d=new Date(),o=d.getTimezoneOffset();
  return new Date(d.getTime()-o*60000).toISOString().slice(0,10);
};
// safe text setters so missing cards don't crash
function setText(id, v){ const n=document.getElementById(id); if(n) n.textContent=String(v); }

/* ---------- router ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'ghost9';
  if (page === 'ghost9') initGhost();
  // (Other pages can use their own scripts; router won’t interfere.)
});

/* ========= Ghost 9-Ball ========= */
function initGhost(){
  const LS_KEY = 'ghost9.sessions.v1';

  /* rating table from the drill sheet */
  const ratingBands = {
    5: [
      {min:0,max:8,rating:1,label:'1 / D / novice'},
      {min:9,max:14,rating:2,label:'2 / C- novice'},
      {min:15,max:19,rating:3,label:'3 / C novice'},
      {min:20,max:23,rating:4,label:'4 / B- novice'},
      {min:24,max:27,rating:5,label:'5 / C / intermediate'},
      {min:28,max:31,rating:6,label:'6 intermediate'},
      {min:32,max:35,rating:7,label:'7 intermediate'},
      {min:36,max:39,rating:8,label:'8 intermediate'},
      {min:40,max:44,rating:9,label:'9 intermediate'},
      {min:45,max:50,rating:10,label:'10 / A / superior'}
    ],
    10: [
      {min:0,max:16,rating:1,label:'1 / D / novice'},
      {min:17,max:28,rating:2,label:'2 novice'},
      {min:29,max:38,rating:3,label:'3 novice'},
      {min:39,max:46,rating:4,label:'4 novice'},
      {min:47,max:54,rating:5,label:'5 / C / intermediate'},
      {min:55,max:62,rating:6,label:'6 intermediate'},
      {min:63,max:70,rating:7,label:'7 intermediate'},
      {min:71,max:78,rating:8,label:'8 intermediate'},
      {min:79,max:88,rating:9,label:'9 intermediate'},
      {min:89,max:100,rating:10,label:'10 / A / superior'}
    ]
  };

  /* rack/session models */
  function emptyRack(){
    return {
      balls: 0,            // total balls made (0–9)
      scratchBreak: false, // scratch on the break
      breakBalls: 0,       // balls pocketed on the break (0–9)
      nineBreak: false,    // 9 on the break (tracked only; no +1)
      nineMade: false,     // 9 made legally during the run (+1)
      score: 0
    };
  }
  function emptySession(n=5){
    return {
      date: todayISO(),
      racks: Array.from({length:n}, emptyRack),
      rackCount: n,
      total: 0,
      timer: { elapsedMs:0, running:false, lastStart:null }
    };
  }

  let session = emptySession(5);
  let history = loadHistory();

  /* elements */
  const elDate   = $('#gDate');
  const elCount  = $('#gRackCount');
  const elBody   = $('#gBody');
  const elTotal  = $('#gTotal');
  const elRating = $('#gRating');
  const elTimer  = $('#gTimer');
  const elHistory= $('#gHistory');

  /* KPI ids (use safe setters) */
  const KPI_IDS = ['gKpiRacks','gKpiAvgBreak','gKpiBreakScr','gKpiAvgRun','gKpiTotalBalls','gKpiRunouts','gKpiNines','gKpiNineBreak','gKpiAvgScore'];

  /* timer helpers */
  const two=n=>String(n).padStart(2,'0');
  const fmt = ms=>{ const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; return `${two(h)}:${two(m)}:${two(ss)}`; };
  const curElapsed = ()=> session.timer.running ? session.timer.elapsedMs + (Date.now()-(session.timer.lastStart||Date.now())) : session.timer.elapsedMs;
  function start(){ if(session.timer.running) return; session.timer.running=true; session.timer.lastStart=Date.now(); saveSessionTemp(); paintTimer(); }
  function pause(){ if(!session.timer.running) return; session.timer.elapsedMs=curElapsed(); session.timer.running=false; session.timer.lastStart=null; saveSessionTemp(); paintTimer(); }
  function stop(){ session.timer.running=false; session.timer.elapsedMs=0; session.timer.lastStart=null; saveSessionTemp(); paintTimer(); }
  function paintTimer(){ if(elTimer) elTimer.textContent = fmt(curElapsed()); }

  /* scoring rules */
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function scoreRack(r){
    const balls = clamp(r.balls,0,9);
    const bb    = clamp(r.breakBalls,0,9);
    const legal = r.scratchBreak ? Math.max(0, balls - bb) : balls;
    return legal + (r.nineMade ? 1 : 0);
  }

  function compute(){
    session.racks.forEach(r => r.score = scoreRack(r));
    session.total = session.racks.reduce((s,r)=>s+r.score,0);

    const band = ratingBands[session.rackCount].find(b=>session.total>=b.min && session.total<=b.max);
    if(elTotal)  elTotal.textContent = String(session.total);
    if(elRating) elRating.textContent = band ? `${band.rating} (${band.label})` : '—';

    // KPIs
    const racks = session.racks.length || 0;
    const sumBreak   = session.racks.reduce((s,r)=>s+clamp(r.breakBalls,0,9),0);
    const breakScr   = session.racks.filter(r=>r.scratchBreak).length;
    const sumLegal   = session.racks.reduce((s,r)=>{
      const balls=clamp(r.balls,0,9), bb=clamp(r.breakBalls,0,9);
      return s + (r.scratchBreak ? Math.max(0,balls-bb) : balls);
    },0);
    const ninesRun      = session.racks.filter(r=>r.nineMade).length;
    const ninesOnBreak  = session.racks.filter(r=>r.nineBreak && !r.scratchBreak).length; // legal only
    const runouts       = session.racks.filter(r=>{
      const balls=clamp(r.balls,0,9), bb=clamp(r.breakBalls,0,9);
      return (r.scratchBreak ? Math.max(0,balls-bb) : balls) === 9;
    }).length;
    const avgBreak = racks ? (sumBreak/racks) : 0;
    const avgRun   = racks ? (sumLegal/racks) : 0;
    const avgScore = racks ? (session.total/racks) : 0;
    const scrPct   = racks ? (100*breakScr/racks) : 0;

    setText('gKpiRacks', racks);
    setText('gKpiAvgBreak', avgBreak.toFixed(2));
    setText('gKpiBreakScr', scrPct.toFixed(0) + '%');
    setText('gKpiAvgRun', avgRun.toFixed(2));
    setText('gKpiTotalBalls', sumLegal);
    setText('gKpiRunouts', runouts);
    setText('gKpiNines', ninesRun);
    setText('gKpiNineBreak', ninesOnBreak);
    setText('gKpiAvgScore', avgScore.toFixed(2));
  }

  function renderRows(){
    if(!elBody) return;
    elBody.innerHTML='';
    session.racks.forEach((r,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td>
        <td><input type="number" min="0" max="9" step="1" value="${r.balls}" data-i="${i}" class="gBalls"></td>
        <td><input type="checkbox" ${r.scratchBreak?'checked':''} data-i="${i}" class="gScr"></td>
        <td><input type="number" min="0" max="9" step="1" value="${r.breakBalls}" data-i="${i}" class="gBreak"></td>
        <td><input type="checkbox" ${r.nineBreak?'checked':''} data-i="${i}" class="gNineBrk"></td>
        <td><input type="checkbox" ${r.nineMade?'checked':''} data-i="${i}" class="gNine"></td>
        <td><strong id="gScore-${i}">${r.score}</strong></td>`;
      elBody.appendChild(tr);
    });
  }

  function recalc(i){
    const r=session.racks[i];
    r.balls      = clamp(r.balls,0,9);
    r.breakBalls = clamp(r.breakBalls,0,9);
    r.score = scoreRack(r);
    const sEl = document.getElementById('gScore-'+i);
    if(sEl) sEl.textContent = String(r.score);
    compute(); saveSessionTemp();
  }

  function wireRows(){
    if(!elBody) return;
    elBody.addEventListener('input', e=>{
      const i = +e.target.dataset.i;
      if(e.target.classList.contains('gBalls')){ session.racks[i].balls = e.target.value; recalc(i); }
      if(e.target.classList.contains('gBreak')){ session.racks[i].breakBalls = e.target.value; recalc(i); }
    });
    elBody.addEventListener('change', e=>{
      const i=+e.target.dataset.i;
      if(e.target.classList.contains('gScr'))    { session.racks[i].scratchBreak = e.target.checked; recalc(i); }
      if(e.target.classList.contains('gNineBrk')){ session.racks[i].nineBreak    = e.target.checked; compute(); saveSessionTemp(); }
      if(e.target.classList.contains('gNine'))   { session.racks[i].nineMade     = e.target.checked; recalc(i); }
    });
  }

  function rateLabel(total, n){
    const band = ratingBands[n].find(b=>total>=b.min && total<=b.max);
    return band ? `${band.rating} (${band.label})` : '—';
  }

  /* history */
  function saveHistory(){ localStorage.setItem(LS_KEY, JSON.stringify(history)); }
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ return []; } }
  function saveSessionTemp(){ sessionStorage.setItem('ghost9.current', JSON.stringify(session)); }
  function loadSessionTemp(){ try{ const s=sessionStorage.getItem('ghost9.current'); if(s) session=JSON.parse(s); }catch{} }

  function renderHistory(){
    if(!elHistory) return;
    elHistory.innerHTML='';
    if(!history.length){ elHistory.innerHTML='<p class="subtitle">No saved sessions yet.</p>'; return; }
    history.forEach((s,idx)=>{
      const div=document.createElement('div'); div.className='ghost-card';
      const racks=s.racks?.length||s.rackCount||0;
      const avg=racks? (s.total/racks).toFixed(2) : '0.00';
      div.innerHTML=`
        <h3>${s.date} — ${s.rackCount} racks</h3>
        <div><strong>Total:</strong> ${s.total} (avg ${avg})</div>
        <div><strong>Rating:</strong> ${rateLabel(s.total, s.rackCount)}</div>
        <div><strong>Racks (scores):</strong> ${s.racks.map(r=>r.score).join(', ')}</div>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button data-act="load" data-i="${idx}" class="tbtn">Load</button>
          <button data-act="delete" data-i="${idx}" class="tbtn stop">Delete</button>
        </div>`;
      elHistory.appendChild(div);
    });
    elHistory.addEventListener('click', e=>{
      const b=e.target.closest('button[data-act]'); if(!b) return;
      const i=+b.dataset.i;
      if(b.dataset.act==='load'){ session = structuredClone(history[i]); paintAll(); }
      if(b.dataset.act==='delete'){ if(confirm('Delete this session?')){ history.splice(i,1); saveHistory(); renderHistory(); } }
    }, { once:true });
  }

  function paintAll(){
    if(elDate)  elDate.value  = session.date;
    if(elCount) elCount.value = String(session.rackCount);
    renderRows(); wireRows(); compute(); paintTimer();
  }

  /* controls */
  if(elDate) elDate.addEventListener('change', e=>{ session.date=e.target.value||session.date; saveSessionTemp(); });
  if(elCount) elCount.addEventListener('change', e=>{
    const n=+e.target.value;
    session.rackCount=n;
    const cur=session.racks.map(r=>structuredClone(r));
    session.racks=Array.from({length:n},(_,i)=>cur[i] ?? emptyRack());
    paintAll(); saveSessionTemp();
  });
  $('.ghost-controls')?.addEventListener('click', e=>{
    const btn=e.target.closest('button.tbtn'); if(!btn) return;
    if(btn.dataset.act==='start') start();
    if(btn.dataset.act==='pause') pause();
    if(btn.dataset.act==='stop')  stop();
  });
  $('#gNewSession')?.addEventListener('click', ()=>{ session=emptySession(+elCount.value||5); paintAll(); saveSessionTemp(); });
  $('#gSave')?.addEventListener('click', ()=>{
    session.racks.forEach((_,i)=>recalc(i)); // finalize
    history.unshift(structuredClone(session));
    saveHistory(); renderHistory();
    alert('Session saved!');
  });

  /* ticking timer */
  setInterval(()=>{ if(session.timer.running) { paintTimer(); saveSessionTemp(); } }, 1000);

  /* boot */
  loadSessionTemp();
  paintAll();
  renderHistory();
}
