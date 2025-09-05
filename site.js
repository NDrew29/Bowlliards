// Multiple boards on one page. One shared keypad edits the currently selected mini.
// Bowling-style scoring (Bowlliards): strike adds next two rolls; spare adds next roll.
// Global KPI cards + per-board Game Timer (Start / Pause / Stop).

const $  = (q,root=document)=>root.querySelector(q);
const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));
const todayISO = ()=>{const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10);};

function emptyFrame(){ return { r1:null, r2:null, r3:null, cumul:0 }; }
function emptyBoard(){
  return {
    date: todayISO(),
    frames: Array.from({length:10}, emptyFrame),
    total: 0,
    timer: { elapsedMs: 0, running: false, lastStart: null }
  };
}
let boards = [emptyBoard()];

// Which mini is active {b:boardIndex,f:frameIndex,r:rollIndex}
let active = { b:0, f:0, r:0 };

// ---------- Scoring ----------
function rollsFor(frames){
  const rolls=[];
  for(let f=0;f<9;f++){
    const {r1,r2} = frames[f];
    if(r1==null) break;
    if(r1===10) rolls.push(10);
    else { rolls.push(r1); if(r2!=null) rolls.push(r2); }
  }
  const F = frames[9];
  if(F.r1!=null){ rolls.push(F.r1); if(F.r2!=null) rolls.push(F.r2); if(F.r3!=null) rolls.push(F.r3); }
  return rolls;
}
function computeBoard(b){
  const frames = b.frames;
  const rolls = rollsFor(frames);
  let i=0, cum=0;
  for(let f=0;f<10;f++){
    if(i>=rolls.length){ frames[f].cumul=cum; continue; }
    const r1 = rolls[i];
    let score = 0;
    if(f<9){
      if(r1===10){ score = 10 + (rolls[i+1]||0) + (rolls[i+2]||0); i+=1; }
      else { const r2=rolls[i+1]||0, sum=r1+r2; score = (sum===10)? 10 + (rolls[i+2]||0) : sum; i+=2; }
    }else{
      const r2=rolls[i+1]||0, r3=rolls[i+2]||0; score = r1+r2+r3; i = rolls.length;
    }
    cum += score; frames[f].cumul = cum;
  }
  b.total = cum;
}

// ---------- Global KPIs ----------
function computeGlobalStats(){
  let r1Sum=0, r1Cnt=0;
  let r2Sum=0, r2Cnt=0;
  let frameSum=0, frameCnt=0;
  let gameSum=0, gameCnt=0;
  let totalBalls=0;

  // strike/spare/open across frames that have r1 (i.e., started frames)
  let startedFrames=0, strikeFrames=0, spareFrames=0, openFrames=0;

  boards.forEach(b=>{
    let gameRaw=0, anyFrame=false;
    b.frames.forEach((fr,fi)=>{
      const started = fr.r1!=null;
      if(started){
        startedFrames++;
        anyFrame=true;
        // per-frame raw total (r3 only counts in 10th)
        const raw = (fr.r1||0) + (fr.r2||0) + (fi===9 ? (fr.r3||0) : 0);
        frameSum += raw; frameCnt++;
        totalBalls += raw;

        // strike/spare/open classification (bowling-style)
        if(fr.r1===10) strikeFrames++;
        else if((fr.r1||0)+(fr.r2||0)===10) spareFrames++;
        else openFrames++;
      }

      if(fr.r1!=null){ r1Cnt++; r1Sum += fr.r1; }
      if(fr.r2!=null){ r2Cnt++; r2Sum += fr.r2; }

      gameRaw += (fr.r1||0)+(fr.r2||0)+(fi===9?(fr.r3||0):0);
    });
    if(anyFrame){ gameCnt++; gameSum += gameRaw; }
  });

  const avgR1       = r1Cnt ? (r1Sum/r1Cnt) : 0;
  const avgR2       = r2Cnt ? (r2Sum/r2Cnt) : 0;
  const avgPerFrame = frameCnt ? (frameSum/frameCnt) : 0;
  const avgPerGame  = gameCnt ? (gameSum/gameCnt) : 0;

  const strikePct = startedFrames ? (100*strikeFrames/startedFrames) : 0;
  const sparePct  = startedFrames ? (100*spareFrames/startedFrames) : 0;
  const openPct   = startedFrames ? (100*openFrames/startedFrames)   : 0;

  $('#stat-avg-r1').textContent     = avgR1.toFixed(2);
  $('#stat-avg-r2').textContent     = avgR2.toFixed(2);
  $('#stat-avg-frame').textContent  = avgPerFrame.toFixed(2);
  $('#stat-avg-game').textContent   = avgPerGame.toFixed(2);
  $('#stat-total-balls').textContent= totalBalls.toString();
  $('#stat-strike-pct').textContent = strikePct.toFixed(0) + '%';
  $('#stat-spare-pct').textContent  = sparePct.toFixed(0) + '%';
  $('#stat-open-pct').textContent   = openPct.toFixed(0) + '%';
}

