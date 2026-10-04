const FILES="abcdefgh";
const glyph={wp:"♙",wn:"♘",wb:"♗",wr:"♖",wq:"♕",wk:"♔",bp:"♟",bn:"♞",bb:"♝",br:"♜",bq:"♛",bk:"♚"};
const RULES_URL="https://handbook.fide.com/chapter/E012023";
let S={board:[],turn:"w",castle:"KQkq",ep:-1,half:0,full:1};
let history=[],positionHistory=[],selected=-1,flipped=false,lastMove=null,moves=[],trainer=false,trainerExpected=null,trainerActive=false,pendingPromotion=null,gameOver=false,botSide="b",botThinking=false;

const boardEl=document.querySelector("#board"),depth=document.querySelector("#depth");
const resultEl=document.querySelector("#gameResult");

function start(){
  S={board:Array(64).fill(null),turn:"w",castle:"KQkq",ep:-1,half:0,full:1};
  const back=["r","n","b","q","k","b","n","r"];
  for(let x=0;x<8;x++){S.board[x]=`w${back[x]}`;S.board[8+x]="wp";S.board[48+x]="bp";S.board[56+x]=`b${back[x]}`;}
  history=[];positionHistory=[positionKey(S)];moves=[];selected=-1;lastMove=null;pendingPromotion=null;gameOver=false;
  if(resultEl)resultEl.textContent="";
  botThinking=false;
  draw();engine.init();
}
function rc(i){return[Math.floor(i/8),i%8]}
function ix(r,c){return r*8+c}
function inside(r,c){return r>=0&&r<8&&c>=0&&c<8}
function color(p){return p?.[0]}
function type(p){return p?.[1]}
function opponent(c){return c==="w"?"b":"w"}

function attacks(b,from,to){
  const p=b[from];if(!p)return false;
  const t=type(p),[r,c]=rc(from),[R,C]=rc(to),dr=R-r,dc=C-c;
  if(t==="p")return color(p)==="w"?dr===1&&Math.abs(dc)===1:dr===-1&&Math.abs(dc)===1;
  if(t==="n")return[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].some(([a,d])=>a===dr&&d===dc);
  if(t==="k")return Math.max(Math.abs(dr),Math.abs(dc))===1;
  if((t==="b"||t==="q")&&Math.abs(dr)===Math.abs(dc)||(t==="r"||t==="q")&&(dr===0||dc===0)){
    const sr=Math.sign(dr),sc=Math.sign(dc);let rr=r+sr,cc=c+sc;
    while(rr!==R||cc!==C){if(b[ix(rr,cc)])return false;rr+=sr;cc+=sc}
    return true;
  }
  return false;
}
function squareAttacked(b,sq,by){for(let i=0;i<64;i++)if(color(b[i])===by&&attacks(b,i,sq))return true;return false}
function inCheck(b,col){const k=b.findIndex(p=>p===`${col}k`);return k>=0&&squareAttacked(b,k,opponent(col))}

