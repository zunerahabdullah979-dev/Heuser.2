/* =========================================================
   AUDIO.JS — Background music & sound effects
   ========================================================= */

class AudioManager {
  constructor() {
    this.muted = false;
    this.musicStarted = false;
    this.sounds = {};
    this.bgMusic = null;
    this.init();
  }

  init() {
    // Create AudioContext on demand (browser autoplay policy)
    this.ctx = null;

    // Build UI control
    this.buildControl();

    // Start music on first user interaction
    const startOnInteract = () => {
      this.startMusic();
      document.removeEventListener('click', startOnInteract);
      document.removeEventListener('keydown', startOnInteract);
      document.removeEventListener('touchstart', startOnInteract);
    };

    document.addEventListener('click', startOnInteract);
    document.addEventListener('keydown', startOnInteract);
    document.addEventListener('touchstart', startOnInteract);
  }

  getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.ctx;
  }

  /* ── Procedural dreamy background music using Web Audio API ── */
  startMusic() {
    if (this.musicStarted || this.muted) return;
    this.musicStarted = true;

    try {
      const ctx = this.getCtx();
      if (ctx.state === 'suspended') ctx.resume();

      // Master gain
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3);
      this.masterGain.connect(ctx.destination);

      // Reverb convolver for dreamy feel
      this.reverb = this.createReverb(ctx, 2.5);
      this.reverb.connect(this.masterGain);

      // Dreamy chord progression: Fmaj7 → Cmaj7 → Am7 → G (loop)
      const freqSets = [
        [349.23, 440, 523.25, 659.25],   // Fmaj7
        [261.63, 329.63, 392, 493.88],   // Cmaj7
        [220, 261.63, 329.63, 440],       // Am7
        [196, 246.94, 293.66, 392],       // G
      ];

      let beat = 0;
      const beatDuration = 2.0;

      const playChord = () => {
        if (this.muted || !this.musicStarted) return;
        const freqs = freqSets[beat % freqSets.length];
        const now = ctx.currentTime;

        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = i === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          // Slight vibrato
          const vibLfo = ctx.createOscillator();
          const vibGain = ctx.createGain();
          vibLfo.frequency.value = 5;
          vibGain.gain.value = 1.5;
          vibLfo.connect(vibGain);
          vibGain.connect(osc.frequency);
          vibLfo.start(now);
          vibLfo.stop(now + beatDuration * 1.5);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.07 / freqs.length, now + 0.3);
          gain.gain.linearRampToValueAtTime(0.04 / freqs.length, now + beatDuration * 0.8);
          gain.gain.linearRampToValueAtTime(0, now + beatDuration * 1.4);

          osc.connect(gain);
          gain.connect(this.reverb);
          osc.start(now);
          osc.stop(now + beatDuration * 1.5);
        });

        // Soft bell melody on top
        const melodyFreqs = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33];
        const mNote = melodyFreqs[beat % melodyFreqs.length];
        const mOsc = ctx.createOscillator();
        const mGain = ctx.createGain();
        mOsc.type = 'sine';
        mOsc.frequency.value = mNote;
        mGain.gain.setValueAtTime(0, now);
        mGain.gain.linearRampToValueAtTime(0.06, now + 0.1);
        mGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        mOsc.connect(mGain);
        mGain.connect(this.reverb);
        mOsc.start(now);
        mOsc.stop(now + 1.3);

        beat++;
        this._musicTimer = setTimeout(playChord, beatDuration * 1000);
      };

      playChord();
      this.updateBtn();
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  createReverb(ctx, duration) {
    const convolver = ctx.createConvolver();
    const len = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
    }
    convolver.buffer = buf;
    return convolver;
  }

  /* ── Sound Effects ── */
  playClick() { this._playTone(880, 'sine', 0.08, 0.15); }
  playSuccess() {
    this._playTone(523.25, 'sine', 0.1, 0.1);
    setTimeout(() => this._playTone(659.25, 'sine', 0.1, 0.1), 120);
    setTimeout(() => this._playTone(783.99, 'sine', 0.1, 0.2), 240);
  }
  playHover() { this._playTone(1046.5, 'sine', 0.04, 0.08); }
  playTransition() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this._playTone(400 + i * 100, 'triangle', 0.05, 0.12), i * 80);
    }
  }

  _playTone(freq, type, vol, dur) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.05);
    } catch (e) {}
  }

  /* ── Mute / Unmute ── */
  toggle() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.18, this.getCtx().currentTime);
    }
    if (this.muted) {
      clearTimeout(this._musicTimer);
    } else {
      if (!this.musicStarted) {
        this.startMusic();
      } else {
        this.musicStarted = false;
        this.startMusic();
      }
    }
    this.updateBtn();
  }

  updateBtn() {
    const btn = document.getElementById('audioBtn');
    if (btn) btn.textContent = this.muted ? '🔇' : '🎵';
  }

  buildControl() {
    const btn = document.createElement('button');
    btn.id = 'audioBtn';
    btn.className = 'audio-control';
    btn.title = 'Toggle Music';
    btn.textContent = '🎵';
    btn.setAttribute('aria-label', 'Toggle background music');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.body.appendChild(btn);
  }
}

