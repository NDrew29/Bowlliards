/* =========================
   Shared JS: router + apps
   ========================= */

/* tiny helpers */
const $  = (q,root=document)=>root.querySelector(q);
const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));
const todayISO = ()=>{ const d=new Date(),o=d.getTimezoneOffset(); return new Date(d.getTime()-o*60000).toISOString().slice(0,10); };
function setText(id, v){ const n=document.getElementById(id); if(n) n.textContent=String(v); }

/* router */
window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'bowlliards') initBowlliards();
  else if (page === 'ghost9') initGhost();
  else if (page === 'rds') initRDS();
   else if (page === 'threeball') initThreeBall?.();
});

/* ========= Bowlliards ========= */
function initBowlliards(){
  const LS_KEY = 'bowlliards.multi.v2';
  const emptyFrame = ()=>({ r1:null, r2:null, r3:null, cumul:0 });
  const emptyTimer = ()=>({ elapsedMs:0, running:false, lastStart:null });
  const emptyBoard = ()=>({ date: todayISO(), frames: Array.from({length:10}, emptyFrame), total:0, timer: emptyTimer() });

  let boards = [emptyBoard()];
  let active = { b:0, f:0, r:0 };

  function rolls(frames){
    const out=[];
    for(let i=0;i<9;i++){
      const {r1,r2}=frames[i];
      if(r1==null) break;
      if(r1===10) out.push(10);
      else{ out.push(r1); if(r2!=null) out.push(r2); }
    }
    const F=frames[9]; if(F.r1!=null){ out.push(F.r1); if(F.r2!=null) out.push(F.r2); if(F.r3!=null) out.push(F.r3); }
    return out;
  }
  function compute(b){
    const r=rolls(b.frames); let i=0,c=0;
    for(let f=0;f<10;f++){
      if(i>=r.length){ b.frames[f].cumul=c; continue; }
      let s=0;
      if(f<9){
        if(r[i]===10){ s=10+(r[i+1]||0)+(r[i+2]||0); i+=1; }
        else{ const r2=r[i+1]||0,sum=r[i]+r2; s=(sum===10)? 10+(r[i+2]||0) : sum; i+=2; }
      }else{ s=(r[i]||0)+(r[i+1]||0)+(r[i+2]||0); i=r.length; }
      c+=s; b.frames[f].cumul=c;
    }
    b.total=c;
  }
  function computeKPIs(){
    let r1s=0,r1c=0,r2s=0,r2c=0,fs=0,fc=0,gs=0,gc=0,tb=0, st=0,sp=0,op=0,started=0;
    boards.forEach(b=>{
      let graw=0, any=false;
      b.frames.forEach((fr,i)=>{
        const raw=(fr.r1||0)+(fr.r2||0)+(i===9?(fr.r3||0):0);
        if(fr.r1!=null){ any=true; started++; tb+=raw; fs+=raw; fc++; if(fr.r1===10) st++; else if((fr.r1||0)+(fr.r2||0)===10) sp++; else op++; }
        if(fr.r1!=null){ r1c++; r1s+=fr.r1; }
        if(fr.r2!=null){ r2c++; r2s+=fr.r2; }
        graw+=raw;
      });
      if(any){ gc++; gs+=graw; }
    });
    setText('stat-avg-r1', r1c?(r1s/r1c).toFixed(2):'0.00');
    setText('stat-avg-r2', r2c?(r2s/r2c).toFixed(2):'0.00');
    setText('stat-avg-frame', fc?(fs/fc).toFixed(2):'0.00');
    setText('stat-avg-game', gc?(gs/gc).toFixed(2):'0.00');
    setText('stat-total-balls', tb);
    setText('stat-strike-pct', started?`${Math.round(100*st/started)}%`:'0%');
    setText('stat-spare-pct',  started?`${Math.round(100*sp/started)}%`:'0%');
    setText('stat-open-pct',   started?`${Math.round(100*op/started)}%`:'0%');
  }
  const two=n=>String(n).padStart(2,'0');
  const fmtTime=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return `${two(h)}:${two(m)}:${two(ss)}`};
  const nowElapsed=b=> b.timer.running ? b.timer.elapsedMs + (Date.now()-(b.timer.lastStart||Date.now())) : b.timer.elapsedMs;

  function render(){
    const host=$('#boards'); host.innerHTML='';
    boards.forEach((b,bi)=>{
      compute(b);
      const hdr=document.createElement('div'); hdr.className='board-header';
      const date=document.createElement('div'); date.innerHTML=`<span class="label">Game Date:</span> <input type="date" value="${b.date}">`;
      $('input',date).addEventListener('change',e=>{ b.date=e.target.value||b.date; save(); computeKPIs(); });
      const timer=document.createElement('div'); timer.className='timer';
      timer.innerHTML=`<span id="timer-${bi}" class="display">${fmtTime(nowElapsed(b))}</span>
        <button class="tbtn start" data-a="start">Start</button>
        <button class="tbtn pause" data-a="pause">Pause</button>
        <button class="tbtn stop" data-a="stop">Stop</button>`;
      const totals=document.createElement('div'); totals.className='totals'; totals.innerHTML=`Total: <strong id="total-${bi}">${b.total}</strong>`;
      hdr.append(date,timer,totals);

      const table=document.createElement('table'); table.className='frames-table';
      table.innerHTML=`<thead><tr><th></th>${Array.from({length:10},(_,i)=>`<th>${i+1}</th>`).join('')}<th>Max Possible</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td>Rolls</td>${Array.from({length:10},(_,i)=>`<td><div class="frame ${i===9?'tenth':''}" data-fi="${i}"></div></td>`).join('')}
            <td rowspan="2" class="totals-col"><strong>300</strong></td>
            <td rowspan="2" class="totals-col"><div id="grand-${bi}">${b.total}</div></td></tr>
        <tr><td>0</td>${Array.from({length:10},(_,i)=>`<td id="cum-${bi}-${i}">${b.frames[i].cumul}</td>`).join('')}</tr>
      </tbody>`;
      const section=document.createElement('section'); section.className='board'; section.append(hdr,table); host.appendChild(section);

      // minis
      $$('.frame',table).forEach(fe=>{
        const fi=+fe.dataset.fi; const fr=b.frames[fi]; fe.innerHTML='';
        const cnt=fi===9?3:2;
        for(let r=0;r<cnt;r++){
          const dv=document.createElement('div'); dv.className='mini';
          dv.textContent = ux(fr, r, fi===9);
          if(fi===9&&r===2){ const ok=(fr.r1===10)||((fr.r1||0)+(fr.r2||0)===10); if(!ok) dv.classList.add('disabled'); }
          if(active.b===bi&&active.f===fi&&active.r===r) dv.classList.add('selected');
          dv.addEventListener('click',()=>{ active={b:bi,f:fi,r:r}; save(); render(); dv.scrollIntoView({block:'nearest',inline:'center'}); });
          fe.appendChild(dv);
        }
      });

      b.frames.forEach((fr,i)=> setText(`cum-${bi}-${i}`, fr.cumul));
      setText(`grand-${bi}`, b.total); setText(`total-${bi}`, b.total);

      hdr.addEventListener('click', e=>{
        const btn=e.target.closest('button.tbtn'); if(!btn) return;
        if(btn.dataset.a==='start'){ if(!b.timer.running){ b.timer.running=true; b.timer.lastStart=Date.now(); } }
        if(btn.dataset.a==='pause'){ if(b.timer.running){ b.timer.elapsedMs=nowElapsed(b); b.timer.running=false; b.timer.lastStart=null; } }
        if(btn.dataset.a==='stop'){ b.timer.running=false; b.timer.elapsedMs=0; b.timer.lastStart=null; }
        save(); setText(`timer-${bi}`, fmtTime(nowElapsed(b)));
      });
    });
    computeKPIs();
  }
  function ux(fr, idx, tenth){
    const v = idx===0?fr.r1:idx===1?fr.r2:fr.r3;
    if(v==null) return '';
    if(!tenth){
      if(idx===0&&v===10) return 'X';
      if(idx===1&&(fr.r1||0)+(fr.r2||0)===10) return '/';
      return String(v);
    }
    if(idx===0) return v===10?'X':String(v);
    if(idx===1){ if(fr.r1===10) return v===10?'X':String(v); return (fr.r1||0)+(fr.r2||0)===10?'/':String(v); }
    if(fr.r1===10){ if(fr.r2===10) return v===10?'X':String(v); return (fr.r2||0)+(fr.r3||0)===10?'/':String(v); }
    return (fr.r1||0)+(fr.r2||0)===10 ? (v===10?'X':String(v)) : '';
  }

  function maxFor(fi,ri){
    const fr=boards[active.b].frames[fi];
    if(fi<9){ return ri===0?10:Math.max(0,10-(fr.r1||0)); }
    if(ri===0) return 10;
    if(ri===1) return fr.r1===10?10:Math.max(0,10-(fr.r1||0));
    return fr.r1===10 ? (fr.r2===10?10:Math.max(0,10-(fr.r2||0))) : (((fr.r1||0)+(fr.r2||0)===10)?10:0);
  }
  function setVal(v){
    const bi=active.b, fi=active.f, ri=active.r, fr=boards[bi].frames[fi];
    if(v==='CLR'){ if(ri===0) fr.r1=null; if(ri===1) fr.r2=null; if(ri===2) fr.r3=null; compute(boards[bi]); save(); render(); return; }
    if(v==='X') v=10;
    if(v==='/'){
      if(fi<9 && ri===1 && fr.r1!=null && fr.r1<10) fr.r2=10-fr.r1;
      else if(fi===9){
        if(ri===1 && fr.r1!=null && fr.r1<10) fr.r2=10-fr.r1;
        else if(ri===2 && fr.r1===10 && fr.r2!=null && fr.r2<10) fr.r3=10-fr.r2;
      }
      compute(boards[bi]); save(); advance(); render(); return;
    }
    const n=Math.min(Math.max(0,Number(v)||0), maxFor(fi,ri));
    if(ri===0){ fr.r1=n; if(fi<9 && n===10) fr.r2=null; } else if(ri===1){ fr.r2=n; } else { fr.r3=n; }
    compute(boards[bi]); save(); advance(); render();
  }
  function advance(){
    const bi=active.b, fi=active.f, ri=active.r, fr=boards[bi].frames[fi];
    if(fi<9){ active=(ri===0)?(fr.r1===10?{b:bi,f:fi+1,r:0}:{b:bi,f:fi,r:1}):{b:bi,f:fi+1,r:0}; }
    else{
      if(ri===0) active={b:bi,f:fi,r:1};
      else if(ri===1){ const ok=fr.r1===10||((fr.r1||0)+(fr.r2||0)===10); active={b:bi,f:fi,r:ok?2:1}; }
      else active={b:bi,f:fi,r:2};
    }
  }
  function save(){ localStorage.setItem(LS_KEY, JSON.stringify({boards,active})); }
  function load(){
    try{
      const raw=localStorage.getItem(LS_KEY); if(!raw) return;
      const {boards:bs,active:a}=JSON.parse(raw)||{};
      if(Array.isArray(bs)&&bs.length) boards=bs;
      if(a) active=a;
    }catch{}
  }

  $('#keypad').addEventListener('click',e=>{ const b=e.target.closest('button[data-k]'); if(!b) return; setVal(b.dataset.k); });
  $('#btnAddGame').addEventListener('click',()=>{ boards.push(emptyBoard()); active={b:boards.length-1,f:0,r:0}; save(); render(); });

  setInterval(()=>{ boards.forEach((b,i)=> setText(`timer-${i}`, fmtTime(nowElapsed(b)))); },1000);

  load(); render();
}

