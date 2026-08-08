chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen' && message.type === 'play-end-sound') {
    playEndSound();
  }
});

function playEndSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // A gentle bell sound composed of a few sine waves
  const frequencies = [440, 554.37, 659.25]; // A4, C#5, E5 (A major chord)
  
  const masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
  // Quick attack, long release
  masterGain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
  masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);

  frequencies.forEach(freq => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 3.1);
  });
}
