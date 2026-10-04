/* Stockfish 19 lite single-threaded Web Worker.
   The official browser build is loaded first; its WASM URL is pinned explicitly. */
const ENGINE_JS="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.js";
const ENGINE_WASM="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.wasm";

self.Module=self.Module||{};
self.Module.locateFile=(path)=>path.endsWith(".wasm")?ENGINE_WASM:path;

importScripts(ENGINE_JS);

let engine=null;
function send(v){self.postMessage(typeof v==="string"?v:(v&&v.data)||String(v));}

self.onmessage=(e)=>{
  const cmd=e.data;
  if(typeof cmd!=="string")return;
  try{
    if(!engine){
      if(typeof STOCKFISH!=="function"){
        send("error Stockfish factory unavailable");
        return;
      }
      engine=STOCKFISH();
      engine.onmessage=(m)=>send(m);
    }
    engine.postMessage(cmd);
  }catch(err){
    send("error "+(err?.message||String(err)));
  }
};