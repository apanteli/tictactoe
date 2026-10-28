// Full-screen fireworks drawn on a temporary canvas that ignores clicks.
const Fireworks = (() => {
  const ROCKETS = 6;
  const SPARKS = 70;
  const GRAVITY = 0.06;
  const ROCKET_GRAVITY = 0.15;
  let canvas = null;
  let frame = null;
  let audio = null;
  let output = null;
  let soundOn = true;

  // Sounds are synthesised with Web Audio, so there are no files to load.
  function startSound() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!soundOn) return;
    if (!AudioCtx) return;
    audio ??= new AudioCtx();
    audio.resume();
    output = audio.createGain();
    output.gain.value = 0.5;
    output.connect(audio.destination);
  }

  function noise(seconds) {
    const buffer = audio.createBuffer(1, audio.sampleRate * seconds, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audio.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  // Plays a filtered noise burst. pan is -1 (left) to 1 (right).
  function burst({ at = 0, length, volume, filter, from, to, pan }) {
    if (!output) return;
    const t = audio.currentTime + at;
    const src = noise(length);
    const f = audio.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = audio.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    const p = audio.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(output);
    src.start(t);
  }

  function whooshSound(pan) {
    burst({ length: 0.5, volume: 0.15, filter: 'bandpass', from: 400, to: 3000, pan });
  }

  function bangSound(pan) {
    burst({ length: 0.9, volume: 0.9, filter: 'lowpass', from: 1500, to: 120, pan });
  }

  function stopSound() {
    output?.disconnect();
    output = null;
  }

  function stop() {
    cancelAnimationFrame(frame);
    canvas?.remove();
    canvas = null;
    stopSound();
  }

  // Takes effect immediately, including during a show already running.
  function setSound(on) {
    soundOn = on;
    if (!on) stopSound();
  }

  function launch(colors) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stop();

    canvas = document.createElement('canvas');
    canvas.className = 'fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    startSound();
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    // Launch speed is chosen so each rocket bursts in the upper part of the screen.
    const rockets = Array.from({ length: ROCKETS }, (_, i) => {
      const rise = h * (0.55 + Math.random() * 0.3);
      return {
        x: w * (0.15 + Math.random() * 0.7),
        y: h,
        vy: -Math.sqrt(2 * ROCKET_GRAVITY * rise),
        delay: i * 18,
        color: pick(),
      };
    });
    let sparks = [];
    let tick = 0;

    function explode(r) {
      for (let i = 0; i < SPARKS; i++) {
        const angle = (Math.PI * 2 * i) / SPARKS;
        const speed = 1.5 + Math.random() * 3;
        sparks.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: Math.random() < 0.8 ? r.color : pick(),
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, w, h);

      for (const r of rockets) {
        if (r.done || tick < r.delay) continue;
        const pan = (r.x / w) * 2 - 1;
        if (tick === r.delay) whooshSound(pan);
        r.y += r.vy;
        r.vy += ROCKET_GRAVITY;
        if (r.vy >= -1) {
          r.done = true;
          explode(r);
          bangSound(pan);
        } else {
          ctx.fillStyle = r.color;
          ctx.fillRect(r.x - 1.5, r.y, 3, 8);
        }
      }

      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.98;
        s.vy = s.vy * 0.98 + GRAVITY;
        s.life -= 0.012;
        ctx.globalAlpha = Math.max(s.life, 0);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      sparks = sparks.filter((s) => s.life > 0);
      tick++;

      if (sparks.length || rockets.some((r) => !r.done)) frame = requestAnimationFrame(step);
      else stop();
    }

    frame = requestAnimationFrame(step);
  }

  return { launch, stop, setSound };
})();
