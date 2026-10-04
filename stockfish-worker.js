/* Stockfish UCI bridge. Engine computation stays off the UI thread. */
importScripts("https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.js");
let engine=null;function send(v){postMessage(typeof v==="string"?v:(v&&v.data)||String(v));}
self.onmessage=e=>{const cmd=e.data;if(typeof cmd!=="string")return;if(!engine){if(typeof STOCKFISH!=="function"){send("error Stockfish factory unavailable");return;}engine=STOCKFISH();engine.onmessage=m=>send(m);}engine.postMessage(cmd);};