// ---------- Render ----------
function markSymbol(fr, idx, isTenth){
  const v = idx===0 ? fr.r1 : idx===1 ? fr.r2 : fr.r3;
  if(v==null) return '';
  if(!isTenth){
    if(idx===0 && v===10) return 'X';
    if(idx===1 && (fr.r1||0)+(fr.r2||0)===10) return '/';
    return String(v);
  } else {
    if(idx===0) return v===10 ? 'X' : String(v);
    if(idx===1){
      if(fr.r1===10) return v===10 ? 'X' : String(v);
      return (fr.r1||0)+(fr.r2||0)===10 ? '/' : String(v);
    }
    // idx 2
    if(fr.r1===10){
      if(fr.r2===10) return v===10 ? 'X' : String(v);
      return (fr.r2||0)+(fr.r3||0)===10 ? '/' : String(v);
    }
    return (fr.r1||0)+(fr.r2||0)===10 ? (v===10?'X':String(v)) : '';
  }
}

function fmtTime(ms){
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const ss= s%60;
  const two = n=>String(n).padStart(2,'0');
  return `${two(h)}:${two(m)}:${two(ss)}`;
}

function render(){
  const host = $('#boards');
  host.innerHTML = '';

  boards.forEach((b, bi)=>{
    computeBoard(b);

    // header (date + timer + total)
    const header = document.createElement('div');
    header.className = 'board-header';

    const dateWrap = document.createElement('div');
    dateWrap.innerHTML = `
      <span class="label">Game Date:</span>
      <input type="date" value="${b.date}" data-bi="${bi}" />
    `;
    const input = $('input', dateWrap);
    input.addEventListener('change', (e)=>{ b.date = e.target.value || b.date; });

    const timer = document.createElement('div');
    timer.className = 'timer';
    timer.innerHTML = `
      <span class="display" id="timer-${bi}">${fmtTime(currentElapsed(b))}</span>
      <button class="tbtn start" data-action="start" data-bi="${bi}">Start</button>
      <button class="tbtn pause" data-action="pause" data-bi="${bi}">Pause</button>
      <button class="tbtn stop"  data-action="stop"  data-bi="${bi}">Stop</button>
    `;

    const totals = document.createElement('div');
    totals.className = 'totals';
    totals.innerHTML = `Total: <span id="total-${bi}">${b.total}</span>`;

    header.appendChild(dateWrap);
    header.appendChild(timer);
    header.appendChild(totals);

    // table
    const table = document.createElement('table');
    table.className = 'frames-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th></th>
          <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
          <th>6</th><th>7</th><th>8</th><th>9</th><th>10</th>
          <th>Max Possible</th><th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-rolls">
          <td>Rolls</td>
          ${Array.from({length:10},(_,i)=>`<td><div class="frame ${i===9?'tenth':''}" data-bi="${bi}" data-fi="${i}"></div></td>`).join('')}
          <td rowspan="2" class="totals-col"><strong>300</strong></td>
          <td rowspan="2" class="totals-col"><div id="grand-${bi}">${b.total}</div></td>
        </tr>
        <tr class="row-cum">
          <td>0</td>
          ${Array.from({length:10},(_,i)=>`<td id="cum-${bi}-${i}">0</td>`).join('')}
        </tr>
      </tbody>
    `;

    const boardEl = document.createElement('section');
    boardEl.className = 'board';
    boardEl.appendChild(header);
    boardEl.appendChild(table);
    host.appendChild(boardEl);

    // Minis
    const framesEls = $$('.frame', table);
    framesEls.forEach((frameEl)=>{
      const fi = +frameEl.dataset.fi;
      const fr = b.frames[fi];
      frameEl.innerHTML = '';
      const count = fi===9 ? 3 : 2;
      for(let r=0;r<count;r++){
        const mini = document.createElement('div');
        mini.className = 'mini';
        mini.dataset.bi = String(bi);
        mini.dataset.fi = String(fi);
        mini.dataset.ri = String(r);
        mini.textContent = markSymbol(fr, r, fi===9);
        // 10th eligibility for r3
        if(fi===9 && r===2){
          const eligible = fr.r1===10 || ((fr.r1||0)+(fr.r2||0)===10);
          if(!eligible) mini.classList.add('disabled');
        }
        if(active.b===bi && active.f===fi && active.r===r) mini.classList.add('selected');
        mini.addEventListener('click', ()=>{
          active = { b: bi, f: fi, r: r };
          render();
          mini.scrollIntoView({block:'nearest', inline:'center'});
        });
        frameEl.appendChild(mini);
      }
    });

    // fill cumulative cells and totals
    b.frames.forEach((fr, i)=>{ $(`#cum-${bi}-${i}`).textContent = fr.cumul; });
    $(`#grand-${bi}`).textContent = b.total;
    $(`#total-${bi}`).textContent = b.total;

    // attach timer controls
    header.addEventListener('click', (e)=>{
      const btn = e.target.closest('button.tbtn');
      if(!btn) return;
      const i = +btn.dataset.bi;
      const action = btn.dataset.action;
      if(action==='start') startTimer(boards[i]);
      if(action==='pause') pauseTimer(boards[i]);
      if(action==='stop')  stopTimer(boards[i]);
      paintTimer(i);
    });
  });

  computeGlobalStats();
}