function pseudo(s,from){
  const b=s.board,p=b[from],col=color(p),t=type(p),[r,c]=rc(from),out=[];
  if(!p)return out;
  const add=(R,C,extra={})=>{
    if(!inside(R,C))return;
    const to=ix(R,C);
    if(b[to]?.[1]==="k")return; // kings are never captured
    if(!b[to]||color(b[to])!==col)out.push({from,to,...extra});
  };
  if(t==="p"){
    const d=col==="w"?1:-1,R=r+d;
    if(inside(R,c)&&!b[ix(R,c)]){
      out.push({from,to:ix(R,c),promotion:(R===0||R===7)?null:null});
      if((col==="w"?r===1:r===6)&&!b[ix(r+2*d,c)])out.push({from,to:ix(r+2*d,c),promotion:null});
    }
    for(const dc of[-1,1]){
      const C=c+dc;if(!inside(R,C))continue;
      const to=ix(R,C);
      if((b[to]&&color(b[to])!==col&&type(b[to])!=="k")||to===s.ep)out.push({from,to,enpassant:to===s.ep,promotion:null});
    }
  }
  if(t==="n")for(const[a,d]of[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]])add(r+a,c+d);
  if(t==="b"||t==="r"||t==="q"){
    const dirs=[];
    if(t==="b"||t==="q")dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
    if(t==="r"||t==="q")dirs.push([1,0],[-1,0],[0,1],[0,-1]);
    for(const[dR,dC]of dirs){
      let R=r+dR,C=c+dC;
      while(inside(R,C)){
        const to=ix(R,C);
        if(!b[to])out.push({from,to});
        else{if(color(b[to])!==col&&type(b[to])!=="k")out.push({from,to});break}
        R+=dR;C+=dC;
      }
    }
  }
  if(t==="k"){
    for(let dR=-1;dR<=1;dR++)for(let dC=-1;dC<=1;dC++)if(dR||dC)add(r+dR,c+dC);
    if(!inCheck(b,col)){
      const enemy=opponent(col),ks=col==="w"?"K":"k",qs=col==="w"?"Q":"q";
      if((col==="w"&&from===4)||(col==="b"&&from===60)){
        const rk=from+3,rq=from-4;
        if(s.castle.includes(ks)&&b[rk]===col+"r"&&!b[from+1]&&!b[from+2]&&!squareAttacked(b,from+1,enemy)&&!squareAttacked(b,from+2,enemy))out.push({from,to:from+2,castle:true});
        if(s.castle.includes(qs)&&b[rq]===col+"r"&&!b[from-1]&&!b[from-2]&&!b[from-3]&&!squareAttacked(b,from-1,enemy)&&!squareAttacked(b,from-2,enemy))out.push({from,to:from-2,castle:true});
      }
    }
  }
  return out;
}
function clone(s){return{board:[...s.board],turn:s.turn,castle:s.castle,ep:s.ep,half:s.half,full:s.full}}
function make(s,m){
  const n=clone(s),p=n.board[m.from],col=color(p),capt=n.board[m.to];
  n.board[m.to]=p;n.board[m.from]=null;
  if(m.enpassant)n.board[m.to+(col==="w"?-8:8)]=null;
  if(m.castle){const rf=m.to>m.from?m.from+3:m.from-4,rt=m.to>m.from?m.from+1:m.from-1;n.board[rt]=n.board[rf];n.board[rf]=null}
  if(m.promotion)n.board[m.to]=col+m.promotion;
  n.ep=-1;
  if(type(p)==="p"&&Math.abs(m.to-m.from)===16)n.ep=(m.to+m.from)/2;
  if(type(p)==="k")n.castle=n.castle.replace(col==="w"?/[KQ]/g:/[kq]/g,"");
  if(type(p)==="r"){
    if(m.from===0)n.castle=n.castle.replace("Q","");
    if(m.from===7)n.castle=n.castle.replace("K","");
    if(m.from===56)n.castle=n.castle.replace("q","");
    if(m.from===63)n.castle=n.castle.replace("k","");
  }
  if(capt==="wr"&&m.to===0)n.castle=n.castle.replace("Q","");
  if(capt==="wr"&&m.to===7)n.castle=n.castle.replace("K","");
  if(capt==="br"&&m.to===56)n.castle=n.castle.replace("q","");
  if(capt==="br"&&m.to===63)n.castle=n.castle.replace("k","");
  n.half=(type(p)==="p"||capt||m.enpassant)?0:n.half+1;
  if(col==="b")n.full++;
  n.turn=opponent(col);
  return n;
}
function legal(s,from){return pseudo(s,from).filter(m=>!inCheck(make(s,m).board,color(s.board[from])))}
function allLegal(s){let a=[];for(let i=0;i<64;i++)if(color(s.board[i])===s.turn)a.push(...legal(s,i));return a}
function uci(m){const a=rc(m.from),b=rc(m.to);return FILES[a[1]]+(a[0]+1)+FILES[b[1]]+(b[0]+1)+(m.promotion||"")}
function san(m,before,after){
  const p=before.board[m.from],capture=!!before.board[m.to]||m.enpassant;
  if(m.castle)return m.to>m.from?"O-O":"O-O-O";
  let base=type(p)==="p"?(capture?FILES[rc(m.from)[1]]:""):type(p).toUpperCase();
  if(type(p)!=="p"){
    const same=allLegal(before).filter(x=>x.to===m.to&&x.from!==m.from&&type(before.board[x.from])===type(p));
    if(same.length)base+=FILES[rc(m.from)[1]];
  }
  if(capture)base+="x";
  base+=FILES[rc(m.to)[1]]+(8-rc(m.to)[0]);
  if(m.promotion)base+="="+m.promotion.toUpperCase();
  if(inCheck(after.board,after.turn))base+=allLegal(after).length?"+":"#";
  return base;
}
function positionKey(s){
  const board=s.board.map(p=>p||"").join(",");
  return board+"|"+s.turn+"|"+(s.castle||"-")+"|"+(s.ep<0?"-":s.ep);
}
function repetitionCount(s){const k=positionKey(s);return positionHistory.filter(x=>x===k).length}
function deadPosition(s){
  const pieces=s.board.filter(Boolean);
  if(pieces.some(p=>["p","r","q"].includes(type(p))))return false;
  const bishops=pieces.filter(p=>type(p)==="b");
  const knights=pieces.filter(p=>type(p)==="n");
  if(bishops.length===0&&knights.length===0)return true;
  if(pieces.length===3&&(bishops.length===1||knights.length===1))return true;
  if(bishops.length>0&&knights.length===0){
    const colors=bishops.map((_,i)=>{const sq=s.board.findIndex((p,j)=>p===bishops[i]&&j>=0);const [r,c]=rc(sq);return(r+c)%2});
    if(colors.every(v=>v===colors[0]))return true;
  }
  return false;
}
function finishState(){
  const legalNow=allLegal(S), check=inCheck(S.board,S.turn);
  if(!legalNow.length){gameOver=true;return check?"Checkmate":"Stalemate";}
  if(deadPosition(S)){gameOver=true;return"Draw — dead position";}
  if(repetitionCount(S)>=5){gameOver=true;return"Draw — fivefold repetition";}
  if(S.half>=150){gameOver=true;return"Draw — 75-move rule";}
  return check?"Check":"Ready";
}
function draw(){
  boardEl.innerHTML="";
  for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++){
    const r=flipped?rr:7-rr,c=flipped?7-cc:cc,i=ix(r,c),el=document.createElement("div");
    el.className="sq "+((r+c)%2?"dark":"light");
    if(lastMove&&(i===lastMove.from||i===lastMove.to))el.classList.add("last");
    if(i===selected)el.classList.add("selected");
    if(selected>=0&&legal(S,selected).some(m=>m.to===i))el.classList.add(S.board[i]?"capture":"legal");
    const rank=document.createElement("span");rank.className="coord rank";rank.textContent=8-r;
    const file=document.createElement("span");file.className="coord file";file.textContent=FILES[c];
    if(S.board[i]){const sp=document.createElement("span");sp.className="piece "+(color(S.board[i])==="w"?"white-piece":"black-piece");sp.textContent=glyph[S.board[i]];el.appendChild(sp)}
    el.append(rank,file);el.onclick=()=>clickSq(i);boardEl.appendChild(el);
  }
  document.querySelector("#turnLabel").textContent=(S.turn==="w"?"White":"Black")+" to move";
  const status=finishState();
  document.querySelector("#statusLabel").textContent=status;
  document.querySelector("#moves").innerHTML=moves.map((m,i)=>`<div class="move"><b>${Math.floor(i/2)+1}${i%2?".":"..."}</b> ${m}</div>`).join("");
  const claim3=repetitionCount(S)>=3,claim50=S.half>=100;
  document.querySelector("#claim3Btn").disabled=!claim3||gameOver;
  document.querySelector("#claim50Btn").disabled=!claim50||gameOver;
  if(resultEl)resultEl.textContent=gameOver?status:"";
}
function openPromotion(m){
  pendingPromotion=m;const box=document.querySelector("#promotion");box.hidden=false;
  document.querySelectorAll("#promotion button").forEach(b=>b.onclick=()=>{const p=b.dataset.piece;box.hidden=true;pendingPromotion=null;move({...m,promotion:p})});
}
function clickSq(i){
  if(gameOver||botThinking||S.turn===botSide)return;
  if(selected<0){if(color(S.board[i])===S.turn){selected=i;draw()}return}
  const candidates=legal(S,selected).filter(m=>m.to===i);
  if(candidates.length){
    const m=candidates[0],p=S.board[m.from],[,r]=rc(m.to);
    if(type(p)==="p"&&(r===0||r===7)){openPromotion(m);return}
    move(m);
  }else{selected=color(S.board[i])===S.turn?i:-1;draw()}
}
function move(m){
  if(gameOver)return;
  const before=clone(S),played=uci(m);
  if(trainerActive&&trainerExpected){
    const result=document.querySelector("#trainerResult");
    if(played===trainerExpected){result.textContent="✓ Correct — Stockfish agrees.";result.className="trainer-result good"}
    else{result.textContent=`Not the engine move. Best was ${trainerExpected}. Try again.`;result.className="trainer-result bad";selected=-1;draw();return}
    trainerActive=false;trainerExpected=null;
  }
  S=make(S,m);history.push(before);positionHistory.push(positionKey(S));lastMove=m;selected=-1;
  moves.push(san(m,before,S));draw();
  if(!gameOver&&S.turn===botSide){setTimeout(()=>engine.playBot(),80)}
  else engine.analyze(fen(),Number(depth.value));
}
function findLegalUci(u){
  const list=allLegal(S);
  return list.find(m=>uci(m)===u)||null;
}
function applyBotUci(u){
  const m=findLegalUci(u);
  if(!m){
    botThinking=false;
    document.querySelector("#engineStatus").textContent="Engine returned an illegal move — restarting…";
    engine.restart();
    return false;
  }
  const before=clone(S);
  S=make(S,m);history.push(before);positionHistory.push(positionKey(S));lastMove=m;selected=-1;
  moves.push(san(m,before,S));botThinking=false;draw();
  if(!gameOver)engine.analyze(fen(),Number(depth.value));
  return true;
}
function fen(){
  let rows=[];
  for(let r=7;r>=0;r--){let row="",empty=0;
    for(let c=0;c<8;c++){const p=S.board[ix(r,c)];if(!p)empty++;else{if(empty){row+=empty;empty=0}const q=type(p);row+=color(p)==="w"?q.toUpperCase():q}}
    if(empty)row+=empty;rows.push(row);
  }
  return rows.join("/")+" "+S.turn+" "+(S.castle||"-")+" "+(S.ep<0?"-":FILES[rc(S.ep)[1]]+(8-rc(S.ep)[0]))+" "+S.half+" "+S.full;
}
function claimDraw(kind){
  if(gameOver)return;
  if(kind==="threefold"&&repetitionCount(S)>=3){gameOver=true;resultEl.textContent="Draw claimed — threefold repetition.";draw()}
  if(kind==="fifty"&&S.half>=100){gameOver=true;resultEl.textContent="Draw claimed — 50-move rule.";draw()}
}

