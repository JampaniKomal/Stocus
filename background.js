const RULE_ID = 1;

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['whitelist', 'customTime', 'history', 'strictMode', 'muteSounds']);
  if (!data.whitelist) await chrome.storage.local.set({ whitelist: ['coursera.org'] });
  if (!data.customTime) await chrome.storage.local.set({ customTime: 15 });
  if (!data.history) await chrome.storage.local.set({ history: [] });
  if (data.strictMode === undefined) await chrome.storage.local.set({ strictMode: false });
  if (data.muteSounds === undefined) await chrome.storage.local.set({ muteSounds: false });
});

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/audio.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play timer end sound'
  });
}

async function playEndSound() {
  const data = await chrome.storage.local.get(['muteSounds']);
  if (data.muteSounds) return;

  await setupOffscreenDocument();
  chrome.runtime.sendMessage({
    type: 'play-end-sound',
    target: 'offscreen'
  });
}

async function enableFocusMode(durationInMinutes) {
  const data = await chrome.storage.local.get(['whitelist']);
  const whitelist = data.whitelist || ['coursera.org'];
  
  const validDomains = whitelist.map(d => d.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0]).filter(Boolean);
  
  const rule = {
    id: RULE_ID,
    priority: 1,
    action: { 
      type: 'redirect',
      redirect: { extensionPath: '/blocked/blocked.html' }
    },
    condition: {
      urlFilter: '*',
      resourceTypes: ['main_frame'],
      excludedRequestDomains: validDomains
    }
  };

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [rule]
  });

  const endTime = Date.now() + durationInMinutes * 60 * 1000;
  await chrome.storage.local.set({ 
    isFocusing: true, 
    endTime: endTime,
    currentSessionDuration: durationInMinutes
  });
  
  chrome.alarms.create('focusTimer', { delayInMinutes: parseFloat(durationInMinutes) });
}

async function disableFocusMode(completed = false) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID]
  });
  
  if (completed) {
    // Log history
    const data = await chrome.storage.local.get(['history', 'currentSessionDuration']);
    const history = data.history || [];
    history.push({
      timestamp: Date.now(),
      duration: data.currentSessionDuration || 0
    });
    // Keep last 100 sessions
    if (history.length > 100) history.shift();
    await chrome.storage.local.set({ history });
    
    // Play sound
    playEndSound();
  }

  await chrome.storage.local.set({ isFocusing: false, endTime: null, currentSessionDuration: null });
  chrome.alarms.clear('focusTimer');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusTimer') {
    disableFocusMode(true);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startFocus') {
    enableFocusMode(message.duration).then(() => sendResponse({ success: true }));
    return true; 
  } else if (message.action === 'stopFocus') {
    disableFocusMode(false).then(() => sendResponse({ success: true }));
    return true;
  }
});
