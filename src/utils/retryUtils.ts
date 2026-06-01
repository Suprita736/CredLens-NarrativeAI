/**
 * retryUtils.ts
 * Single source-of-truth retry utility.
 * Previously copy-pasted in background/index.ts, retrievalEngine.ts,
 * and escalationManager.ts. Now consolidated here.
 */

/**
 * Retries `fn` up to `attempts` times with `delayMs` between tries.
 * Immediately re-throws AbortError so cancellations propagate cleanly.
 */
export function retryWithDelay<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
  signal?: AbortSignal
): Promise<T> {
  const run = (attempt: number): Promise<T> => {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return fn().catch((err: any) => {
      if (err?.name === "AbortError" || signal?.aborted) {
        return Promise.reject(err);
      }
      if (attempt >= attempts - 1) return Promise.reject(err);
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => run(attempt + 1).then(resolve).catch(reject), delayMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
  };
  return run(0);
}
