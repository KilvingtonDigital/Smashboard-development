// Web Audio API double chime SMS tone generator
export const playSMSChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playNote = (time, frequency, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    // Classic SMS high-low quick double beep chime
    playNote(now, 587.33, 0.12);        // D5 note
    playNote(now + 0.14, 880.00, 0.28);  // A5 note
  } catch (err) {
    console.warn('Audio play blocked or unsupported by browser sandbox:', err);
  }
};

// Injects keyframe CSS definitions for SOS Neon-lime flash animation
export const injectSOSStyle = () => {
  const id = 'dinksync-sos-style';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.innerHTML = `
    @keyframes dinksync-sos-blink {
      0%, 100% {
        background-color: rgba(214, 240, 96, 0.03);
        box-shadow: inset 0 0 10px rgba(214, 240, 96, 0.1);
        border-color: rgba(214, 240, 96, 0.15);
      }
      50% {
        background-color: rgba(214, 240, 96, 0.28);
        box-shadow: inset 0 0 45px rgba(214, 240, 96, 0.6);
        border-color: rgba(214, 240, 96, 0.95);
      }
    }
    .animate-sos-pulse {
      animation: dinksync-sos-blink 1.1s infinite ease-in-out;
    }
  `;
  document.head.appendChild(style);
};
