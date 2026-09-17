export function createAbortScope({ signals = [], timeoutMs } = {}) {
  const controller = new AbortController();
  const listeners = [];
  let timedOut = false;
  let externallyAborted = false;

  for (const signal of signals.filter(Boolean)) {
    const abort = () => {
      externallyAborted = true;
      if (!controller.signal.aborted) controller.abort(signal.reason ?? new Error("Operation aborted"));
    };
    if (signal.aborted) abort();
    else {
      signal.addEventListener("abort", abort, { once: true });
      listeners.push([signal, abort]);
    }
  }

  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      if (!controller.signal.aborted) controller.abort(new Error("Operation timed out"));
    }, timeoutMs)
    : undefined;
  timeout?.unref?.();

  return Object.freeze({
    signal: controller.signal,
    get timedOut() { return timedOut; },
    get externallyAborted() { return externallyAborted; },
    cleanup() {
      if (timeout) clearTimeout(timeout);
      for (const [signal, listener] of listeners) signal.removeEventListener("abort", listener);
    }
  });
}