// Initialize
window.audioManager = new AudioManager();
/* =========================================================
   FAIRY.JS — Dedicated Fairy Companion (Truffle Twinkle's Guide)
   Fixed, non-intrusive position with speech bubbles
   Uses the fairy avatar from fairy.jpg (No flying bug/bee!)
   ========================================================= */

class FairyGuide {
  constructor(options = {}) {
    this.messages = options.messages || [];
    this.msgIndex = 0;
    this.autoRotate = options.autoRotate !== false;
    this.rotateInterval = options.rotateInterval || 6000;
    this.bubbleTimer = null;
    this.rotateTimer = null;
    this.build();
    if (this.autoRotate && this.messages.length) {
      this.startAutoMessages();
    }
  }

  build() {
    // Remove any existing fairy elements
    const existing = document.getElementById('fairyCompanion');
    if (existing) existing.remove();

    // Main fixed dock in corner (bottom-right)
    this.dockEl = document.createElement('div');
    this.dockEl.id = 'fairyCompanion';
    this.dockEl.className = 'fairy-dock';

    // Speech bubble container
    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'fairy-speech-bubble';
    this.bubbleEl.setAttribute('role', 'status');
    this.bubbleEl.innerHTML = '<span class="bubble-text">✨ Hello! I\'m your Fairy Guide!</span>';

    // Fairy Avatar Button
    this.avatarWrap = document.createElement('div');
    this.avatarWrap.className = 'fairy-avatar-wrap';
    this.avatarWrap.title = 'Click me for a magical tip!';

    this.avatarImg = document.createElement('img');
    this.avatarImg.src = 'assets/images/fairy.jpg';
    this.avatarImg.alt = 'Fairy Guide';
    this.avatarImg.className = 'fairy-avatar-img';

    // Translucent wing decorations behind avatar
    const wings = document.createElement('div');
    wings.className = 'fairy-wings-fx';

    // Sparkle badge
    const badge = document.createElement('span');
    badge.className = 'fairy-badge';
    badge.textContent = '✨ Fairy';

    this.avatarWrap.appendChild(wings);
    this.avatarWrap.appendChild(this.avatarImg);
    this.avatarWrap.appendChild(badge);

    // Interactive click on fairy
    this.avatarWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioManager) window.audioManager.playHover();
      this.cycleNext();
      this.pulseAvatar();
    });

    this.dockEl.appendChild(this.bubbleEl);
    this.dockEl.appendChild(this.avatarWrap);
    document.body.appendChild(this.dockEl);
  }

  pulseAvatar() {
    this.avatarWrap.classList.remove('pulse');
    void this.avatarWrap.offsetWidth;
    this.avatarWrap.classList.add('pulse');
  }

  say(message, duration = 5000) {
    if (!this.bubbleEl) return;
    const textSpan = this.bubbleEl.querySelector('.bubble-text');
    if (textSpan) {
      textSpan.textContent = message;
    } else {
      this.bubbleEl.textContent = message;
    }

    this.bubbleEl.classList.add('visible');

    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    if (duration > 0) {
      this.bubbleTimer = setTimeout(() => this.hideBubble(), duration);
    }
  }

  hideBubble() {
    if (this.bubbleEl) {
      this.bubbleEl.classList.remove('visible');
    }
  }

  startAutoMessages() {
    const showNext = () => {
      if (this.messages.length === 0) return;
      this.say(this.messages[this.msgIndex % this.messages.length], 5000);
      this.msgIndex++;
      this.rotateTimer = setTimeout(showNext, this.rotateInterval);
    };
    setTimeout(showNext, 1200);
  }

  cycleNext() {
    if (this.messages.length === 0) return;
    this.say(this.messages[this.msgIndex % this.messages.length], 5000);
    this.msgIndex++;
  }

  greet(msg) {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    clearTimeout(this.rotateTimer);
    this.say(msg, 6000);
    this.pulseAvatar();
    if (this.autoRotate) {
      this.rotateTimer = setTimeout(() => this.startAutoMessages(), 7000);
    }
  }

  destroy() {
    clearTimeout(this.bubbleTimer);
    clearTimeout(this.rotateTimer);
    if (this.dockEl) this.dockEl.remove();
  }
}