/* ========= Ghost 9-Ball ========= */
function initGhost(){
  const LS_KEY = 'ghost9.sessions.v1';

  const ratingBands = {
    5:[{min:0,max:8,rating:1,label:'1 / D / novice'},{min:9,max:14,rating:2,label:'2 / C- novice'},{min:15,max:19,rating:3,label:'3 / C novice'},{min:20,max:23,rating:4,label:'4 / B- novice'},{min:24,max:27,rating:5,label:'5 / C / intermediate'},{min:28,max:31,rating:6,label:'6 intermediate'},{min:32,max:35,rating:7,label:'7 intermediate'},{min:36,max:39,rating:8,label:'8 intermediate'},{min:40,max:44,rating:9,label:'9 intermediate'},{min:45,max:50,rating:10,label:'10 / A / superior'}],
    10:[{min:0,max:16,rating:1,label:'1 / D / novice'},{min:17,max:28,rating:2,label:'2 novice'},{min:29,max:38,rating:3,label:'3 novice'},{min:39,max:46,rating:4,label:'4 novice'},{min:47,max:54,rating:5,label:'5 / C / intermediate'},{min:55,max:62,rating:6,label:'6 intermediate'},{min:63,max:70,rating:7,label:'7 intermediate'},{min:71,max:78,rating:8,label:'8 intermediate'},{min:79,max:88,rating:9,label:'9 intermediate'},{min:89,max:100,rating:10,label:'10 / A / superior'}]
  };

  function emptyRack(){ return { balls:0, scratchBreak:false, breakBalls:0, nineBreak:false, nineMade:false, score:0 }; }
  function emptySession(n=5){ return { date:todayISO(), racks:Array.from({length:n},emptyRack), rackCount:n, total:0, timer:{elapsedMs:0,running:false,lastStart:null} }; }

  let session = emptySession(5);
  let history = loadHistory();

  const elDate=$('#gDate'), elCount=$('#gRackCount'), elBody=$('#gBody'), elTotal=$('#gTotal'), elRating=$('#gRating'), elTimer=$('#gTimer'), elHistory=$('#gHistory');

  const two=n=>String(n).padStart(2,'0');
  const fmt=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return `${two(h)}:${two(m)}:${two(ss)}`;};
  const curElapsed=()=> session.timer.running ? session.timer.elapsedMs + (Date.now()-(session.timer.lastStart||Date.now())) : session.timer.elapsedMs;
  function start(){ if(session.timer.running) return; session.timer.running=true; session.timer.lastStart=Date.now(); saveTemp(); paintTimer(); }
  function pause(){ if(!session.timer.running) return; session.timer.elapsedMs=curElapsed(); session.timer.running=false; session.timer.lastStart=null; saveTemp(); paintTimer(); }
  function stop(){ session.timer.running=false; session.timer.elapsedMs=0; session.timer.lastStart=null; saveTemp(); paintTimer(); }
  function paintTimer(){ if(elTimer) elTimer.textContent=fmt(curElapsed()); }

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function scoreRack(r){
    const balls=clamp(r.balls,0,9), bb=clamp(r.breakBalls,0,9);
    const legal = r.scratchBreak ? Math.max(0, balls - bb) : balls;
    return legal + (r.nineMade ? 1 : 0);
  }

  function compute(){
    session.racks.forEach(r=> r.score=scoreRack(r));
    session.total = session.racks.reduce((s,r)=>s+r.score,0);
    const band = ratingBands[session.rackCount].find(b=>session.total>=b.min && session.total<=b.max);
    if(elTotal) elTotal.textContent=String(session.total);
    if(elRating) elRating.textContent=band?`${band.rating} (${band.label})`:'—';

    const n=session.racks.length;
    const sumBreak=session.racks.reduce((s,r)=>s+clamp(r.breakBalls,0,9),0);
    const scr=session.racks.filter(r=>r.scratchBreak).length;
    const sumLegal=session.racks.reduce((s,r)=>{ const balls=clamp(r.balls,0,9),bb=clamp(r.breakBalls,0,9); return s + (r.scratchBreak ? Math.max(0,balls-bb) : balls); },0);
    const nineRun=session.racks.filter(r=>r.nineMade).length;
    const nineBrk=session.racks.filter(r=>r.nineBreak && !r.scratchBreak).length;
    const runouts=session.racks.filter(r=>{ const balls=clamp(r.balls,0,9),bb=clamp(r.breakBalls,0,9); return (r.scratchBreak ? Math.max(0,balls-bb) : balls)===9; }).length;

    setText('gKpiRacks', n);
    setText('gKpiAvgBreak', n?(sumBreak/n).toFixed(2):'0.00');
    setText('gKpiBreakScr', n?`${Math.round(100*scr/n)}%`:'0%');
    setText('gKpiAvgRun', n?(sumLegal/n).toFixed(2):'0.00');
    setText('gKpiTotalBalls', sumLegal);
    setText('gKpiRunouts', runouts);
    setText('gKpiNines', nineRun);
    setText('gKpiNineBreak', nineBrk);
    setText('gKpiAvgScore', n?(session.total/n).toFixed(2):'0.00');
  }

  function renderRows(){
    if(!elBody) return; elBody.innerHTML='';
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
    r.balls=clamp(r.balls,0,9); r.breakBalls=clamp(r.breakBalls,0,9);
    r.score=scoreRack(r);
    setText(`gScore-${i}`, r.score);
    compute(); saveTemp();
  }
  function wireRows(){
    elBody.addEventListener('input', e=>{
      const i=+e.target.dataset.i;
      if(e.target.classList.contains('gBalls')){ session.racks[i].balls = e.target.value; recalc(i); }
      if(e.target.classList.contains('gBreak')){ session.racks[i].breakBalls = e.target.value; recalc(i); }
    });
    elBody.addEventListener('change', e=>{
      const i=+e.target.dataset.i;
      if(e.target.classList.contains('gScr')){ session.racks[i].scratchBreak = e.target.checked; recalc(i); }
      if(e.target.classList.contains('gNineBrk')){ session.racks[i].nineBreak = e.target.checked; compute(); saveTemp(); }
      if(e.target.classList.contains('gNine')){ session.racks[i].nineMade = e.target.checked; recalc(i); }
    });
  }

  function rateLabel(total, n){
    const band=ratingBands[n].find(b=>total>=b.min && total<=b.max);
    return band?`${band.rating} (${band.label})`:'—';
  }
  function saveHistory(){ localStorage.setItem(LS_KEY, JSON.stringify(history)); }
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ return []; } }
  function saveTemp(){ sessionStorage.setItem('ghost9.current', JSON.stringify(session)); }
  function loadTemp(){ try{ const s=sessionStorage.getItem('ghost9.current'); if(s) session=JSON.parse(s); }catch{} }

  function renderHistory(){
    elHistory.innerHTML='';
    if(!history.length){ elHistory.innerHTML='<p class="subtitle">No saved sessions yet.</p>'; return; }
    history.forEach((s,idx)=>{
      const div=document.createElement('div'); div.className='ghost-card';
      const avg=s.rackCount? (s.total/s.rackCount).toFixed(2) : '0.00';
      div.innerHTML=`<h3>${s.date} — ${s.rackCount} racks</h3>
        <div><strong>Total:</strong> ${s.total} (avg ${avg})</div>
        <div><strong>Rating:</strong> ${rateLabel(s.total, s.rackCount)}</div>
        <div><strong>Racks:</strong> ${s.racks.map(r=>r.score).join(', ')}</div>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button data-act="load" data-i="${idx}" class="tbtn">Load</button>
          <button data-act="delete" data-i="${idx}" class="tbtn stop">Delete</button>
        </div>`;
      elHistory.appendChild(div);
    });
    elHistory.addEventListener('click', e=>{
      const b=e.target.closest('button[data-act]'); if(!b) return;
      const i=+b.dataset.i;
      if(b.dataset.act==='load'){ session=structuredClone(history[i]); paintAll(); }
      if(b.dataset.act==='delete'){ if(confirm('Delete this session?')){ history.splice(i,1); saveHistory(); renderHistory(); } }
    }, { once:true });
  }

  function paintAll(){
    if(elDate) elDate.value=session.date;
    if(elCount) elCount.value=String(session.rackCount);
    renderRows(); wireRows(); compute(); paintTimer();
  }

  // controls
  elDate.addEventListener('change', e=>{ session.date=e.target.value||session.date; saveTemp(); });
  elCount.addEventListener('change', e=>{
    const n=+e.target.value; session.rackCount=n;
    const cur=session.racks.map(r=>structuredClone(r));
    session.racks=Array.from({length:n},(_,i)=>cur[i] ?? emptyRack());
    paintAll(); saveTemp();
  });
  $('.ghost-controls').addEventListener('click', e=>{
    const btn=e.target.closest('button.tbtn'); if(!btn) return;
    if(btn.dataset.act==='start') start();
    if(btn.dataset.act==='pause') pause();
    if(btn.dataset.act==='stop')  stop();
  });
  $('#gNewSession').addEventListener('click', ()=>{ session=emptySession(+elCount.value||5); paintAll(); saveTemp(); });
  $('#gSave').addEventListener('click', ()=>{
    session.racks.forEach((_,i)=>recalc(i));
    history.unshift(structuredClone(session)); saveHistory(); renderHistory();
    alert('Session saved!');
  });

  setInterval(()=>{ if(session.timer.running){ paintTimer(); saveTemp(); } },1000);

  loadTemp(); paintAll(); renderHistory();
}

