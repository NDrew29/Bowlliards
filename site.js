/* ========= Ghost 9-Ball ========= */
function initGhost(){
  const LS_KEY = 'ghost9.sessions.v1';

  const ratingBands = {
    5:  [
      {min:  0, max:  8,  rating:1, label:'1 / D / novice'},
      {min:  9, max: 14,  rating:2, label:'2 / C- novice'},
      {min: 15, max: 19,  rating:3, label:'3 / C novice'},
      {min: 20, max: 23,  rating:4, label:'4 / B- novice'},
      {min: 24, max: 27,  rating:5, label:'5 / C / intermediate'},
      {min: 28, max: 31,  rating:6, label:'6 intermediate'},
      {min: 32, max: 35,  rating:7, label:'7 intermediate'},
      {min: 36, max: 39,  rating:8, label:'8 intermediate'},
      {min: 40, max: 44,  rating:9, label:'9 intermediate'},
      {min: 45, max: 50,  rating:10,label:'10 / A / superior'}
    ],
    10: [
      {min:  0, max: 16,  rating:1, label:'1 / D / novice'},
      {min: 17, max: 28,  rating:2, label:'2 novice'},
      {min: 29, max: 38,  rating:3, label:'3 novice'},
      {min: 39, max: 46,  rating:4, label:'4 novice'},
      {min: 47, max: 54,  rating:5, label:'5 / C / intermediate'},
      {min: 55, max: 62,  rating:6, label:'6 intermediate'},
      {min: 63, max: 70,  rating:7, label:'7 intermediate'},
      {min: 71, max: 78,  rating:8, label:'8 intermediate'},
      {min: 79, max: 88,  rating:9, label:'9 intermediate'},
      {min: 89, max:100,  rating:10,label:'10 / A / superior'}
    ]
  };

  // New rack model (matches your desired columns)
  function emptyRack(){
    return {
      balls: 0,          // user-entered total balls made for the rack (0–9)
      scratchBreak: false,
      breakBalls: 0,     // balls pocketed on break (0–9)
      nineMade: false,   // +1 bonus if true
      score: 0
    };
  }
  function emptySession(n=5){ return {
    date: todayISO(),
    racks: Array.from({length:n}, emptyRack),
    total: 0, rackCount: n,
    timer: { elapsedMs: 0, running: false, lastStart: null }
  }; }

  let session = emptySession(5);
  let history = loadHistory();

  // Elements
  const elDate = $('#gDate'), elCount = $('#gRackCount'), elBody = $('#gBody'),
        elTotal = $('#gTotal'), elRating = $('#gRating'), elTimer = $('#gTimer');

  // KPI elements
  const elKpiRacks = $('#gKpiRacks'),
        elKpiAvgBreak = $('#gKpiAvgBreak'),
        elKpiBreakScr = $('#gKpiBreakScr'),
        elKpiAvgRun = $('#gKpiAvgRun'),
        elKpiTotalBalls = $('#gKpiTotalBalls'),
        elKpiRunouts = $('#gKpiRunouts'),
        elKpiNines = $('#gKpiNines'),
        elKpiAvgScore = $('#gKpiAvgScore');

  // Timer helpers
  const two = n=>String(n).padStart(2,'0');
  const fmt = ms => { const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; return `${two(h)}:${two(m)}:${two(ss)}`; };
  const curElapsed = ()=> session.timer.running ? session.timer.elapsedMs + (Date.now()-(session.timer.lastStart||Date.now())) : session.timer.elapsedMs;
  function start(){ if(session.timer.running) return; session.timer.running=true; session.timer.lastStart=Date.now(); saveSessionTemp(); paintTimer(); }
  function pause(){ if(!session.timer.running) return; session.timer.elapsedMs=curElapsed(); session.timer.running=false; session.timer.lastStart=null; saveSessionTemp(); paintTimer(); }
  function stop(){ session.timer.running=false; session.timer.elapsedMs=0; session.timer.lastStart=null; saveSessionTemp(); paintTimer(); }
  function paintTimer(){ elTimer.textContent = fmt(curElapsed()); }

  // Score for a single rack based on your rule
  function scoreRack(r){
    const balls = clamp(r.balls, 0, 9);
    const bb    = clamp(r.breakBalls, 0, 9);
    const legalBalls = r.scratchBreak ? Math.max(0, balls - bb) : balls;
    return legalBalls + (r.nineMade ? 1 : 0);
  }
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));

  // Recompute everything (score, KPIs, rating)
  function compute(){
    session.racks.forEach(r => { r.score = scoreRack(r); });
    session.total = session.racks.reduce((sum,r)=>sum + r.score, 0);

    const band = ratingBands[session.rackCount].find(b=>session.total>=b.min && session.total<=b.max);
    elTotal.textContent = String(session.total);
    elRating.textContent = band ? `${band.rating} (${band.label})` : '—';

    // KPIs
    const racks = session.racks.length;
    const sumBreak   = session.racks.reduce((s,r)=>s + clamp(r.breakBalls,0,9), 0);
    const breakScr   = session.racks.filter(r=>r.scratchBreak).length;
    const sumLegal   = session.racks.reduce((s,r)=>{
      const balls = clamp(r.balls,0,9), bb=clamp(r.breakBalls,0,9);
      return s + (r.scratchBreak ? Math.max(0, balls - bb) : balls);
    }, 0);
    const nines      = session.racks.filter(r=>r.nineMade).length;
    const runouts    = session.racks.filter(r=>{
      const balls = clamp(r.balls,0,9), bb=clamp(r.breakBalls,0,9);
      const legal = r.scratchBreak ? Math.max(0, balls - bb) : balls;
      return legal === 9;
    }).length;

    elKpiRacks.textContent      = String(racks);
    elKpiAvgBreak.textContent   = (racks ? (sumBreak/racks) : 0).toFixed(2);
    elKpiBreakScr.textContent   = (racks ? (100*breakScr/racks) : 0).toFixed(0) + '%';
    elKpiAvgRun.textContent     = (racks ? (sumLegal/racks) : 0).toFixed(2);
    elKpiTotalBalls.textContent = String(sumLegal);
    elKpiRunouts.textContent    = String(runouts);
    elKpiNines.textContent      = String(nines);
    elKpiAvgScore.textContent   = (racks ? (session.total/racks) : 0).toFixed(2);
  }

  function renderRows(){
    elBody.innerHTML = '';
    session.racks.forEach((r, i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><input type="number" min="0" max="9" step="1" value="${r.balls}" data-i="${i}" class="gBalls"></td>
        <td><input type="checkbox" ${r.scratchBreak?'checked':''} data-i="${i}" class="gScr"></td>
        <td><input type="number" min="0" max="9" step="1" value="${r.breakBalls}" data-i="${i}" class="gBreak"></td>
        <td><input type="checkbox" ${r.nineMade?'checked':''} data-i="${i}" class="gNine"></td>
        <td><strong id="gScore-${i}">${r.score}</strong></td>
      `;
      elBody.appendChild(tr);
    });
  }

  function recalc(i){
    const r = session.racks[i];
    // sanitize inputs
    r.balls      = clamp(r.balls, 0, 9);
    r.breakBalls = clamp(r.breakBalls, 0, 9);
    // compute & paint
    r.score = scoreRack(r);
    $('#gScore-'+i).textContent = String(r.score);
    compute(); saveSessionTemp();
  }

  function wireRows(){
    elBody.addEventListener('input', e=>{
      const i = +e.target.dataset.i;
      if(e.target.classList.contains('gBalls')) { session.racks[i].balls      = e.target.value; recalc(i); }
      if(e.target.classList.contains('gBreak')) { session.racks[i].breakBalls = e.target.value; recalc(i); }
    });
    elBody.addEventListener('change', e=>{
      const i = +e.target.dataset.i;
      if(e.target.classList.contains('gScr'))  { session.racks[i].scratchBreak = e.target.checked; recalc(i); }
      if(e.target.classList.contains('gNine')) { session.racks[i].nineMade     = e.target.checked; recalc(i); }
    });
  }

  function renderHistory(){
    const host = $('#gHistory'); host.innerHTML='';
    if(!history.length){ host.innerHTML = '<p class="subtitle">No saved sessions yet.</p>'; return; }
    history.forEach((s,idx)=>{
      const div=document.createElement('div'); div.className='ghost-card';
      const racks = s.racks.length;
      const avgScore = racks ? (s.total/racks).toFixed(2) : '0.00';
      div.innerHTML=`<h3>${s.date} — ${s.rackCount} racks</h3>
        <div><strong>Total:</strong> ${s.total} (avg ${avgScore})</div>
        <div><strong>Rating:</strong> ${rateLabel(s.total, s.rackCount)}</div>
        <div><strong>Racks (scores):</strong> ${s.racks.map(r=>r.score).join(', ')}</div>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button data-act="load" data-i="${idx}" class="tbtn">Load</button>
          <button data-act="delete" data-i="${idx}" class="tbtn stop">Delete</button>
        </div>`;
      host.appendChild(div);
    });

    host.addEventListener('click', e=>{
      const btn=e.target.closest('button[data-act]'); if(!btn) return;
      const i=+btn.dataset.i;
      if(btn.dataset.act==='load'){ session = structuredClone(history[i]); paintAll(); }
      if(btn.dataset.act==='delete'){ if(confirm('Delete this session?')){ history.splice(i,1); saveHistory(); renderHistory(); } }
    }, { once:true });
  }

  function rateLabel(total, n){
    const band = ratingBands[n].find(b=>total>=b.min && total<=b.max);
    return band ? `${band.rating} (${band.label})` : '—';
  }

  // persistence for Ghost
  function saveHistory(){ localStorage.setItem(LS_KEY, JSON.stringify(history)); }
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ return []; } }
  function saveSessionTemp(){ sessionStorage.setItem('ghost9.current', JSON.stringify(session)); }
  function loadSessionTemp(){ try{ const s=sessionStorage.getItem('ghost9.current'); if(s) session=JSON.parse(s); }catch{} }

  function paintAll(){
    elDate.value = session.date;
    elCount.value = String(session.rackCount);
    renderRows();
    wireRows();
    compute();
    paintTimer();
  }

  // controls
  elDate.addEventListener('change', e=>{ session.date=e.target.value||session.date; saveSessionTemp(); });
  elCount.addEventListener('change', e=>{
    const n = +e.target.value;
    session.rackCount = n;
    // resize racks (keep existing values where possible)
    const cur = session.racks.map(r=>structuredClone(r));
    session.racks = Array.from({length:n}, (_,i)=> cur[i] ?? emptyRack());
    paintAll(); saveSessionTemp();
  });
  $('.ghost-controls').addEventListener('click', e=>{
    const btn=e.target.closest('button.tbtn'); if(!btn) return;
    if(btn.dataset.act==='start') start();
    if(btn.dataset.act==='pause') pause();
    if(btn.dataset.act==='stop')  stop();
  });
  $('#gNewSession').addEventListener('click', ()=>{
    session = emptySession(+elCount.value||5);
    paintAll(); saveSessionTemp();
  });
  $('#gSave').addEventListener('click', ()=>{
    // finalize current scores
    session.racks.forEach((_,i)=>recalc(i));
    history.unshift(structuredClone(session));
    saveHistory(); renderHistory();
    alert('Session saved!');
  });

  // ticking timer
  setInterval(()=>{ if(session.timer.running) { paintTimer(); saveSessionTemp(); } }, 1000);

  // boot
  loadSessionTemp();
  paintAll();
  renderHistory();
}
