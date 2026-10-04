/* Stockfish 19 lite-single browser worker.
   Stockfish.js v19 recommends the lite single-threaded build for browser apps.
   The fallback keeps analysis usable on browsers that fail to instantiate WASM. */
const LITE_JS="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.js";
const LITE_WASM="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.wasm";
const ASM_JS="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-asm.js";

let engine=null;
let loaded="";

function send(v){
  self.postMessage(typeof v==="string"?v:(v&&v.data)||String(v));
}
function configure(){
  self.Module=self.Module||{};
  self.Module.locateFile=path=>path.endsWith(".wasm")?LITE_WASM:path;
}
function load(){
  if(engine)return true;
  try{
    configure();
    importScripts(LITE_JS);
    if(typeof STOCKFISH==="function"){
      engine=STOCKFISH();
      loaded="Stockfish 19 lite";
      engine.onmessage=m=>send(m);
      return true;
    }
  }catch(err){send("error WASM load failed: "+(err?.message||String(err)));}
  try{
    importScripts(ASM_JS);
    if(typeof STOCKFISH==="function"){
      engine=STOCKFISH();
      loaded="Stockfish 19 ASM fallback";
      engine.onmessage=m=>send(m);
      send("info string Stockfish WASM unavailable; using ASM-JS fallback");
      return true;
    }
  }catch(err){send("error Stockfish fallback failed: "+(err?.message||String(err)));}
  return false;
}
self.addEventListener("error",e=>{
  if(!engine)send("error Worker load error: "+(e.message||"unknown"));
});
self.onmessage=e=>{
  const cmd=e.data;
  if(typeof cmd!=="string")return;
  if(!load()){send("error Stockfish engine unavailable");return;}
  try{engine.postMessage(cmd)}catch(err){send("error "+(err?.message||String(err)));}
};