/* ========= RDS ========= */
function initRDS(){
  const LS_HISTORY='rds.sessions.v1';
  const levels={
    1:{desc:'Optional: 6 balls, pocket OBs directly with no cue ball.',rating:'lower novice'},
    2:{desc:'6 balls, any order, BIH on every shot.',rating:'mid novice'},
    3:{desc:'6 balls, any order, 3 extra BIHs.',rating:'upper novice'},
    4:{desc:'6 balls, any order, 2 extra BIHs.',rating:'lower beginner (D-)'},
    5:{desc:'6 balls, any order, 1 extra BIH.',rating:'mid beginner (D)'},
    6:{desc:'7 balls (3 solids, 3 stripes, 8), 8-ball rules, 1 extra BIH.',rating:'upper beginner (D+)'},
    7:{desc:'9 balls, any order, 1 extra BIH.',rating:'lower intermediate (C-)'},
    8:{desc:'9 balls (4 solids, 4 stripes, 8), 8-ball rules, 1 extra BIH.',rating:'mid intermediate (C)'},
    9:{desc:'15 balls, any order, 2 extra BIHs.',rating:'upper intermediate (C+)'},
    10:{desc:'6 balls, in order (rotation).',rating:'lower advanced (B-)'},
    11:{desc:'15 balls, any order.',rating:'mid advanced (B)'},
    12:{desc:'15 balls, 8-ball rules.',rating:'upper advanced (B+)'},
    13:{desc:'9 balls (4 solids, 4 stripes, 8), 8-ball rules, then remaining in order.',rating:'lower shortstop (A-)'},
    14:{desc:'9 balls, 9-ball rules. 9 early is a win; credit for all balls.',rating:'upper shortstop (A)'},
    15:{desc:'15 balls, 8-ball rules, then remaining in order.',rating:'semipro / pro (A+/AA)'},
    16:{desc:'15 balls, in order (rotation).',rating:'world class pro (A++/AAA)'}
  };
  const emptySession=()=>({ date:todayISO(), level:1, attempts:[null,null,null], log:[], timer:{elapsedMs:0,running:false,lastStart:null} });

  let session=emptySession();
  let history=loadHistory();

  const elDate=$('#rDate'), elStart=$('#rStart'), elLevel=$('#rLevel'), elLevelRating=$('#rLevelRating'), elLevelDesc=$('#rLevelDesc');
  const elAttempts=$('#rAttempts'), elStatus=$('#rStatus'), elLog=$('#rLog'), elHist=$('#rHistory'), elTimer=$('#rTimer');

  (function fill(){ elStart.innerHTML=Array.from({length:16},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join(''); })();

  const two=n=>String(n).padStart(2,'0');
  const fmt=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return `${two(h)}:${two(m)}:${two(ss)}`;};
  const cur=()=> session.timer.running ? session.timer.elapsedMs + (Date.now()-(session.timer.lastStart||Date.now())) : session.timer.elapsedMs;
  function start(){ if(session.timer.running) return; session.timer.running=true; session.timer.lastStart=Date.now(); saveTemp(); paintTimer(); }
  function pause(){ if(!session.timer.running) return; session.timer.elapsedMs=cur(); session.timer.running=false; session.timer.lastStart=null; saveTemp(); paintTimer(); }
  function stop(){ session.timer.running=false; session.timer.elapsedMs=0; session.timer.lastStart=null; saveTemp(); paintTimer(); }
  function paintTimer(){ elTimer.textContent=fmt(cur()); }

  function renderAttempts(){
    elAttempts.innerHTML='';
    for(let i=0;i<3;i++){
      const st=session.attempts[i];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>Attempt ${i+1}</td>
        <td><button class="ok" data-run="${i}">Run</button>
            <button class="bad" data-fail="${i}">Fail</button>
            <span class="subtitle" style="margin-left:8px">${st===true?'✅ Run':st===false?'❌ Fail':'—'}</span></td>`;
      elAttempts.appendChild(tr);
    }
  }
  function earlyAdvanceIfEligible(){
    if(session.attempts[0]===true && session.attempts[1]===true){
      session.log.push({level:session.level, attempts:[...session.attempts], result:'advance'});
      session.level=Math.min(16, session.level+1);
      session.attempts=[null,null,null];
      elStatus.textContent='Auto-advance (2 runs in a row)';
      return true;
    }
    return false;
  }
  function resolveProgress(){
    const filled=session.attempts.filter(a=>a!==null).length;
    if(filled<3){ elStatus.textContent='Waiting for results…'; return null; }
    const wins=session.attempts.filter(Boolean).length;
    let res='stay'; if(wins>=2) res='advance'; if(wins===0) res='drop';
    elStatus.textContent = res==='advance'?'Advance to next level':res==='drop'?'Drop to previous level':'Stay on this level';
    return res;
  }
  function applyResult(res){
    if(!res) return;
    session.log.push({level:session.level, attempts:[...session.attempts], result:res});
    if(res==='advance') session.level=Math.min(16, session.level+1);
    else if(res==='drop') session.level=Math.max(1, session.level-1);
    session.attempts=[null,null,null];
  }

  function renderHeader(){
    const info=levels[session.level]; elLevel.textContent=String(session.level);
    elLevelRating.textContent=info?.rating||'—'; elLevelDesc.textContent=info?.desc||'';
    elStart.value=String(session.level); elDate.value=session.date;
  }
  function renderLog(){
    elLog.innerHTML=''; if(!session.log.length){ elLog.innerHTML='<p class="subtitle">No attempts logged yet.</p>'; return; }
    session.log.slice().reverse().forEach(x=>{
      const d=document.createElement('div'); d.className='rds-card';
      const icon=x.result==='advance'?'⬆️':x.result==='drop'?'⬇️':'➡️';
      const txt=x.attempts.map(a=>a===true?'✅':a===false?'❌':'—').join(' ');
      d.innerHTML=`<strong>Level ${x.level}</strong> — ${icon} ${x.result}<br><span class="subtitle">${txt}</span>`;
      elLog.appendChild(d);
    });
  }
  function saveHistory(){ localStorage.setItem(LS_HISTORY, JSON.stringify(history)); }
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_HISTORY)||'[]'); }catch{ return []; } }
  function renderHistory(){
    elHist.innerHTML=''; if(!history.length){ elHist.innerHTML='<p class="subtitle">No saved sessions.</p>'; return; }
    history.forEach((s,i)=>{
      const d=document.createElement('div'); d.className='rds-card';
      const end=s.log.length ? s.log[s.log.length-1].level : s.level;
      d.innerHTML=`<h3>${s.date}</h3>
        <div><strong>End Level:</strong> ${end}</div>
        <div><strong>Rating:</strong> ${levels[end]?.rating||'—'}</div>
        <div><strong>Attempts:</strong> ${s.log.length}</div>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button data-act="load" data-i="${i}" class="tbtn">Load</button>
          <button data-act="delete" data-i="${i}" class="tbtn stop">Delete</button>
        </div>`;
      elHist.appendChild(d);
    });
    elHist.addEventListener('click', e=>{
      const b=e.target.closest('button[data-act]'); if(!b) return;
      const i=+b.dataset.i;
      if(b.dataset.act==='load'){ session=structuredClone(history[i]); paintAll(); }
      if(b.dataset.act==='delete'){ if(confirm('Delete this session?')){ history.splice(i,1); saveHistory(); renderHistory(); } }
    }, { once:true });
  }

  function saveTemp(){ sessionStorage.setItem('rds.current', JSON.stringify(session)); }
  function loadTemp(){ try{ const s=sessionStorage.getItem('rds.current'); if(s) session=JSON.parse(s); }catch{} }

  function paintAll(){ renderHeader(); renderAttempts(); resolveProgress(); renderLog(); paintTimer(); }

  // wire
  elDate.addEventListener('change', e=>{ session.date=e.target.value||session.date; saveTemp(); });
  elStart.addEventListener('change', e=>{ session.level=+e.target.value; session.attempts=[null,null,null]; saveTemp(); paintAll(); });
  $('.rds-controls').addEventListener('click', e=>{
    const b=e.target.closest('button.tbtn'); if(!b) return;
    if(b.dataset.act==='start') start();
    if(b.dataset.act==='pause') pause();
    if(b.dataset.act==='stop')  stop();
  });
  $('#rNewSession').addEventListener('click', ()=>{ session=emptySession(); paintAll(); saveTemp(); });
  $('#rSaveSession').addEventListener('click', ()=>{
    const res=resolveProgress(); if(res) applyResult(res);
    history.unshift(structuredClone(session)); saveHistory(); renderHistory();
    alert('RDS session saved!');
  });

  elAttempts.addEventListener('click', e=>{
    const run=e.target.closest('button[data-run]'); const fail=e.target.closest('button[data-fail]');
    if(!run && !fail) return;
    const i=+(run?.dataset.run ?? fail?.dataset.fail); session.attempts[i]=!!run;

    if(i===1 && earlyAdvanceIfEligible()){ saveTemp(); paintAll(); return; }

    const res=resolveProgress(); saveTemp(); renderAttempts();
    if(res){ applyResult(res); saveTemp(); paintAll(); } else { paintAll(); }
  });

  setInterval(()=>{ if(session.timer.running){ paintTimer(); saveTemp(); } },1000);

  loadTemp(); paintAll(); renderHistory();
}

/* ============================================================
   3-Ball Run-Out Drill (fixed Run-out? column)
   ============================================================ */
function initThreeBall(){
  const LS_KEY = 'threeball.sessions.v1';

  const clamp = (v, lo, hi) => {
    const n = Number(v);
    if (Number.isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  };

  function emptyAttempt(){ return { cleared: 0 }; }
  function emptySession(level=3, attempts=5){
    return {
      date: todayISO(),
      level: Number(level) || 3,
      attemptsCount: Number(attempts) || 5,
      attempts: Array.from({length: Number(attempts) || 5}, emptyAttempt),
      total: 0
    };
  }

  let session = emptySession(3, 5);
  let history = loadHistory();

  const elDate     = $('#tbDate');
  const elLevel    = $('#tbLevel');
  const elAttempts = $('#tbAttempts');
  const elBody     = $('#tbBody');
  const elTotal    = $('#tbTotal');
  const elFootPct  = $('#tbFootPct');
  const elHist     = $('#tbHistory');

  const kRuns   = $('#tbKpiRuns');
  const kRunPct = $('#tbKpiRunPct');
  const kAvg    = $('#tbKpiAvg');
  const kStreak = $('#tbKpiStreak');

  // Fill levels 3..15 once
  (function fillLevels(){
    if (!elLevel) return;
    elLevel.innerHTML = Array.from({length:13},(_,i)=>`<option value="${i+3}">${i+3}</option>`).join('');
  })();

  function isRun(i){
    const a = session.attempts[i] || { cleared: 0 };
    return Number(a.cleared) === Number(session.level);
  }

  function compute(){
    // normalize & clamp all attempts
    const lvl = Number(session.level);
    session.attempts.forEach(a => { a.cleared = clamp(a.cleared, 0, lvl); });

    // total balls cleared (sum), runs, % etc.
    const total = session.attempts.reduce((s,a)=> s + Number(a.cleared || 0), 0);
    session.total = total;

    const runs = session.attempts.filter((_,i)=> isRun(i)).length;
    const runPct = session.attemptsCount ? (100 * runs / session.attemptsCount) : 0;
    const avg = session.attemptsCount ? (total / session.attemptsCount) : 0;

    // longest streak of runs
    let cur=0, best=0;
    session.attempts.forEach((_,i)=>{
      if (isRun(i)) { cur++; best=Math.max(best,cur); } else { cur=0; }
    });

    if (elTotal)   elTotal.textContent   = String(total);
    if (kRuns)     kRuns.textContent     = String(runs);
    if (kRunPct)   kRunPct.textContent   = `${Math.round(runPct)}%`;
    if (kAvg)      kAvg.textContent      = avg.toFixed(2);
    if (kStreak)   kStreak.textContent   = String(best);
    if (elFootPct) elFootPct.textContent = `${Math.round(runPct)}%`;
  }

  function rowHTML(i){
    const a = session.attempts[i] || { cleared: 0 };
    const lvl = Number(session.level);
    const clearedNum = clamp(a.cleared, 0, lvl);
    const run = clearedNum === lvl;
    return `
      <td>${i+1}</td>
      <td>
        <input type="number" min="0" max="${lvl}" step="1"
               value="${clearedNum}" data-i="${i}" class="tbNum">
      </td>
      <td id="tbRun-${i}" class="tbRun">${run ? '✅' : '❌'}</td>
      <td><strong id="tbClr-${i}">${clearedNum}</strong></td>
    `;
  }

  function renderRows(){
    if (!elBody) return;
    elBody.innerHTML = '';
    for (let i=0; i<session.attemptsCount; i++){
      const tr = document.createElement('tr');
      tr.innerHTML = rowHTML(i);
      elBody.appendChild(tr);
    }
  }

  // Update just one row's run/cleared cells (no full re-render)
  function updateRow(i){
    const lvl = Number(session.level);
    const a = session.attempts[i] || { cleared: 0 };
    const clearedNum = clamp(a.cleared, 0, lvl);
    const run = clearedNum === lvl;

    const runCell = $(`#tbRun-${i}`);
    const clrCell = $(`#tbClr-${i}`);
    if (runCell) runCell.textContent = run ? '✅' : '❌';
    if (clrCell) clrCell.textContent = String(clearedNum);
  }

  function wireRows(){
    if (!elBody) return;
    elBody.addEventListener('input', e=>{
      if (!e.target.classList.contains('tbNum')) return;
      const i = Number(e.target.dataset.i);
      const lvl = Number(session.level);
      const v = clamp(e.target.value, 0, lvl);

      // write back clamped value so UI matches state
      e.target.value = String(v);

      // save & update
      session.attempts[i].cleared = v;
      updateRow(i);
      compute();
    }, { passive: true });
  }

  function saveHistory(){ localStorage.setItem(LS_KEY, JSON.stringify(history)); }
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ return []; } }

  function renderHistory(){
    if(!elHist) return;
    elHist.innerHTML = '';
    if(!history.length){ elHist.innerHTML = '<p class="subtitle">No saved sessions yet.</p>'; return; }

    history.forEach((s,idx)=>{
      const lvl = Number(s.level);
      const total = s.attempts.reduce((acc,a)=> acc + Number(a?.cleared||0), 0);
      const runs = s.attempts.filter(a => Number(a?.cleared||0) === lvl).length;
      const pct = s.attemptsCount ? Math.round(100 * runs / s.attemptsCount) : 0;
      const avg = s.attemptsCount ? (total / s.attemptsCount).toFixed(2) : '0.00';

      let cur=0,best=0;
      s.attempts.forEach(a=>{
        if (Number(a?.cleared||0) === lvl){ cur++; best=Math.max(best,cur); } else cur=0;
      });

      const div=document.createElement('div'); div.className='ghost-card';
      div.innerHTML = `
        <h3>${s.date} — Level ${lvl} • ${s.attemptsCount} attempts</h3>
        <div><strong>Run-outs:</strong> ${runs} (${pct}%)</div>
        <div><strong>Avg Balls:</strong> ${avg}</div>
        <div><strong>Longest Streak:</strong> ${best}</div>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button data-act="load" data-i="${idx}" class="tbtn">Load</button>
          <button data-act="delete" data-i="${idx}" class="tbtn stop">Delete</button>
        </div>
      `;
      elHist.appendChild(div);
    });

    elHist.addEventListener('click', e=>{
      const btn=e.target.closest('button[data-act]'); if(!btn) return;
      const i=+btn.dataset.i;
      if(btn.dataset.act==='load'){ session = structuredClone(history[i]); paintAll(); }
      if(btn.dataset.act==='delete'){ if(confirm('Delete this session?')){ history.splice(i,1); saveHistory(); renderHistory(); } }
    }, { once: true });
  }

  function paintAll(){
    if (elDate)    elDate.value = session.date;
    if (elLevel)   elLevel.value = String(session.level);
    if (elAttempts)elAttempts.value = String(session.attemptsCount);
    renderRows();
    wireRows();
    compute();
  }

  // Controls
  elDate && elDate.addEventListener('change', e=>{
    session.date = e.target.value || session.date;
  });

  elLevel && elLevel.addEventListener('change', e=>{
    const lvl = clamp(e.target.value, 3, 15);
    if (lvl !== session.level){
      session.level = lvl;
      // clamp existing values to new level & repaint
      session.attempts.forEach(a=> a.cleared = clamp(a.cleared, 0, lvl));
      paintAll();
    }
  });

  elAttempts && elAttempts.addEventListener('change', e=>{
    const n = clamp(e.target.value, 1, 100);
    session.attemptsCount = n;
    const cur = session.attempts.map(x=> structuredClone(x));
    session.attempts = Array.from({length:n}, (_,i)=> cur[i] ?? emptyAttempt());
    paintAll();
  });

  // Actions
  $('#tbNew') && $('#tbNew').addEventListener('click', ()=>{
    session = emptySession(Number(elLevel?.value)||3, Number(elAttempts?.value)||20);
    paintAll();
  });
  function doSave(){
    compute();
    history.unshift(structuredClone(session));
    saveHistory();
    renderHistory();
    alert('3-Ball session saved!');
  }
  $('#tbSave')  && $('#tbSave').addEventListener('click', doSave);
  $('#tbSave2') && $('#tbSave2').addEventListener('click', doSave);

  // Boot
  paintAll();
  renderHistory();
}
