// Web Audio API para alertas sonoras de planta industrial

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;

    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
        // Silenciar rechazo si el usuario aún no interactuó con la página
      });
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Pitido de Éxito:
 * Frecuencia ~1200Hz, duración 0.1s, onda senoidal aguda.
 */
export function playSuccessBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Ignorar si el audio no está permitido por el navegador aún
  }
}

/**
 * Pitido de Error / Advertencia:
 * Patrón doble, grave y rasposo (onda sawtooth, ~150Hz, 0.3s por pulso).
 */
export function playErrorBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    // Primer pulso
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(150, ctx.currentTime);
    gain1.gain.setValueAtTime(0.4, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.28);

    // Segundo pulso (después de 0.32s)
    const startTime2 = ctx.currentTime + 0.32;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(140, startTime2);
    gain2.gain.setValueAtTime(0.4, startTime2);
    gain2.gain.exponentialRampToValueAtTime(0.01, startTime2 + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(startTime2);
    osc2.stop(startTime2 + 0.28);

  } catch {
    // Ignorar si el audio no está permitido por el navegador aún
  }
}
