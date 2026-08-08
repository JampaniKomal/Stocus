document.addEventListener('DOMContentLoaded', async () => {
  const domainInput = document.getElementById('domainInput');
  const addBtn = document.getElementById('addBtn');
  const domainList = document.getElementById('domainList');
  const strictModeToggle = document.getElementById('strictModeToggle');
  const muteSoundsToggle = document.getElementById('muteSoundsToggle');
  const historyList = document.getElementById('historyList');

  // Load existing settings
  const data = await chrome.storage.local.get(['whitelist', 'strictMode', 'muteSounds', 'history']);
  let whitelist = data.whitelist || ['coursera.org'];
  let history = data.history || [];

  strictModeToggle.checked = data.strictMode;
  muteSoundsToggle.checked = data.muteSounds;

  // Tabs logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // Settings Handlers
  strictModeToggle.addEventListener('change', () => {
    chrome.storage.local.set({ strictMode: strictModeToggle.checked });
  });

  muteSoundsToggle.addEventListener('change', () => {
    chrome.storage.local.set({ muteSounds: muteSoundsToggle.checked });
  });

  // Whitelist Logic
  function renderList() {
    domainList.innerHTML = '';
    if (whitelist.length === 0) {
      domainList.innerHTML = '<li class="domain-item" style="color: var(--text-muted); justify-content: center;">No allowed sites added yet.</li>';
      return;
    }

    whitelist.forEach((domain, index) => {
      const li = document.createElement('li');
      li.className = 'domain-item';
      
      const span = document.createElement('span');
      span.className = 'domain-text';
      span.textContent = domain;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        whitelist.splice(index, 1);
        saveAndRender();
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      domainList.appendChild(li);
    });
  }

  async function saveAndRender() {
    await chrome.storage.local.set({ whitelist: whitelist });
    renderList();
  }

  function addDomain() {
    let val = domainInput.value.trim().toLowerCase();
    if (!val) return;
    val = val.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    if (val && !whitelist.includes(val)) {
      whitelist.push(val);
      domainInput.value = '';
      saveAndRender();
    }
  }

  addBtn.addEventListener('click', addDomain);
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDomain();
  });

  renderList();

  // History Logic
  function renderHistory() {
    const totalSessions = history.length;
    const totalMinutes = history.reduce((sum, session) => sum + session.duration, 0);
    
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalMinutes').textContent = totalMinutes;

    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<p class="help-text" style="text-align: center;">No completed sessions yet. Start focusing!</p>';
      return;
    }

    // Sort descending by timestamp
    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

    sortedHistory.forEach(session => {
      const date = new Date(session.timestamp);
      const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
      
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <span class="history-date">${dateStr}</span>
        <span class="history-duration">${session.duration} min</span>
      `;
      historyList.appendChild(div);
    });
  }

  renderHistory();
});
