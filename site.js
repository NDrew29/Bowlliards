/* Shared JS for: Home, Bowlliards, Ghost 9-Ball */

const $  = (q,root=document)=>root.querySelector(q);
const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));
const todayISO = ()=>{const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10);};

/* ========= Page Router ========= */
window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'bowlliards') initBowlliards();
  else if (page === 'ghost9') initGhost();
  else initHome();
});

/* ========= Home ========= */
function initHome(){ /* nothing fancy for now; links do the job */ }

/* ========= Bowlliards ========= */
/* persistent multi-board app with KPIs & per-board timer */
function initBowlliards(){
  const LS_KEY = 'bowlliards.multi.v2';
  function emptyFrame(){ return { r1:null, r2:null, r3:null, cumul:0 }; }
  function emptyTimer(){ return { elapsedMs: 0, running: false, lastStart: null }; }
  function emptyBoard(){ return { date: todayISO(), frames: Array.from({length:10}, emptyFrame), total: 0, timer: emptyTimer() }; }

  let boards = [emptyBoard()];
  let active = { b:0, f:0, r:0 };

  function normalizeBoard(b){
    if(!b) return emptyBoard();
    b.date   = b.date || todayISO();
    b.frames = Array.isArray(b.frames)&&b.frames.length===10
      ? b.frames.map(fr=>({r1:fr?.r1??null,r2:fr?.r2??null,r3:fr?.r3??null,cumul:fr?.cumul??0}))
      : Array.from({length:10}, emptyFrame);
    b.total  = b.total ?? 0;
    b.timer  = { elapsedMs:Number(b?.timer?.elapsedMs)||0, running:!!b?.timer?.running, lastStart:b?.timer?.lastStart ?? null };
    return b;
  }
  function saveAll(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({boards,active})); }catch{} }
  function loadAll(){
    try{
      const raw = localStorage.getItem(LS_KEY); if(!raw) return;
      const parsed = JSON.parse(raw);
      const loadedBoards = Array.isArray(parsed?.boards) ? parsed.boards.map(normalizeBoard) : null;
      if(loadedBoards && loadedBoards.length) boards = loadedBoards;
      if(parsed?.active){ active = { b:Math.min(parsed.active.b, boards.length-1), f:Math.min(parsed.active.f??0,9), r:Math.min(parsed.active.r??0,2) }; }
    }catch{}
  }

  function rollsFor(frames){
    const rolls=[];
    for(let f=0;f<9;f++){
      const {r1,r2} = frames[f];
      if(r1==null) break;
      if(r1===10) rolls.push(10);
      else{ rolls.push(r1); if(r2!=null) rolls.push(r2); }
    }
    const F=frames[9]; if(F.r1!=null){ rolls.push(F.r1); if(F.r2!=null) rolls.push(F.r2); if(F.r3!=null) rolls.push(F.r3); }
    return rolls;
  }
  function computeBoard(b){
    const frames=b.frames, rolls=rollsFor(frames); let i=0, cum=0;
    for(let f=0;f<10;f++){
      if(i>=rolls.length){ frames[f].cumul=cum; continue; }
      const r1=rolls[i]; let score=0;
      if(f<9){
        if(r1===10){ score = 10 + (rolls[i+1]||0) + (rolls[i+2]||0); i+=1; }
        else{ const r2=rolls[i+1]||0, sum=r1+r2; score = (sum===10)? 10 + (rolls[i+2]||0) : sum; i+=2; }
      }else{
        const r2=rolls[i+1]||0, r3=rolls[i+2]||0; score=r1+r2+r3; i=rolls.length;
      }
      cum+=score; frames[f].cumul=cum;
    }
    b.total=cum;
  }
  function computeGlobalStats(){
    let r1Sum=0,r1Cnt=0,r2Sum=0,r2Cnt=0,frameSum=0,frameCnt=0,gameSum=0,gameCnt=0,totalBalls=0;
    let startedFrames=0,strikeFrames=0,spareFrames=0,openFrames=0;
    boards.forEach(b=>{
      let gameRaw=0, any=false;
      b.frames.forEach((fr,fi)=>{
        const started=fr.r1!=null;
        if(started){
          startedFrames++; any=true;
          const raw=(fr.r1||0)+(fr.r2||0)+(fi===9?(fr.r3||0):0);
          frameSum+=raw; frameCnt++; totalBalls+=raw;
          if(fr.r1===10) strikeFrames++;
          else if((fr.r1||0)+(fr.r2||0)===10) spareFrames++;
          else openFrames++;
        }
        if(fr.r1!=null){ r1Cnt++; r1Sum+=fr.r1; }
        if(fr.r2!=null){ r2Cnt++; r2Sum+=fr.r2; }
        gameRaw += (fr.r1||0)+(fr.r2||0)+(fi===9?(fr.r3||0):0);
      });
      if(any){ gameCnt++; gameSum+=gameRaw; }
    });
    const avgR1=r1Cnt?(r1Sum/r1Cnt):0, avgR2=r2Cnt?(r2Sum/r2Cnt):0, avgF=frameCnt?(frameSum/frameCnt):0, avgG=gameCnt?(gameSum/gameCnt):0;
    const strikePct=startedFrames?(100*strikeFrames/startedFrames):0, sparePct=startedFrames?(100*spareFrames/startedFrames):0, openPct=startedFrames?(100*openFrames/startedFrames):0;
    $('#stat-avg-r1').textContent=avgR1.toFixed(2);
    $('#stat-avg-r2').textContent=avgR2.toFixed(2);
    $('#stat-avg-frame').textContent=avgF.toFixed(2);
    $('#stat-avg-game').textContent=avgG.toFixed(2);
    $('#stat-total-balls').textContent=String(totalBalls);
    $('#stat-strike-pct').textContent=`${strikePct.toFixed(0)}%`;
    $('#stat-spare-pct').textContent =`${sparePct.toFixed(0)}%`;
    $('#stat-open-pct').textContent  =`${openPct.toFixed(0)}%`;
  }
  function markSymbol(fr, idx, tenth){
    const v = idx===0?fr.r1:idx===1?fr.r2:fr.r3;
    if(v==null) return '';
    if(!tenth){
      if(idx===0&&v===10) return 'X';
      if(idx===1&&(fr.r1||0)+(fr.r2||0)===10) return '/';
      return String(v);
    }else{
      if(idx===0) return v===10?'X':String(v);
      if(idx===1){ if(fr.r1===10) return v===10?'X':String(v); return (fr.r1||0)+(fr.r2||0)===10?'/':String(v); }
      if(fr.r1===10){ if(fr.r2===10) return v===10?'X':String(v); return (fr.r2||0)+(fr.r3||0)===10?'/':String(v); }
      return (fr.r1||0)+(fr.r2||0)===10 ? (v===10?'X':String(v)) : '';
    }
  }
  const two=n=>String(n).padStart(2,'0');
  const fmtTime=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return `${two(h)}:${two(m)}:${two(ss)}`};
  function currentElapsed(b){ return b.timer.running ? b.timer.elapsedMs + (Date.now()-(b.timer.lastStart||Date.now())) : b.timer.elapsedMs; }
  function startTimer(b){ if(b.timer.running) return; b.timer.running=true; b.timer.lastStart=Date.now(); }
  function pauseTimer(b){ if(!b.timer.running) return; b.timer.elapsedMs=currentElapsed(b); b.timer.running=false; b.timer.lastStart=null; }
  function stopTimer (b){ b.timer.running=false; b.timer.elapsedMs=0; b.timer.lastStart=null; }
  function paintTimer(bi){ const b=boards[bi]; const el=$(`#timer-${bi}`); if(el) el.textContent=fmtTime(currentElapsed(b)); }

  function render(){
    const host = $('#boards'); host.innerHTML='';
    boards.forEach((b,bi)=>{
      computeBoard(b);

      const header=document.createElement('div'); header.className='board-header';
      const dateWrap=document.createElement('div'); dateWrap.innerHTML=`<span class="label">Game Date:</span><input type="date" value="${b.date}">`;
      $('input',dateWrap).addEventListener('change',e=>{ b.date=e.target.value||b.date; saveAll(); computeGlobalStats(); });
      const timer=document.createElement('div'); timer.className='timer';
      timer.innerHTML=`<span class="display" id="timer-${bi}">${fmtTime(currentElapsed(b))}</span>
        <button class="tbtn start" data-a="start">Start</button>
        <button class="tbtn pause" data-a="pause">Pause</button>
        <button class="tbtn stop"  data-a="stop">Stop</button>`;
      const totals=document.createElement('div'); totals.className='totals'; totals.innerHTML=`Total: <span id="total-${bi}">${b.total}</span>`;
      header.append(dateWrap,timer,totals);

      const table=document.createElement('table'); table.className='frames-table';
      table.innerHTML=`<thead><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>Max Possible</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td>Rolls</td>
            ${Array.from({length:10},(_,i)=>`<td><div class="frame ${i===9?'tenth':''}" data-fi="${i}"></div></td>`).join('')}
            <td rowspan="2" class="totals-col"><strong>300</strong></td>
            <td rowspan="2" class="totals-col"><div id="grand-${bi}">${b.total}</div></td>
          </tr>
          <tr><td>0</td>${Array.from({length:10},(_,i)=>`<td id="cum-${bi}-${i}">${b.frames[i].cumul}</td>`).join('')}</tr>
        </tbody>`;
      const boardEl=document.createElement('section'); boardEl.className='board'; boardEl.append(header,table); host.appendChild(boardEl);

      // minis
      $$('.frame',table).forEach(fe=>{
        const fi=+fe.dataset.fi; const fr=b.frames[fi]; fe.innerHTML='';
        const cnt=fi===9?3:2;
        for(let r=0;r<cnt;r++){
          const mini=document.createElement('div'); mini.className='mini'; mini.textContent=markSymbol(fr,r,fi===9);
          if(fi===9&&r===2){ const ok=fr.r1===10||((fr.r1||0)+(fr.r2||0)===10); if(!ok) mini.classList.add('disabled'); }
          if(active.b===bi&&active.f===fi&&active.r===r) mini.classList.add('selected');
          mini.addEventListener('click', ()=>{ active={b:bi,f:fi,r:r}; saveAll(); render(); mini.scrollIntoView({block:'nearest',inline:'center'}); });
          fe.appendChild(mini);
        }
      });

      // fill totals
      b.frames.forEach((fr,i)=>{ $(`#cum-${bi}-${i}`).textContent=fr.cumul; });
      $(`#grand-${bi}`).textContent=b.total; $(`#total-${bi}`).textContent=b.total;

      // timer buttons
      header.addEventListener('click', e=>{
        const btn=e.target.closest('button.tbtn'); if(!btn) return;
        if(btn.dataset.a==='start') startTimer(b);
        if(btn.dataset.a==='pause') pauseTimer(b);
        if(btn.dataset.a==='stop')  stopTimer(b);
        saveAll(); paintTimer(bi);
      });
    });
    computeGlobalStats();
  }

  // keypad & edit handlers
  function maxFor(fi,ri){
    const fr=boards[active.b].frames[fi];
    if(fi<9){ return ri===0?10:Math.max(0,10-(fr.r1||0)); }
    if(ri===0) return 10;
    if(ri===1) return fr.r1===10?10:Math.max(0,10-(fr.r1||0));
    return fr.r1===10 ? (fr.r2===10?10:Math.max(0,10-(fr.r2||0))) : (((fr.r1||0)+(fr.r2||0)===10)?10:0);
  }
  function setValue(v){
    const bi=active.b, fi=active.f, ri=active.r, fr=boards[bi].frames[fi];
    if(v==='CLR'){ if(ri===0) fr.r1=null; if(ri===1) fr.r2=null; if(ri===2) fr.r3=null; computeBoard(boards[bi]); saveAll(); render(); return; }
    if(v==='X') v=10;
    if(v==='/'){
      if(fi<9 && ri===1 && fr.r1!=null && fr.r1<10) fr.r2=10-fr.r1;
      else if(fi===9){
        if(ri===1 && fr.r1!=null && fr.r1<10) fr.r2=10-fr.r1;
        else if(ri===2 && fr.r1===10 && fr.r2!=null && fr.r2<10) fr.r3=10-fr.r2;
      }
      computeBoard(boards[bi]); saveAll(); render(); autoAdvance(); return;
    }
    const n=Number(v); if(Number.isNaN(n)) return;
    const max=maxFor(fi,ri); const val=Math.min(Math.max(0,n),max);
    if(ri===0){ fr.r1=val; if(fi<9 && val===10) fr.r2=null; } else if(ri===1){ fr.r2=val; } else { fr.r3=val; }
    computeBoard(boards[bi]); saveAll(); render(); autoAdvance();
  }
  function autoAdvance(){
    const bi=active.b, fi=active.f, ri=active.r, fr=boards[bi].frames[fi];
    if(fi<9){ active = (ri===0) ? (fr.r1===10? {b:bi,f:fi+1,r:0}:{b:bi,f:fi,r:1}) : {b:bi,f:fi+1,r:0}; }
    else{
      if(ri===0) active={b:bi,f:fi,r:1};
      else if(ri===1){ const ok=fr.r1===10||((fr.r1||0)+(fr.r2||0)===10); active={b:bi,f:fi,r:ok?2:1}; }
      else active={b:bi,f:fi,r:2};
    }
    saveAll(); render();
  }

  $('#keypad').addEventListener('click', e=>{ const b=e.target.closest('button[data-k]'); if(!b) return; setValue(b.dataset.k); });
  $('#btnAddGame').addEventListener('click', ()=>{ boards.push(emptyBoard()); active={b:boards.length-1,f:0,r:0}; saveAll(); render(); });

  // timer ticking & autosave
  setInterval(()=>{ let run=false; boards.forEach((b,i)=>{ if(b.timer.running) run=true; paintTimer(i); }); if(run) saveAll(); }, 1000);

  loadAll(); render();
}

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

  function emptyRack(){ return { balls: 0, nineBonus: false, score: 0 }; }
  function emptySession(n=5){ return {
    date: todayISO(),
    racks: Array.from({length:n}, emptyRack),
    total: 0, rackCount: n,
    timer: { elapsedMs: 0, running: false, lastStart: null }
  }; }

  let session = emptySession(5);
  let history = loadHistory();

  const elDate = $('#gDate'), elCount = $('#gRackCount'), elBody = $('#gBody'), elTotal = $('#gTotal'), elRating = $('#gRating');
  const elTimer = $('#gTimer');

  function fmt(ms){ const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; const two=n=>String(n).padStart(2,'0'); return `${two(h)}:${two(m)}:${two(ss)}`; }
  function curElapsed(){ return session.timer.running ? session.timer.elapsedMs + (Date.now()-(session.timer.lastStart||Date.now())) : session.timer.elapsedMs; }
  function start(){ if(session.timer.running) return; session.timer.running=true; session.timer.lastStart=Date.now(); saveSessionTemp(); paintTimer(); }
  function pause(){ if(!session.timer.running) return; session.timer.elapsedMs=curElapsed(); session.timer.running=false; session.timer.lastStart=null; saveSessionTemp(); paintTimer(); }
  function stop(){ session.timer.running=false; session.timer.elapsedMs=0; session.timer.lastStart=null; saveSessionTemp(); paintTimer(); }
  function paintTimer(){ elTimer.textContent = fmt(curElapsed()); }

  function compute(){
    session.total = session.racks.reduce((sum,r)=>sum + r.score, 0);
    const band = ratingBands[session.rackCount].find(b=>session.total>=b.min && session.total<=b.max);
    elTotal.textContent = String(session.total);
    elRating.textContent = band ? `${band.rating} (${band.label})` : '—';
  }

  function renderRows(){
    elBody.innerHTML = '';
    session.racks.forEach((r, i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><input type="number" min="0" max="9" step="1" value="${r.balls}" data-i="${i}" class="gBalls"></td>
        <td><input type="checkbox" ${r.nineBonus?'checked':''} data-i="${i}" class="gNine"></td>
        <td><strong id="gScore-${i}">${r.score}</strong></td>
      `;
      elBody.appendChild(tr);
    });
  }

  function recalc(i){
    const r = session.racks[i];
    r.balls = Math.max(0, Math.min(9, Number(r.balls)||0));
    r.score = r.balls + (r.nineBonus ? 1 : 0);
    $('#gScore-'+i).textContent = String(r.score);
    compute(); saveSessionTemp();
  }

  function wireRows(){
    elBody.addEventListener('input', e=>{
      if(e.target.classList.contains('gBalls')){
        const i=+e.target.dataset.i; session.racks[i].balls = Number(e.target.value);
        recalc(i);
      }
    });
    elBody.addEventListener('change', e=>{
      if(e.target.classList.contains('gNine')){
        const i=+e.target.dataset.i; session.racks[i].nineBonus = e.target.checked;
        recalc(i);
      }
    });
  }

  function renderHistory(){
    const host = $('#gHistory'); host.innerHTML='';
    if(!history.length){ host.innerHTML = '<p class="subtitle">No saved sessions yet.</p>'; return; }
    history.forEach((s,idx)=>{
      const div=document.createElement('div'); div.className='ghost-card';
      div.innerHTML=`<h3>${s.date} — ${s.rackCount} racks</h3>
        <div><strong>Total:</strong> ${s.total}</div>
        <div><strong>Rating:</strong> ${rateLabel(s.total, s.rackCount)}</div>
        <div><strong>Racks:</strong> ${s.racks.map(r=>r.score).join(', ')}</div>
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
    renderRows(); wireRows(); compute(); paintTimer();
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