window.FairyGuide = FairyGuide;
/* =========================================================
   EFFECTS.JS — Sparkles, transitions, and interactive effects
   Supports both single-file offline mode & multi-file navigation
   ========================================================= */

/* ── Universal Navigation Handler ── */
function navigateTo(url, originEl) {
  if (window.audioManager) window.audioManager.playTransition();

  // Normalize target screen id (e.g. 'kingdom.html' -> 'screen-kingdom')
  const cleanName = url.replace('.html', '').replace('#', '');
  const targetId = 'screen-' + cleanName;
  const targetScreen = document.getElementById(targetId);

  // If this page contains internal screens (offline SPA mode), switch seamlessly!
  if (targetScreen) {
    showTransitionEffect(originEl, () => {
      document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
      targetScreen.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Trigger location-specific animations & fairy commentary
      if (typeof onScreenActivated === 'function') {
        onScreenActivated(cleanName);
      }
    });
    return;
  }

  // Multi-file fallback
  showTransitionEffect(originEl, () => {
    window.location.href = url;
  });
}

function showTransitionEffect(originEl, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'page-transition';

  const content = document.createElement('div');
  content.className = 'transition-content';
  content.innerHTML = '✨ <span style="font-family:Quicksand,sans-serif;font-size:1.1rem;display:block;margin-top:6px;">Entering...</span>';
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  let ox = 50, oy = 50;
  if (originEl && originEl.getBoundingClientRect) {
    const r = originEl.getBoundingClientRect();
    ox = ((r.left + r.width / 2) / window.innerWidth * 100).toFixed(1);
    oy = ((r.top + r.height / 2) / window.innerHeight * 100).toFixed(1);
  }

  overlay.style.background = `radial-gradient(circle at ${ox}% ${oy}%, #FFF0F5 0%, #FFC6D9 40%, #E8B7F0 100%)`;

  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 0.45s ease';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'all';

    for (let i = 0; i < 15; i++) {
      setTimeout(() => spawnSparkle(overlay), i * 25);
    }

    setTimeout(() => {
      if (callback) callback();
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 450);
      }, 150);
    }, 500);
  });
}

/* ── Sparkle effect ── */
function spawnSparkle(parent = document.body, x = null, y = null) {
  const el = document.createElement('div');
  const emojis = ['✨', '⭐', '🌟', '💫', '✦'];
  el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  el.style.cssText = `
    position: absolute;
    left: ${x !== null ? x : Math.random() * 100}%;
    top: ${y !== null ? y : Math.random() * 100}%;
    font-size: ${0.8 + Math.random() * 1.2}rem;
    pointer-events: none;
    z-index: 9999;
    animation: sparkleAnim ${0.8 + Math.random() * 0.8}s ease-out forwards;
    --tx: ${(Math.random() - 0.5) * 100}px;
    --ty: ${-30 - Math.random() * 60}px;
  `;
  parent.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/* ── Click sparkles on body ── */
document.addEventListener('click', (e) => {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      const emojis = ['✦', '✧', '⋆', '✶'];
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.cssText = `
        position: fixed;
        left: ${e.clientX + (Math.random()-0.5)*35}px;
        top: ${e.clientY + (Math.random()-0.5)*35}px;
        font-size: ${0.6+Math.random()*0.8}rem;
        color: hsl(${Math.random()*60+300},80%,70%);
        pointer-events: none;
        z-index: 9998;
        animation: sparkleAnim ${0.5+Math.random()*0.5}s ease-out forwards;
        --tx: ${(Math.random()-0.5)*50}px;
        --ty: ${-20-Math.random()*40}px;
      `;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }, i * 35);
  }
});

