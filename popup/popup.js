document.addEventListener('DOMContentLoaded', async () => {
  const timerDisplay = document.getElementById('timerDisplay');
  const timeInputGroup = document.getElementById('timeInputGroup');
  const timeInput = document.getElementById('timeInput');
  const actionBtn = document.getElementById('actionBtn');
  const statusText = document.getElementById('statusText');
  const optionsBtn = document.getElementById('optionsBtn');

  let intervalId = null;

  // Load custom time and strict mode setting
  const data = await chrome.storage.local.get(['isFocusing', 'endTime', 'customTime', 'strictMode', 'muteSounds']);
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
          setUIState(false);
        }
      }
    });
  }

  function setUIState(isFocusing, strictMode = false) {
    if (isFocusing) {
      timeInputGroup.style.display = 'none';
      if (strictMode) {
        actionBtn.style.display = 'none';
        statusText.textContent = 'Strict Mode active. No stopping early.';
      } else {
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Stop Focus';
        actionBtn.className = 'btn btn-danger';
        statusText.textContent = 'Stay focused. Distractions are blocked.';
      }
      statusText.style.color = 'var(--primary-color)';
      
      updateTimer();
      if (!intervalId) intervalId = setInterval(updateTimer, 1000);
    } else {
      timeInputGroup.style.display = 'flex';
      actionBtn.style.display = 'block';
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

  setUIState(data.isFocusing, data.strictMode);

  function playStartSound() {
    if (data.muteSounds) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  }

  actionBtn.addEventListener('click', async () => {
    const currentData = await chrome.storage.local.get(['isFocusing', 'strictMode']);
    if (currentData.isFocusing) {
      // Stop timer
      chrome.runtime.sendMessage({ action: 'stopFocus' }, () => {
        setUIState(false);
      });
    } else {
      // Start timer
      playStartSound();
      const duration = parseInt(timeInput.value, 10) || 15;
      chrome.runtime.sendMessage({ action: 'startFocus', duration: duration }, () => {
        setUIState(true, currentData.strictMode);
      });
    }
  });
});