const engine={
  worker:null,ready:false,starting:false,timer:null,searchFen:"",searchNo:0,requestKind:"analysis",
  init(){
    if(this.worker)return;
    this.starting=true;
    try{this.worker=new Worker("stockfish-worker.js")}catch(e){
      document.querySelector("#engineStatus").textContent="Worker unavailable";return
    }
    this.worker.onmessage=e=>this.onmsg(e.data);
    this.worker.onerror=()=>{
      clearTimeout(this.timer);this.starting=false;botThinking=false;
      document.querySelector("#engineStatus").textContent="Engine error — restarting…";
      setTimeout(()=>this.restart(),800)
    };
    this.worker.onmessageerror=()=>{
      document.querySelector("#engineStatus").textContent="Engine message error — restarting…";
      setTimeout(()=>this.restart(),800)
    };
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{
      if(!this.ready){
        document.querySelector("#engineStatus").textContent="Stockfish timed out — restarting…";
        this.restart()
      }
    },20000);
    document.querySelector("#engineStatus").textContent="Loading Stockfish 19 Lite…";
    this.worker.postMessage("uci");
  },
  restart(){
    clearTimeout(this.timer);
    try{this.worker?.terminate()}catch{}
    this.worker=null;this.ready=false;this.starting=false;botThinking=false;
    this.init()
  },
  onmsg(d){
    if(typeof d!=="string")return;
    if(d==="uciok"){
      this.worker.postMessage("isready")
    }else if(d==="readyok"){
      clearTimeout(this.timer);this.ready=true;this.starting=false;
      document.querySelector("#engineStatus").textContent="Ready — Stockfish 19 Lite";
      if(S.turn===botSide) this.playBot(); else this.analyze(fen(),Number(depth.value));
    }else if(d.startsWith("info")&&d.includes(" score ")){
      const m=d.match(/score (cp|mate) (-?\d+)/),pv=d.match(/ pv (.+)$/);
      if(m){
        const raw=Number(m[2]),sign=S.turn==="w"?1:-1;
        if(m[1]==="mate"){
          const mate=raw*sign;
          document.querySelector("#evalText").textContent=(mate>0?"+M":"-M")+Math.abs(mate)
        }else{
          const v=Math.max(-99,Math.min(99,raw*sign/100));
          document.querySelector("#evalText").textContent=(v>0?"+":"")+v.toFixed(2);
          document.querySelector("#evalFill").style.height=(50+Math.max(-50,Math.min(50,v*8)))+"%"
        }
      }
      if(pv)document.querySelector("#bestMove").textContent=pv[1].split(" ")[0];
    }else if(d.startsWith("bestmove ")){
      const bm=d.split(/\s+/)[1]||"";
      if(this.requestKind==="bot"&&this.searchFen===fen()&&S.turn===botSide&&!gameOver){
        document.querySelector("#engineStatus").textContent="Stockfish chose "+bm;
        applyBotUci(bm);
        return;
      }
      if(trainerActive&&this.searchFen===fen())trainerExpected=bm;
      document.querySelector("#engineStatus").textContent="Ready — search complete";
    }else if(d.startsWith("error ")){
      botThinking=false;
      document.querySelector("#engineStatus").textContent=d.slice(6);
    }
  },
  analyze(f,d){
    if(!this.ready||gameOver||botThinking)return;
    this.requestKind="analysis";this.searchNo++;this.searchFen=f;
    this.worker.postMessage("stop");
    this.worker.postMessage("position fen "+f);
    this.worker.postMessage("go depth "+Math.max(8,Math.min(24,d||16)));
  },
  playBot(){
    if(!this.ready||gameOver||S.turn!==botSide||botThinking)return;
    botThinking=true;this.requestKind="bot";this.searchNo++;this.searchFen=fen();
    document.querySelector("#engineStatus").textContent="Stockfish is thinking…";
    this.worker.postMessage("stop");
    this.worker.postMessage("position fen "+this.searchFen);
    this.worker.postMessage("go depth "+Math.max(8,Math.min(24,Number(depth.value)||16)));
  }
};;
function initUI(){
  const q=s=>document.querySelector(s);
  q("#resetBtn")?.addEventListener("click",start);
  q("#undoBtn")?.addEventListener("click",()=>{
    if(botThinking||!history.length)return;
    if(botSide&&S.turn===botSide&&history.length>=2){
      history.pop(); positionHistory.pop(); moves.pop();
      S=history.pop(); positionHistory.pop(); moves.pop();
    }else{
      S=history.pop(); positionHistory.pop(); moves.pop();
    }
    lastMove=null;
    gameOver=false;
    selected=-1;
    draw();
    if(S.turn!==botSide)engine.analyze(fen(),Number(depth.value));
  });
  q("#rulesLink")?.setAttribute("href",RULES_URL);
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    const enginePanel=q("#enginePanel"),trainerPanel=q("#trainerPanel");
    const trainer=t.dataset.panel==="trainer";
    enginePanel.hidden=trainer;trainerPanel.hidden=!trainer;
  }));
  q("#flipBtn")?.addEventListener("click",()=>{flipped=!flipped;draw()});
  q("#fenBtn")?.addEventListener("click",()=>navigator.clipboard?.writeText(fen()).then(()=>q("#engineStatus").textContent="FEN copied"));
  q("#claim3Btn")?.addEventListener("click",()=>claimDraw("threefold"));
  q("#claim50Btn")?.addEventListener("click",()=>claimDraw("fifty"));
  q("#analyzeBtn")?.addEventListener("click",()=>engine.analyze(fen(),Number(depth.value)));
  q("#botSide")?.addEventListener("change",e=>{botSide=e.target.value;start()});
  document.querySelectorAll(".nav").forEach(n=>n.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));n.classList.add("active");
    const mode=n.dataset.mode,course=q("#courseView"),content=q(".content");
    if(mode==="courses"){content.hidden=true;course.hidden=false;q("#pageTitle").textContent="Courses"}
    else{content.hidden=false;course.hidden=true;q("#pageTitle").textContent=mode[0].toUpperCase()+mode.slice(1)}
  }));
  document.querySelectorAll(".opening-tab").forEach(tab=>tab.addEventListener("click",()=>{
    document.querySelectorAll(".opening-tab").forEach(x=>x.classList.remove("active"));
    tab.classList.add("active");
    const key=tab.dataset.opening;
    document.querySelectorAll(".opening-video").forEach(card=>{
      card.classList.toggle("hidden",key!=="all"&&card.dataset.opening!==key);
    });
  }));
  document.querySelectorAll(".level-card").forEach(c=>c.addEventListener("click",()=>{
    document.querySelectorAll(".level-card").forEach(x=>x.classList.remove("active"));c.classList.add("active");
  }));
  const lessonData={
    e4:["E4 fundamentals","Start with 1.e4, control the center, develop quickly, and use Stockfish on the board to test candidate moves."],
    vienna:["Vienna ideas","After 1.e4 e5 2.Nc3, learn the attacking plans and practice the positions with the trainer."],
    caro:["Against the Caro-Kann","After 1.e4 c6, learn the key plans against Black's solid setup and then test them on the board."],
    ck1:["Caro-Kann: 1...c6","Build the position with ...c6 and ...d5, then develop the light-squared bishop before locking the center."],
    ck2:["Caro-Kann: Advance","Practice the Advance structure and learn when Black challenges White's center with ...c5 or ...e6."],
    ck3:["Caro-Kann: Classical","Practice the Classical setup and the main developing ideas around ...Nf6 and ...Bf5."]
  };
  document.querySelectorAll("[data-lesson]").forEach(b=>b.addEventListener("click",()=>{
    const d=lessonData[b.dataset.lesson];if(!d)return;
    q("#lessonPlayer").hidden=false;q("#lessonTitle").textContent=d[0];q("#lessonText").textContent=d[1];
    q("#lessonBoardBtn").onclick=()=>{document.querySelector('[data-mode="play"]').click();};
    q("#lessonPlayer").scrollIntoView({behavior:"smooth",block:"center"});
  }));
}
initUI();
start();