/* ── Candy particle rain ── */
function initCandyRain(container) {
  if (!container) return;
  container.innerHTML = '';
  const candies = ['🍬', '🍭', '🍡', '⭐', '🌸', '✨', '💝', '🌟'];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'candy-particle';
    el.textContent = candies[Math.floor(Math.random() * candies.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (8 + Math.random() * 12) + 's';
    el.style.animationDelay = (-Math.random() * 15) + 's';
    el.style.fontSize = (0.8 + Math.random() * 1.4) + 'rem';
    container.appendChild(el);
  }
}

/* ── Hover sound on interactive elements ── */
document.addEventListener('mouseover', (e) => {
  if (e.target.closest('.loc-card, .achievement-card, .btn-magic, .hobby-card, .flip-card')) {
    if (window.audioManager && !window.audioManager.muted) {
      window.audioManager.playHover();
    }
  }
});

/* ── Screen router callback ── */
function onScreenActivated(screenName) {
  // Update Fairy Guide messages for that screen
  if (!window.fairy) return;

  const messagesMap = {
    'welcome': [
      '✨ Welcome, dear visitor! I\'m your Fairy Guide!',
      '🍭 Truffle Twinkle & Luna welcome you to the Candy Kingdom!',
      '🌟 Tap Enter to begin your journey!',
    ],
    'kingdom': [
      '✨ Tap any magical building to enter directly!',
      '🌸 My Candy Garden holds Luna\'s story!',
      '🍫 The Chocolate Factory holds the Virtual Pet project!',
      '🏰 The Castle is filled with flip certificates!',
      '🧁 Cupcake Café has hobbies and favourite subjects!',
      '🍩 Donut Mountain holds her big robotics & AI dream!',
    ],
    'garden': [
      '🌸 Welcome to Truffle Twinkle\'s Candy Garden!',
      '🎓 Luna is an ambitious A Level student!',
      '💻 Passionate about technology, designing and research!',
      '✨ Tap 🏠 Kingdom anytime to return to the map!',
    ],
    'factory': [
      '🍫 Welcome to the Chocolate Factory!',
      '🐾 Play with the Virtual Pet arcade simulation above!',
      '💻 Built with HTML, CSS, JavaScript and Python!',
      '🔗 Tap the link to view the live Homework 7 project!',
    ],
    'castle': [
      '🏰 Welcome to the Candy Castle!',
      '🏆 Tap the tabs to explore different achievements!',
      '🃏 Click or hover on cards to flip their certificates!',
    ],
    'cafe': [
      '🧁 Welcome to the Cupcake Café!',
      '📚 Luna loves Computer Science and Sociology!',
      '🎨 Her hobbies include reading, sketching, and cooking!',
    ],
    'mountain': [
      '🍩 Welcome to the peak of Donut Mountain!',
      '🤖 Big dream: robots that help everyday people!',
      '🚀 Aiming to work with great technology companies!',
    ]
  };

  const msgs = messagesMap[screenName] || messagesMap['kingdom'];
  window.fairy.messages = msgs;
  window.fairy.msgIndex = 0;
  window.fairy.greet(msgs[0]);

  // Animate skill bars if cafe or mountain
  if (screenName === 'cafe') {
    setTimeout(() => {
      document.querySelectorAll('#screen-cafe .interest-fill').forEach(bar => {
        bar.style.width = bar.dataset.width + '%';
      });
    }, 200);
  }
  if (screenName === 'mountain') {
    setTimeout(() => {
      document.querySelectorAll('#screen-mountain .skill-fill').forEach(bar => {
        bar.style.width = bar.dataset.width + '%';
      });
    }, 200);
  }
}

window.navigateTo = navigateTo;
window.spawnSparkle = spawnSparkle;
window.initCandyRain = initCandyRain;
window.onScreenActivated = onScreenActivated;
