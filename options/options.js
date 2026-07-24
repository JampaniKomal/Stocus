document.addEventListener('DOMContentLoaded', async () => {
  const domainInput = document.getElementById('domainInput');
  const addBtn = document.getElementById('addBtn');
  const domainList = document.getElementById('domainList');

  // Load existing whitelist
  const data = await chrome.storage.local.get(['whitelist']);
  let whitelist = data.whitelist || ['coursera.org'];

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
    
    // Simple sanitization to extract domain
    val = val.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    
    if (val && !whitelist.includes(val)) {
      whitelist.push(val);
      domainInput.value = '';
      saveAndRender();
    }
  }

  addBtn.addEventListener('click', addDomain);
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomain();
    }
  });

  renderList();
});
