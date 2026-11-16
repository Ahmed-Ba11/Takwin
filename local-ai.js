let worker,
  request = 0,
  pending;
export function cancelLocalAI() {
  worker?.terminate();
  worker = null;
  pending?.reject(new Error("cancelled"));
  pending = null;
}
export function rewriteLocal(text, onProgress) {
  if (pending) return Promise.reject(new Error("busy"));
  worker ??= new Worker(
    new URL("./vendor/local-ai.worker.js", import.meta.url),
    { type: "module" },
  );
  const id = ++request;
  return new Promise((resolve, reject) => {
    pending = { reject };
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.type === "progress") {
        onProgress?.(data);
        return;
      }
      pending = null;
      if (data.type === "result") resolve(data.text);
      else {
        worker.terminate();
        worker = null;
        reject(new Error(data.error));
      }
    };
    worker.onerror = () => {
      cancelLocalAI();
    };
    worker.postMessage({ id, text });
  });
}
