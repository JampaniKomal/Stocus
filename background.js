const RULE_ID = 1;

// Initialize default whitelist on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['whitelist', 'customTime']);
  if (!data.whitelist) {
    await chrome.storage.local.set({ whitelist: ['coursera.org'] });
  }
  if (!data.customTime) {
    await chrome.storage.local.set({ customTime: 15 });
  }
});

async function enableFocusMode(durationInMinutes) {
  const data = await chrome.storage.local.get(['whitelist']);
  const whitelist = data.whitelist || ['coursera.org'];
  
  // Format the whitelist for excludedRequestDomains
  // domains should not have protocols, e.g., 'coursera.org'
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
  await chrome.storage.local.set({ isFocusing: true, endTime: endTime });
  
  chrome.alarms.create('focusTimer', { delayInMinutes: parseFloat(durationInMinutes) });
}

async function disableFocusMode() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID]
  });
  await chrome.storage.local.set({ isFocusing: false, endTime: null });
  chrome.alarms.clear('focusTimer');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusTimer') {
    disableFocusMode();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startFocus') {
    enableFocusMode(message.duration).then(() => sendResponse({ success: true }));
    return true; // keep channel open for async response
  } else if (message.action === 'stopFocus') {
    disableFocusMode().then(() => sendResponse({ success: true }));
    return true;
  }
});
