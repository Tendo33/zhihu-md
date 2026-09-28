/**
 * Schedule init calls with a minimum interval so a busy page cannot rebuild the button continuously.
 */
export function createInitScheduler(options) {
  const init = options && options.init;
  const minInterval = options && typeof options.minInterval === 'number' ? options.minInterval : 800;
  const defaultDelay = options && typeof options.defaultDelay === 'number' ? options.defaultDelay : 500;
  const now = options && options.now ? options.now : () => Date.now();
  const setTimeoutFn = options && options.setTimeoutFn ? options.setTimeoutFn : setTimeout;
  const clearTimeoutFn = options && options.clearTimeoutFn ? options.clearTimeoutFn : clearTimeout;

  if (typeof init !== 'function') {
    throw new Error('createInitScheduler requires an init function');
  }

  let initScheduled = false;
  let lastInitAt = null;
  let timerId = null;

  return function scheduleInit(delay = defaultDelay) {
    const current = now();
    const remaining = lastInitAt === null ? 0 : minInterval - (current - lastInitAt);
    const effectiveDelay = Math.max(delay, remaining > 0 ? remaining : 0);

    if (initScheduled) return;

    initScheduled = true;
    if (timerId !== null) clearTimeoutFn(timerId);
    timerId = setTimeoutFn(() => {
      initScheduled = false;
      lastInitAt = now();
      init();
    }, effectiveDelay);
  };
}
