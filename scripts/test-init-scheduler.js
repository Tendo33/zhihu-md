const assert = require('assert');

const { createInitScheduler } = require('../lib/init-scheduler');

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  function setTimeoutFn(fn, delay) {
    const id = nextId++;
    timers.set(id, { runAt: now + delay, fn });
    return id;
  }

  function clearTimeoutFn(id) {
    timers.delete(id);
  }

  function runDue() {
    const due = Array.from(timers.entries())
      .filter(([, t]) => t.runAt <= now)
      .sort((a, b) => a[1].runAt - b[1].runAt);

    for (const [id, t] of due) {
      timers.delete(id);
      t.fn();
    }
  }

  function advance(ms) {
    now += ms;
    runDue();
  }

  function getNextRunAt() {
    if (timers.size === 0) return null;
    return Math.min(...Array.from(timers.values()).map(t => t.runAt));
  }

  return {
    now: () => now,
    setTimeoutFn,
    clearTimeoutFn,
    advance,
    getNextRunAt
  };
}

(function testSchedulesTrailingInitWithinMinInterval() {
  const timers = createFakeTimers();
  let calls = 0;

  const schedule = createInitScheduler({
    init: () => { calls += 1; },
    minInterval: 800,
    defaultDelay: 0,
    now: timers.now,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn
  });

  schedule(0);
  timers.advance(0);
  assert.strictEqual(calls, 1, 'first init should run');

  timers.advance(100);
  schedule(0);

  const nextRunAt = timers.getNextRunAt();
  assert.strictEqual(nextRunAt, 800, 'init should be scheduled at minInterval boundary');

  timers.advance(700);
  assert.strictEqual(calls, 2, 'second init should run after minInterval');
})();

console.log('All tests passed.');
