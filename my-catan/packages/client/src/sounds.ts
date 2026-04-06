/** Synthetic sound effects via Web Audio API. No audio files required. */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

function tone(
  freq: number,
  duration: number,
  gain = 0.25,
  type: OscillatorType = "sine",
  startDelay = 0,
): void {
  const c = ctx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + startDelay);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + startDelay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(c.currentTime + startDelay);
  osc.stop(c.currentTime + startDelay + duration);
}

function noise(duration: number, gainVal = 0.25, freqCenter = 900): void {
  const c = ctx();
  const bufLen = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.5);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freqCenter;
  filter.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gainVal;
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start();
}

export function playDiceRoll(): void {
  noise(0.28, 0.35, 1100);
  // Two short clicks for the dice tumble
  tone(320, 0.06, 0.18, "triangle", 0.05);
  tone(280, 0.06, 0.18, "triangle", 0.14);
}

export function playSettle(): void {
  tone(220, 0.18, 0.22, "triangle");
  tone(165, 0.14, 0.14, "triangle", 0.09);
}

export function playCity(): void {
  tone(180, 0.22, 0.28, "square");
  tone(220, 0.18, 0.2, "triangle", 0.08);
  tone(270, 0.14, 0.16, "triangle", 0.16);
}

export function playRoad(): void {
  tone(440, 0.07, 0.14, "triangle");
  tone(360, 0.06, 0.10, "triangle", 0.06);
}

export function playDevCard(): void {
  const c = ctx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1100, c.currentTime + 0.13);
  g.gain.setValueAtTime(0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.16);
}

export function playRobber(): void {
  tone(90, 0.5, 0.28, "sawtooth");
  tone(75, 0.4, 0.18, "sawtooth", 0.1);
}

export function playWin(): void {
  // Ascending arpeggio: C4 E4 G4 C5 E5
  const notes = [261, 329, 392, 523, 659];
  notes.forEach((freq, i) => tone(freq, 0.45, 0.22, "sine", i * 0.13));
}

export function playChatReceived(): void {
  tone(880, 0.08, 0.1, "sine");
  tone(1100, 0.07, 0.08, "sine", 0.07);
}
