document.addEventListener('DOMContentLoaded', () => {
  const timerDisplay = document.getElementById('timerDisplay');
  const closeBtn = document.getElementById('closeBtn');
  const quoteText = document.getElementById('quoteText');

  const quotes = [
    "Focus on being productive instead of busy.",
    "Your future is created by what you do today, not tomorrow.",
    "Starve your distractions, feed your focus.",
    "The successful warrior is the average man, with laser-like focus.",
    "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.",
    "It's not that I'm so smart, it's just that I stay with problems longer."
  ];

  // Set random quote
  if (quoteText) {
    quoteText.textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
  }


  closeBtn.addEventListener('click', () => {
    // Attempt to close the current tab
    window.close();
    
    // If window.close() doesn't work (due to browser security policies),
    // fallback to navigating to a safe page or showing a message
    setTimeout(() => {
      alert("Please close this tab manually to get back to work.");
    }, 300);
  });

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
          // Timer finished, this page should no longer be blocked.
          // Let's reload the page, but since we're in the extension page, 
          // we can't easily go back to the original URL.
          // The best we can do is tell the user it's over.
          timerDisplay.textContent = "00:00";
          timerDisplay.style.color = "var(--success-color)";
          document.querySelector('h1').textContent = "Focus Session Complete";
          document.querySelector('.message').textContent = "Great job! You can now browse freely.";
          closeBtn.textContent = "Open New Tab";
          
          closeBtn.onclick = () => {
            chrome.tabs.create({});
          };
        }
      } else {
        timerDisplay.textContent = "00:00";
      }
    });
  }

  // Initial update
  updateTimer();
  
  // Update every second
  setInterval(updateTimer, 1000);
});
