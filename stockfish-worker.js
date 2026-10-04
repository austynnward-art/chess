/* Local bridge to Stockfish.js 19 lite single-threaded WASM.
   The engine stays off the UI thread. The loader is remote, but its WASM
   location is explicitly pinned so the worker does not guess a relative URL. */
const ENGINE_JS="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.js";
const ENGINE_WASM="https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.wasm";

self.Module=self.Module||{};
self.Module.locateFile=(path)=>path.endsWith(".wasm")?ENGINE_WASM:path;

let engine=null;
function send(v){self.postMessage(typeof v==="string"?v:(v&&v.data)||String(v));}

self.onmessage=(e)=>{
  const cmd=e.data;
  if(typeof cmd!=="string")return;
  try{
    if(!engine){
      if(typeof STOCKFISH!=="function"){send("error Stockfish factory unavailable");return;}
      engine=STOCKFISH();
      engine.onmessage=(m)=>send(m);
    }
    engine.postMessage(cmd);
  }catch(err){send("error "+(err?.message||String(err)));}
};