// ---------- Edits ----------
function maxFor(bi, fi, ri){
  const fr = boards[bi].frames[fi];
  if(fi<9){
    if(ri===0) return 10;
    return Math.max(0, 10 - (fr.r1||0));
  }else{
    if(ri===0) return 10;
    if(ri===1) return fr.r1===10 ? 10 : Math.max(0, 10 - (fr.r1||0));
    if(fr.r1===10) return fr.r2===10 ? 10 : Math.max(0, 10 - (fr.r2||0));
    return ((fr.r1||0)+(fr.r2||0)===10) ? 10 : 0;
  }
}

function setValue(value){
  const {b:bi,f:fi,r:ri} = active;
  const fr = boards[bi].frames[fi];

  if(value==='CLR'){
    if(ri===0) fr.r1=null;
    if(ri===1) fr.r2=null;
    if(ri===2) fr.r3=null;
    computeBoard(boards[bi]); render(); return;
  }

  if(value==='X'){ value=10; }
  if(value==='/'){
    if(fi<9 && ri===1 && fr.r1!=null && fr.r1<10){
      fr.r2 = 10 - fr.r1;
    }else if(fi===9){
      if(ri===1 && fr.r1!=null && fr.r1<10){ fr.r2 = 10 - fr.r1; }
      else if(ri===2 && fr.r1===10 && fr.r2!=null && fr.r2<10){ fr.r3 = 10 - fr.r2; }
    }
    computeBoard(boards[bi]); render(); autoAdvance(); return;
  }

  const n = Number(value);
  if(Number.isNaN(n)) return;

  const max = maxFor(bi,fi,ri);
  const v = Math.min(Math.max(0,n), max);
  if(ri===0){
    fr.r1 = v;
    if(fi<9 && v===10) fr.r2 = null; // strike wipes second box
  }else if(ri===1){ fr.r2 = v; }
  else{ fr.r3 = v; }

  computeBoard(boards[bi]); render(); autoAdvance();
}

function autoAdvance(){
  const {b:bi,f:fi,r:ri} = active;
  const fr = boards[bi].frames[fi];
  if(fi<9){
    if(ri===0){
      if(fr.r1===10) active = {b:bi, f:fi+1, r:0};
      else active = {b:bi, f:fi, r:1};
    }else{
      active = {b:bi, f:fi+1, r:0};
    }
  }else{
    if(ri===0){ active = {b:bi, f:fi, r:1}; }
    else if(ri===1){
      const allowR3 = fr.r1===10 || ((fr.r1||0)+(fr.r2||0)===10);
      active = {b:bi, f:fi, r: allowR3 ? 2 : 1};
    }else{
      active = {b:bi, f:fi, r:2};
    }
  }
  render();
}

// ---------- Timer logic ----------
function currentElapsed(b){
  if(!b.timer.running) return b.timer.elapsedMs;
  return b.timer.elapsedMs + (Date.now() - (b.timer.lastStart||Date.now()));
}
function startTimer(b){
  if(b.timer.running) return;
  b.timer.running = true;
  b.timer.lastStart = Date.now();
}
function pauseTimer(b){
  if(!b.timer.running) return;
  b.timer.elapsedMs = currentElapsed(b);
  b.timer.running = false;
  b.timer.lastStart = null;
}
function stopTimer(b){
  b.timer.running = false;
  b.timer.elapsedMs = 0;
  b.timer.lastStart = null;
}
function paintTimer(bi){
  const b = boards[bi];
  const el = $(`#timer-${bi}`);
  if(el) el.textContent = fmtTime(currentElapsed(b));
}

// tick all timers once per second
setInterval(()=>{
  boards.forEach((_,i)=>paintTimer(i));
}, 1000);

// ---------- Events ----------
$('#keypad').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-k]');
  if(!btn) return;
  setValue(btn.dataset.k);
});

$('#btnAddGame').addEventListener('click', ()=>{
  boards.push(emptyBoard());
  active = { b: boards.length-1, f:0, r:0 };
  render();
});

// ---------- Boot ----------
window.addEventListener('DOMContentLoaded', ()=>{
  render();
});
