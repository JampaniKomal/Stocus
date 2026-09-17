// Loads the real background.js into a sandboxed VM context with a mocked
// chrome API, and drives its actual listeners with real inputs. This is a
// plain Node script (no test framework dependency) - run with `npm test`.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function makeChromeMock() {
  const store = {};
  const dynamicRules = [];
  const alarms = {};
  const listeners = { onInstalled: [], onMessage: [], onAlarm: [] };
  const log = [];

  const chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const result = {};
          (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (k in store) result[k] = store[k]; });
          if (cb) { cb(result); return; }
          return Promise.resolve(result);
        },
        set: (obj, cb) => {
          Object.assign(store, obj);
          if (cb) { cb(); return; }
          return Promise.resolve();
        },
      },
    },
    runtime: {
      onInstalled: { addListener: (fn) => listeners.onInstalled.push(fn) },
      onMessage: { addListener: (fn) => listeners.onMessage.push(fn) },
      getURL: (p) => `chrome-extension://fake-id/${p}`,
      getContexts: async () => [],
      sendMessage: (msg) => { log.push(['sendMessage', msg]); },
    },
    offscreen: {
      createDocument: async (opts) => { log.push(['createDocument', opts]); },
    },
    declarativeNetRequest: {
      updateDynamicRules: async ({ removeRuleIds, addRules }) => {
        (removeRuleIds || []).forEach(id => {
          const idx = dynamicRules.findIndex(r => r.id === id);
          if (idx !== -1) dynamicRules.splice(idx, 1);
        });
        (addRules || []).forEach(r => dynamicRules.push(r));
      },
    },
    alarms: {
      create: (name, opts) => { alarms[name] = opts; },
      clear: (name) => { delete alarms[name]; },
      onAlarm: { addListener: (fn) => listeners.onAlarm.push(fn) },
    },
  };

  return { chrome, store, dynamicRules, alarms, listeners, log };
}

function loadBackground(chrome) {
  const ctx = { chrome, console };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'background.js' });
}

// Arrays/objects created inside the vm context belong to a different realm,
// so assert.deepStrictEqual's prototype check fails even when the contents
// match. Round-tripping through JSON strips the foreign realm wrapper.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function run() {
  let passed = 0, failed = 0;
  function check(name, fn) {
    return Promise.resolve().then(fn).then(() => { console.log(`PASS: ${name}`); passed++; })
      .catch(e => { console.log(`FAIL: ${name} -> ${e.message}`); failed++; });
  }

  await check('onInstalled seeds default whitelist/customTime/history/strictMode/muteSounds', async () => {
    const { chrome, store, listeners } = makeChromeMock();
    loadBackground(chrome);
    for (const fn of listeners.onInstalled) await fn();
    assert.deepStrictEqual(plain(store.whitelist), ['coursera.org']);
    assert.strictEqual(store.customTime, 15);
    assert.deepStrictEqual(plain(store.history), []);
    assert.strictEqual(store.strictMode, false);
    assert.strictEqual(store.muteSounds, false);
  });

  await check('startFocus builds a DNR rule with normalized (lowercased, protocol/www stripped) excludedRequestDomains', async () => {
    const { chrome, store, dynamicRules, alarms, listeners } = makeChromeMock();
    store.whitelist = ['https://www.coursera.org/path', 'GitHub.com'];
    loadBackground(chrome);

    const onMessage = listeners.onMessage[0];
    let response;
    await new Promise(resolve => {
      onMessage({ action: 'startFocus', duration: 25 }, null, (r) => { response = r; resolve(); });
    });

    assert.strictEqual(response.success, true);
    assert.strictEqual(dynamicRules.length, 1);
    const rule = dynamicRules[0];
    assert.deepStrictEqual(plain(rule.condition.excludedRequestDomains), ['coursera.org', 'github.com']);
    assert.strictEqual(rule.action.type, 'redirect');
    assert.strictEqual(rule.action.redirect.extensionPath, '/blocked/blocked.html');
    assert.strictEqual(store.isFocusing, true);
    assert.strictEqual(store.currentSessionDuration, 25);
    assert.ok(alarms.focusTimer);
    assert.strictEqual(alarms.focusTimer.delayInMinutes, 25);
  });

  await check('focusTimer alarm firing logs a history entry and removes the DNR rule', async () => {
    const { chrome, store, dynamicRules, alarms, listeners } = makeChromeMock();
    store.whitelist = ['coursera.org'];
    store.history = [];
    loadBackground(chrome);

    const onMessage = listeners.onMessage[0];
    await new Promise(resolve => onMessage({ action: 'startFocus', duration: 10 }, null, resolve));
    assert.strictEqual(dynamicRules.length, 1);

    const onAlarm = listeners.onAlarm[0];
    await onAlarm({ name: 'focusTimer' });

    assert.strictEqual(dynamicRules.length, 0, 'DNR rule should be removed on completion');
    assert.strictEqual(store.isFocusing, false);
    assert.strictEqual(store.history.length, 1);
    assert.strictEqual(store.history[0].duration, 10);
    assert.strictEqual(alarms.focusTimer, undefined, 'alarm should be cleared');
  });

  await check('stopFocus (manual) does not add a history entry', async () => {
    const { chrome, store, dynamicRules, listeners } = makeChromeMock();
    store.whitelist = ['coursera.org'];
    store.history = [];
    loadBackground(chrome);

    const onMessage = listeners.onMessage[0];
    await new Promise(resolve => onMessage({ action: 'startFocus', duration: 5 }, null, resolve));
    await new Promise(resolve => onMessage({ action: 'stopFocus' }, null, resolve));

    assert.strictEqual(dynamicRules.length, 0);
    assert.strictEqual(store.history.length, 0);
    assert.strictEqual(store.isFocusing, false);
  });

  await check('history caps at 100 sessions, dropping the oldest', async () => {
    const { chrome, store, listeners } = makeChromeMock();
    store.whitelist = ['coursera.org'];
    store.history = Array.from({ length: 100 }, (_, i) => ({ timestamp: i, duration: 1 }));
    loadBackground(chrome);

    const onMessage = listeners.onMessage[0];
    await new Promise(resolve => onMessage({ action: 'startFocus', duration: 1 }, null, resolve));
    const onAlarm = listeners.onAlarm[0];
    await onAlarm({ name: 'focusTimer' });

    assert.strictEqual(store.history.length, 100, 'history should stay capped at 100');
    assert.strictEqual(store.history[0].timestamp, 1, 'oldest entry (timestamp 0) should have been dropped');
  });

  await check('muteSounds true suppresses the end-of-session sound', async () => {
    const { chrome, store, listeners, log } = makeChromeMock();
    store.whitelist = ['coursera.org'];
    store.history = [];
    store.muteSounds = true;
    loadBackground(chrome);

    const onMessage = listeners.onMessage[0];
    await new Promise(resolve => onMessage({ action: 'startFocus', duration: 1 }, null, resolve));
    const onAlarm = listeners.onAlarm[0];
    await onAlarm({ name: 'focusTimer' });
    await new Promise(r => setTimeout(r, 50));

    const createdOffscreen = log.some(([type]) => type === 'createDocument');
    assert.strictEqual(createdOffscreen, false, 'should not create offscreen doc when muted');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
