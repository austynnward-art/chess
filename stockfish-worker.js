// Same-origin Stockfish bridge for GitHub Pages.
// Stockfish 19 uses its browser factory; Stockfish 10 is itself a worker script.
const params = new URLSearchParams(self.location.search);
const engine = params.get("engine") === "10" ? "10" : "19";

if (engine === "10") {
  self.Module = self.Module || {};
  self.Module.locateFile = file =>
    "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/" + file;
  try {
    importScripts("https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.wasm.js");
  } catch (err) {
    self.postMessage("error Stockfish 10 load failed: " + (err && err.message ? err.message : String(err)));
  }
} else {
  const base = "https://cdn.jsdelivr.net/npm/stockfish@19.0.0/bin/";
  self.Module = self.Module || {};
  self.Module.locateFile = file => base + file;

  try {
    importScripts(base + "stockfish-19-lite-single.js");
    if (typeof STOCKFISH !== "function") {
      throw new Error("Stockfish 19 factory was not created");
    }

    const engine19 = STOCKFISH();
    engine19.onmessage = msg => {
      self.postMessage(typeof msg === "string" ? msg : msg && msg.data ? msg.data : String(msg));
    };

    self.onmessage = event => {
      if (typeof event.data === "string") {
        try {
          engine19.postMessage(event.data);
        } catch (err) {
          self.postMessage("error Stockfish 19 command failed: " + (err && err.message ? err.message : String(err)));
        }
      }
    };
  } catch (err) {
    self.postMessage("error Stockfish 19 load failed: " + (err && err.message ? err.message : String(err)));
  }
}
