document.addEventListener('DOMContentLoaded', async () => {
  const timerDisplay = document.getElementById('timerDisplay');
  const timeInputGroup = document.getElementById('timeInputGroup');
  const timeInput = document.getElementById('timeInput');
  const actionBtn = document.getElementById('actionBtn');
  const statusText = document.getElementById('statusText');
  const optionsBtn = document.getElementById('optionsBtn');

  let intervalId = null;

  // Load custom time setting
  const data = await chrome.storage.local.get(['isFocusing', 'endTime', 'customTime']);
  if (data.customTime) {
    timeInput.value = data.customTime;
    updateDisplayFromInput();
  }

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  timeInput.addEventListener('change', () => {
    let val = parseInt(timeInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 120) val = 120;
    timeInput.value = val;
    chrome.storage.local.set({ customTime: val });
    updateDisplayFromInput();
  });

  function updateDisplayFromInput() {
    const mins = timeInput.value.padStart(2, '0');
    timerDisplay.textContent = `${mins}:00`;
  }

  function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function updateTimer() {
    chrome.storage.local.get(['isFocusing', 'endTime'], (data) => {
      if (data.isFocusing && data.endTime) {
        const remaining = data.endTime - Date.now();
        if (remaining > 0) {
          timerDisplay.textContent = formatTime(remaining);
        } else {
          // Timer finished
          setUIState(false);
        }
      }
    });
  }

  function setUIState(isFocusing) {
    if (isFocusing) {
      timeInputGroup.style.display = 'none';
      actionBtn.textContent = 'Stop Focus';
      actionBtn.className = 'btn btn-danger';
      statusText.textContent = 'Stay focused. Distractions are blocked.';
      statusText.style.color = 'var(--primary-color)';
      
      // Update timer every second
      updateTimer();
      if (!intervalId) {
        intervalId = setInterval(updateTimer, 1000);
      }
    } else {
      timeInputGroup.style.display = 'flex';
      actionBtn.textContent = 'Start Focus';
      actionBtn.className = 'btn btn-primary';
      statusText.textContent = 'Ready to focus.';
      statusText.style.color = 'var(--text-muted)';
      updateDisplayFromInput();
      
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  }

  // Initial state check
  setUIState(data.isFocusing);

  actionBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isFocusing'], (currentData) => {
      if (currentData.isFocusing) {
        // Stop timer
        chrome.runtime.sendMessage({ action: 'stopFocus' }, () => {
          setUIState(false);
        });
      } else {
        // Start timer
        const duration = parseInt(timeInput.value, 10) || 15;
        chrome.runtime.sendMessage({ action: 'startFocus', duration: duration }, () => {
          setUIState(true);
        });
      }
    });
  });
});
