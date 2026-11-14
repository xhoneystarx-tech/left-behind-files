/* The Left Behind Files: page logic. Depends on data.js and three.js r128. */
(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  kids.forEach(c => n.append(c));
  return n;
};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAD = Math.PI / 180;
/* small synth sounds shared by every game */
const Sfx = (function () {
  let ctx = null;
  function tone(f0, f1, dur, vol, type, delay) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (_) {}
  }
  return {
    yes() { tone(660, 660, 0.12, 0.15); tone(990, 990, 0.22, 0.15, 'triangle', 0.11); }, no() { tone(210, 150, 0.3, 0.1, 'square'); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 0.16, 'triangle', i * 0.11)); },
    zap() { tone(1800, 300, 0.4, 0.08, 'sawtooth'); }, tick() { tone(520, 520, 0.05, 0.08); }
  };
})();
/* background music: a quiet playlist for the whole site, with its own track for the Moon walk */
const Music = (function () {
  const LIST = ['music', 'm-feelalive', 'm-memories', 'm-latenight', 'm-falling'], a = new Audio(); a.preload = 'none';
  let on = true, started = false, i = Math.floor(Math.random() * LIST.length), special = null;
  const btn = document.getElementById('music');
  const load = () => { a.src = 'audio/' + (special || LIST[i % LIST.length]) + '.mp3'; a.loop = !!special; };
  const play = () => { if (!on || !started) return; if (!a.src) load(); a.play().catch(() => {}); };
  a.addEventListener('ended', () => { i++; load(); play(); });
  const label = () => { if (btn) { btn.textContent = on ? 'Music on' : 'Music off'; btn.setAttribute('aria-pressed', on); } };
  if (btn) btn.addEventListener('click', () => api.set(!on));
  setInterval(() => { const want = guideState.voice ? 0.08 : 0.2; a.volume += (want - a.volume) * 0.25; }, 120);   /* duck under Hy's voice */
  const first = () => { started = true; play(); removeEventListener('pointerdown', first); removeEventListener('keydown', first); };
  addEventListener('pointerdown', first); addEventListener('keydown', first);                                  /* browsers only allow sound after a tap */
  const api = {
    isOn: () => on, set(v) { on = !!v; label(); if (on) play(); else a.pause(); },
    scene(name) { if (special === name) return; special = name; load(); play(); }                               /* name = track for a quest, or null for the playlist */
  };
  a.volume = 0.2; label(); return api;
})();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dotsRow = n => { const d = el('div', { class: 'dots' }); for (let i = 0; i < n; i++) d.append(el('span')); return d; };
const answer = good => { if (good) Sfx.yes(); else Sfx.no(); G.react(good ? 'yes' : 'no'); };
const C = LBF.CASES, byId = {};
C.forEach(c => byId[c.id] = c);
['moon', 'mars'].forEach(w => C.filter(c => c.world === w)
  .forEach((c, i) => c.file = (w === 'moon' ? 'L-' : 'M-') + String(i + 1).padStart(2, '0')));
const STATUS_COL = { active: 0x58d7e6, mirror: 0xa57bff, silent: 0xc9c9cd, impact: 0xf5c26b, lost: 0xff5a4d };
const WORLD_NAME = { moon: 'the Moon', mars: 'Mars' };

const coordText = LBF.coordText;

/* ───────────────────────── Hy's voice (off until the visitor turns it on) ───────────────────────── */
const guideState = { typing: 0, voice: 0, think: false };
const Voice = (function () {
  const synth = window.speechSynthesis, ok = !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
  let on = false, voice = null;
  /* Hy's recorded voice: one clip per fixed line. Anything else falls back to the browser's voice. */
  const CLIPS = {"Hi, I'm Hy. Press Start and follow me.": "audio/hy-01.mp3", "Keep scrolling. I'll explain as we go.": "audio/hy-02.mp3", "Spin the Moon. Tap any light.": "audio/hy-03.mp3", "Press the big button. Count with me.": "audio/hy-04.mp3", "Mars! Teal lights are still driving.": "audio/hy-05.mp3", "Drag it. Look underneath.": "audio/hy-06.mp3", "Planned for 90 days. Lasted 14 years.": "audio/hy-07.mp3", "My favorite stop. Pick a game, or talk to me.": "audio/hy-08.mp3", "Last stop. Six questions, one badge.": "audio/hy-09.mp3", "This part is for grown-ups.": "audio/hy-10.mp3", "Still on the job. My kind of machine.": "audio/hy-11.mp3", "No batteries, no moving parts, still working. Smartest thing anyone ever left on the Moon.": "audio/hy-12.mp3", "Gone quiet. But the clues it sent home are still paying off.": "audio/hy-13.mp3", "This one went out with a bang, on purpose. Sometimes a crash is the experiment.": "audio/hy-14.mp3", "A cold case. Even the ones that got away taught the engineers something.": "audio/hy-15.mp3", "Voice on. Now I can talk you through the files, partner.": "audio/hy-16.mp3", "Echo received. That's how scientists know the Moon is slipping away from us, 3.8 cm a year.": "audio/hy-17.mp3", "Wrong world, partner. Our machine is on the Moon.": "audio/hy-18.mp3", "Wrong world, partner. Our machine is on Mars.": "audio/hy-19.mp3", "Ask me yes-or-no questions about the mystery machine. I won't say its name.": "audio/hy-20.mp3", "That's the tour. Now go poke around yourself. Every light has a story.": "audio/hy-21.mp3", "Pull up a chair, kid. Ask me about any machine on the Moon or Mars and I'll take you there. Or say the word and we'll play a game.": "audio/hy-22.mp3", "I lost my train of thought. Ask me again?": "audio/hy-23.mp3", "I can only answer yes-or-no questions when my live line is up. Use the clues on the globe, partner.": "audio/hy-24.mp3", "A perfect score. You could run this agency, kid.": "audio/hy-25.mp3", "Case closed. You earned your badge, partner.": "audio/hy-26.mp3", "Find all four. Remember them. I will ask.": "audio/hy-27.mp3", "Whose shadow is this?": "audio/hy-28.mp3", "Last stop. Real or fake? You decide.": "audio/hy-29.mp3", "I name a robot. You click its light.": "audio/hy-30.mp3", "You know Mars like a local.": "audio/hy-31.mp3", "Good eye, detective.": "audio/hy-32.mp3", "They just would not quit.": "audio/hy-33.mp3"};
  let playing = null;
  const pick = () => {
    const vs = synth.getVoices().filter(v => /^en/i.test(v.lang));
    voice = vs.find(v => /Samantha|Aria|Jenny|Zira|Google US English|female/i.test(v.name)) || vs[0] || null;
  };
  if (ok) { try { pick(); synth.addEventListener('voiceschanged', pick); } catch (_) {} }
  function stop() { if (playing) { try { playing.pause(); } catch (_) {} playing = null; } if (ok) { try { synth.cancel(); } catch (_) {} } guideState.voice = 0; }
  function clip(src) {
    return new Promise(res => {
      stop(); const a = new Audio(src); playing = a; let done = false;
      const end = () => { if (done) return; done = true; if (playing === a) { playing = null; guideState.voice = 0; } res(true); };
      a.onplaying = () => { guideState.voice = 1; }; a.onended = end; a.onerror = end; a.onpause = end;
      const p = a.play(); if (p && p.catch) p.catch(end);
    });
  }
  /* resolves when the line has been spoken (or at once when the voice is off) */
  function speak(text, opts) {
    return new Promise(res => {
      if (!on || !text) return res(false);
      if (CLIPS[text] && !(opts && opts.pitch)) return clip(CLIPS[text]).then(res);
      if (!ok) return res(false);
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(String(text).slice(0, 900));
        if (voice) u.voice = voice;
        u.lang = 'en-US'; u.pitch = (opts && opts.pitch) || 1.2; u.rate = (opts && opts.rate) || 1.0;
        let done = false; const end = () => { if (done) return; done = true; guideState.voice = 0; res(true); };
        u.onstart = () => { guideState.voice = 1; }; u.onend = end; u.onerror = end;
        setTimeout(end, 40000);
        synth.speak(u);
      } catch (e) { guideState.voice = 0; res(false); }
    });
  }
  return { ok: true, isOn: () => on, set(v) { on = !!v; if (!on) stop(); }, speak, stop, clip };
})();
function setVoice(v) {
  Voice.set(v);
  const b = $('#sound'); b.setAttribute('aria-pressed', Voice.isOn()); b.textContent = Voice.isOn() ? 'Voice on' : 'Voice off';
  $('#bubble-voice').hidden = Voice.isOn() || !Voice.ok;
  if (Voice.isOn()) say("Voice on. Now I can talk you through the files, partner.", true);
}
$('#sound').addEventListener('click', () => setVoice(!Voice.isOn()));
$('#bubble-voice').addEventListener('click', () => setVoice(true));

/* ───────────────────────── The guide's notes ───────────────────────── */
const SAY = {
  top: "Hi, I'm Hy. Press Start and follow me.",
  story: "Keep scrolling. I'll explain as we go.",
  moon: "Spin the Moon. Tap any light.",
  mirrors: "Press the big button. Count with me.",
  mars: "Mars! Teal lights are still driving.",
  models: "Whose shadow is this?",
  overtime: "Planned for 90 days. Lasted 14 years.",
  ask: "My favorite stop. Pick a game, or talk to me.",
  quiz: "Last stop. Real or fake? You decide.",
  sources: "This part is for grown-ups."
};
const sayEl = $('#say'), guide = $('#guide');
let typing = null;
let restTimer = null;
function wake(ms) { guide.classList.remove('rest'); clearTimeout(restTimer); restTimer = setTimeout(() => guide.classList.add('rest'), ms || 9000); }
function say(text, force, opts) {
  if (!text || (sayEl.dataset.full === text && !force)) return Promise.resolve();
  sayEl.dataset.full = text;
  clearInterval(typing); guideState.typing = 0; wake(9000 + text.length * 60);
  const spoken = opts && opts.silent ? Promise.resolve(false) : Voice.speak(text, opts);
  if (RM) { sayEl.textContent = text; return spoken; }
  let i = 0; sayEl.textContent = '';
  guideState.typing = 1;
  typing = setInterval(() => {
    i++; sayEl.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(typing); guideState.typing = 0; }
  }, 24);
  return spoken;
}
sayEl.textContent = SAY.top; sayEl.dataset.full = SAY.top; wake(innerWidth < 760 ? 7000 : 14000);
$('#guide-btn').addEventListener('pointerenter', () => wake(6000));
$('#bubble').addEventListener('pointerenter', () => wake(12000));
$('#bubble-x').addEventListener('click', () => G.hide());
$('#guide-show').addEventListener('click', () => G.back());
const secs = [$('#top')].concat($$('section[data-say]'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const key = e.target.dataset.say || 'top';
    say(SAY[key]);
    $$('.bar nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-35% 0px -55% 0px' });
  secs.forEach(s => io.observe(s));
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = document.getElementById(a.getAttribute('href').slice(1));
  if (t) { e.preventDefault(); t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
}));

/* ───────────────────────── The guide: five clips, one state machine ───────────────────────── */
const G = (function () {
  const btn = $('#guide-btn'), M = window.LBF_MEDIA || {}, vids = {};
  let cur = null, away = false, scrollT = -1e9;
  const ok = !RM && !!M.speaking && !!document.createElement('video').canPlayType('video/mp4');
  if (ok) ['appear', 'speaking', 'moving', 'sleeping', 'disappear', 'micin', 'mic', 'yes', 'no'].forEach(n => {
    if (!M[n]) return;
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.preload = 'auto'; v.loop = n === 'speaking' || n === 'moving' || n === 'sleeping' || n === 'mic'; v.src = M[n];
    btn.append(v); vids[n] = v;
  });
  function show(n) {
    if (!ok || cur === n) return;
    const prev = cur && vids[cur === 'idle' ? 'speaking' : cur]; cur = n;
    if (n === 'idle') {          /* awake but quiet: hold the smiling first frame of the speaking clip */
      const v = vids.speaking; v.pause(); try { v.currentTime = 0; } catch (_) {}
      for (const k in vids) vids[k].classList.toggle('on', vids[k] === v);
      if (prev && prev !== v) prev.pause();
      return;
    }
    const v = vids[n];
    try { v.currentTime = 0; } catch (_) {}
    const swap = () => {
      if (cur !== n) return;
      for (const k in vids) vids[k].classList.toggle('on', vids[k] === v);
      if (prev && prev !== v) prev.pause();
      const img = btn.querySelector('img'); if (img) img.style.opacity = 0;
    };
    const p = v.play(); if (p && p.then) p.then(swap).catch(() => {}); else swap();
  }
  /* speaking while there is something to say, moving while the page scrolls or Hy is thinking, asleep when left alone */
  function decide() {
    if (!ok || away || cur === 'appear' || cur === 'disappear' || cur === 'yes' || cur === 'no') return;
    /* speaking out loud: Hy pulls out a microphone, then talks into it */
    if (guideState.voice && vids.mic) { if (cur !== 'mic' && cur !== 'micin') show(vids.micin ? 'micin' : 'mic'); return; }
    if (cur === 'micin') cur = null;
    const busy = guideState.think || performance.now() - scrollT < 350;
    const talking = guideState.typing || guideState.voice;
    show(busy ? 'moving' : talking ? 'speaking' : (guide.classList.contains('rest') && !guide.classList.contains('chatting')) ? 'sleeping' : 'idle');
  }
  if (ok) {
    vids.appear.addEventListener('ended', () => { cur = null; decide(); });
    if (vids.micin) vids.micin.addEventListener('ended', () => { if (cur !== 'micin') return; if (guideState.voice) show('mic'); else { cur = null; decide(); } });
    ['yes', 'no'].forEach(n => vids[n] && vids[n].addEventListener('ended', () => { if (cur === n) { cur = null; decide(); } }));
    vids.disappear.addEventListener('ended', () => finishHide());
    addEventListener('scroll', () => { scrollT = performance.now(); }, { passive: true });
    setInterval(decide, 200);
    show('appear');
  }
  function finishHide() { guide.classList.add('gone'); $('#guide-show').hidden = false; }
  return {
    react(n) { if (ok && vids[n] && !away && cur !== 'appear' && cur !== 'disappear') { cur = null; show(n); } },   /* nod yes / shake no */
    hide() { away = true; guide.classList.add('away'); if (ok) show('disappear'); else finishHide(); },
    back() { away = false; guide.classList.remove('gone', 'away'); $('#guide-show').hidden = true; cur = null; if (ok) show('appear'); wake(12000); }
  };
})();

/* trailer and the AI badge */
(function () {
  const box = $('#trailer'), v = $('#trailer-v');
  const close = () => { box.classList.remove('open'); v.pause(); };
  $('#trailer-open').addEventListener('click', () => {
    box.classList.add('open');
    const start = () => { if (!v.src) v.src = window.LBF_INTRO; v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    if (window.LBF_INTRO) return start();
    const sc = document.createElement('script'); sc.src = 'intro.js'; sc.onload = start; document.head.append(sc);
  });
  $('#trailer-x').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const star = $('#aistar'), M = window.LBF_MEDIA || {};
  if (star && M.aistar) { star.src = M.aistar; if (!RM) { star.autoplay = true; const p = star.play(); if (p && p.catch) p.catch(() => {}); } }
  else if (star) star.remove();
})();

/* ───────────────────────── Case lists and files ───────────────────────── */
const selected = { moon: 'apollo11', mars: 'perseverance' };
const filterOf = { moon: 'all', mars: 'all' };
const globes = {};

const key = $('#statuskey');
Object.keys(LBF.STATUS).forEach(s => key.append(el('li', {}, el('span', { class: 'dot s-' + s }), el('span', { text: LBF.STATUS[s].label }))));

function buildPicker(world) {
  const list = $('.caselist[data-world="' + world + '"]'), filt = $('.filters[data-world="' + world + '"]');
  const cases = C.filter(c => c.world === world);
  const opts = [['all', 'All ' + cases.length]];
  Object.keys(LBF.STATUS).forEach(s => { const n = cases.filter(c => c.status === s).length; if (n) opts.push([s, LBF.STATUS[s].label + ' ' + n]); });
  opts.forEach(([v, label]) => filt.append(el('button', { class: 'chip', 'aria-pressed': v === 'all', 'data-v': v, text: label, onclick: () => {
    filterOf[world] = v;
    $$('.chip', filt).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
    $$('li', list).forEach(li => li.hidden = v !== 'all' && byId[li.dataset.id].status !== v);
    if (globes[world]) globes[world].applyFilter(v);
  } })));
  cases.forEach(c => list.append(el('li', { 'data-id': c.id }, el('button', { 'aria-current': c.id === selected[world], onclick: () => openCase(c.id, { user: true }) },
    el('span', { class: 'dot s-' + c.status }), el('span', { class: 'nm', text: c.name }), el('span', { class: 'yr', text: c.year + ' · ' + LBF.KINDS[c.kind] })))));
}
function renderFile(c) {
  const box = $('#file-' + c.world);
  box.dataset.file = 'File ' + c.file;
  box.replaceChildren(
    el('h3', { text: c.name }),
    el('div', { class: 'stamp s-' + c.status, text: LBF.STATUS[c.status].label }),
    el('p', { class: 'quiet', text: c.date + '. ' + c.site + '.' }),
    el('p', { class: 'sum', text: (c.story.match(/^.*?[.!?](?=\s|$)/) || [c.story])[0] }),
    el('details', {}, el('summary', { text: 'Read the whole file' }),
      el('div', { class: 'blk' }, el('h4', { text: 'What happened' }), el('p', { text: c.story })),
      el('div', { class: 'blk' }, el('h4', { text: 'What it taught us' }), el('p', { text: c.science })),
      el('div', { class: 'blk' }, el('h4', { text: 'Still there today' }), el('p', { text: c.left })),
      el('p', { class: 'clue', text: c.clue }),
      el('p', { class: 'quiet', text: 'Map: ' + coordText(c) }),
      el('p', { class: 'src' }, document.createTextNode('Source: '), el('a', { href: c.src[1], target: '_blank', rel: 'noopener', text: c.src[0] }))),
    el('div', { class: 'row' },
      c.model ? el('button', { class: 'btn onpaper', text: 'See it in 3D', onclick: () => { showModel(c.model); $('#models').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); } }) : '',
      el('button', { class: 'btn onpaper ghost', text: 'Ask Hy', onclick: () => ask('Tell me more about ' + c.name + '.') }),
      c.status !== 'lost' ? el('button', { class: 'btn onpaper ghost', text: 'Interview it', onclick: () => LBF.interview(c.id) }) : ''),
    ''
  );
}
const QUIPS = {
  active: "Still on the job. My kind of machine.",
  mirror: "No batteries, no moving parts, still working. Smartest thing anyone ever left on the Moon.",
  silent: "Gone quiet. But the clues it sent home are still paying off.",
  impact: "This one went out with a bang, on purpose. Sometimes a crash is the experiment.",
  lost: "A cold case. Even the ones that got away taught the engineers something."
};
function openCase(id, opts = {}) {
  const c = byId[id]; if (!c) return;
  if (opts.user && Missions.intercept(c)) return;
  Notebook.file(id);
  selected[c.world] = id;
  $$('.caselist[data-world="' + c.world + '"] button').forEach(b => b.setAttribute('aria-current', b.parentNode.dataset.id === id));
  renderFile(c);
  if (globes[c.world]) globes[c.world].focus(id);
  if (opts.reveal) $('#' + c.world).scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  if (!opts.quiet) { say(c.name + '. ' + QUIPS[c.status], true, { silent: true }); Voice.speak(QUIPS[c.status]); }
}
['moon', 'mars'].forEach(w => { buildPicker(w); renderFile(byId[selected[w]]); });

/* ───────────────────────── Overtime: stop the bar where you think the machine quit ───────────────────────── */
(function () {
  const box = $('#over'), SCALE = 64, items = LBF.OVER, dots = dotsRow(items.length);
  const ask = el('p', { class: 'ask', text: 'When did each one quit? Stop the bar.' }), go = el('button', { class: 'btn big', text: 'Start' });
  const rows = el('div', { class: 'over-rows' });
  box.append(el('div', { class: 'game' }, ask, el('div', { class: 'row' }, go, dots)), rows);
  let i = -1, raf = 0, t0 = 0, cur = null, close = 0;
  function next() {
    i++; if (i >= items.length) { ask.textContent = close + ' of ' + items.length + ' close guesses. They all beat the plan.'; go.textContent = 'Play again'; go.hidden = false; i = -1; Notebook.badge('stay'); Sfx.win(); say('They just would not quit.', true); return; }
    if (i === 0) { rows.replaceChildren(); close = 0; $$('span', dots).forEach(d => d.className = ''); }
    const o = items[i], fill = el('div', { class: 'fill', style: 'width:0%' }), x = el('div', { class: 'x', text: '' }), mark = el('div', { class: 'guess', hidden: '' });
    const plan = el('div', { class: 'plan', style: 'left:' + (100 / SCALE) + '%' });
    const d = el('div', { class: 'd', text: 'Plan: ' + o.plan });
    rows.append(el('div', { class: 'r' }, el('div', { class: 'n', text: o.name }), el('div', { class: 'track' }, fill, plan, mark, x), d));
    cur = { o, fill, x, mark, d, v: 0, guess: null };
    ask.textContent = o.name + ': planned ' + o.plan + '. When did it quit?'; go.textContent = 'Stop!'; go.hidden = false;
    t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(run);
  }
  function show(c) { c.fill.style.width = (c.v / SCALE * 100) + '%'; c.x.style.left = (c.v / SCALE * 100) + '%'; c.x.textContent = (c.v < 10 ? c.v.toFixed(1) : Math.round(c.v)) + '× the plan'; }
  function run(now) {
    const c = cur; if (!c) return;
    if (c.guess === null) { c.v = Math.min(SCALE - 2, (now - t0) / 1000 * 9); show(c); if (c.v >= SCALE - 2) stopAt(); }
    else {                                                          /* after the guess, the bar races on to the real answer */
      c.v += (c.o.x - c.v) * 0.09; if (Math.abs(c.o.x - c.v) < 0.15) c.v = c.o.x; show(c);
      if (c.v === c.o.x) { c.d.textContent = 'Plan: ' + c.o.plan + '. Really: ' + c.o.did + '.'; cur = null; setTimeout(next, 1700); return; }
    }
    raf = requestAnimationFrame(run);
  }
  function stopAt() {
    const c = cur; if (!c || c.guess !== null) return; c.guess = c.v; go.hidden = true;
    c.mark.hidden = false; c.mark.style.left = (c.guess / SCALE * 100) + '%';
    const good = Math.abs(c.guess - c.o.x) <= Math.max(3, c.o.x * 0.25); if (good) close++;
    dots.children[i].className = good ? 'ok' : 'miss'; answer(good);
    ask.textContent = c.guess < c.o.x ? 'It kept going!' : 'Not quite that long.';
  }
  go.addEventListener('click', () => { if (cur && cur.guess === null) stopAt(); else if (!cur) next(); });
})();

/* ───────────────────────── Last stop: real or fake? ───────────────────────── */
(function () {
  const box = $('#quiz-box'), list = LBF.REAL; let order = [], i = 0, right = 0;
  const dots = dotsRow(list.length), card = el('div', { class: 'claim' }), why = el('p', { class: 'why' });
  const bReal = el('button', { class: 'btn big real', text: 'Real' }), bFake = el('button', { class: 'btn big fake', text: 'Fake' }), again = el('button', { class: 'btn', text: 'Play again', hidden: '' });
  box.append(el('div', { class: 'game' }, dots, card, el('div', { class: 'row' }, bReal, bFake, again), why));
  function show() {
    if (i >= order.length) {
      const rank = right === order.length ? 'Chief Inspector' : right >= 6 ? 'Detective' : 'Junior Detective';
      card.textContent = right + ' of ' + order.length + '. Badge: ' + rank + '.'; why.textContent = ''; bReal.hidden = bFake.hidden = true; again.hidden = false;
      Notebook.badge('quiz'); Sfx.win();
      say(right === order.length ? "A perfect score. You could run this agency, kid." : "Case closed. You earned your badge, partner.", true); return;
    }
    card.textContent = order[i][0]; card.className = 'claim'; why.textContent = ''; bReal.disabled = bFake.disabled = false;
  }
  function pick(real) {
    const q = order[i], good = real === q[1]; if (good) right++; answer(good);
    dots.children[i].className = good ? 'ok' : 'miss'; card.className = 'claim ' + (q[1] ? 'isreal' : 'isfake');
    why.textContent = (q[1] ? 'Real. ' : 'Fake. ') + q[2]; bReal.disabled = bFake.disabled = true;
    i++; setTimeout(show, 2600);
  }
  function start() { order = shuffle(list); i = 0; right = 0; $$('span', dots).forEach(d => d.className = ''); bReal.hidden = bFake.hidden = false; again.hidden = true; show(); }
  bReal.addEventListener('click', () => pick(true)); bFake.addEventListener('click', () => pick(false)); again.addEventListener('click', start);
  start();
})();

/* ───────────────────────── Sources ───────────────────────── */
LBF.SOURCES.forEach(g => {
  const ul = el('ul');
  g.items.forEach(([t, u]) => ul.append(el('li', {}, el('a', { href: u, target: '_blank', rel: 'noopener', text: t }))));
  $('#srcgrid').append(el('div', {}, el('h3', { text: g.group }), ul));
});

/* ───────────────────────── Laser experiment (logic) ───────────────────────── */
const LIGHT = 299792.458, NEAR = 363300, FAR = 405500;
const MIRRORS = [['apollo11', 'Apollo 11'], ['apollo14', 'Apollo 14'], ['apollo15', 'Apollo 15'], ['blueghost', 'Blue Ghost']];
const laser = { t0: 0, total: 0, firing: false, frac: 0 };
const echo = { round: 0, close: 0, dots: dotsRow(3), msg: $('#echo-msg') };
$('#echo-dots').append(echo.dots);
function echoEnd(t) {                                   /* t = when the child pressed Catch, or null if they never did */
  const diff = t === null ? 9 : t - laser.total, a = Math.abs(diff), good = a < 0.3;
  laser.firing = false; laser.frac = 0; if (good) echo.close++;
  echo.dots.children[echo.round].className = good ? 'ok' : 'miss'; echo.round++; answer(good);
  $('#echo').textContent = laser.total.toFixed(2) + ' s';
  echo.msg.textContent = t === null ? 'It came back and you missed it!' : a < 0.12 ? 'Bullseye!' : (diff < 0 ? 'Too early by ' : 'Too late by ') + a.toFixed(2) + ' s';
  const km = Math.round(laser.d).toLocaleString('en-US');
  $('#dist').textContent = 'There and back in ' + laser.total.toFixed(2) + ' s. The Moon is ' + km + ' km away.';
  if (echo.round >= 3) {
    $('#fire').textContent = 'Play again'; Notebook.badge('laser'); Sfx.win();
    say("Echo received. That's how scientists know the Moon is slipping away from us, 3.8 cm a year.", true);
  } else $('#fire').textContent = 'Fire again';
}
$('#fire').addEventListener('click', () => {
  if (laser.firing) { echoEnd((performance.now() - laser.t0) / 1000); return; }
  if (echo.round >= 3) { echo.round = 0; echo.close = 0; $$('span', echo.dots).forEach(d => d.className = ''); }
  const d = NEAR + (FAR - NEAR) * Math.random();
  laser.total = 2 * d / LIGHT; laser.d = d; laser.t0 = performance.now(); laser.firing = true; Sfx.zap();
  echo.msg.textContent = 'Watch the light…'; $('#dist').textContent = ''; $('#fire').textContent = 'Catch the echo!';
});
function laserStep(now) {
  if (!laser.firing) return;
  const t = (now - laser.t0) / 1000;
  $('#echo').textContent = t.toFixed(2) + ' s';
  if (t >= laser.total + 1.2) { echoEnd(null); return; }
  const f = Math.min(1, t / laser.total); laser.frac = f < .5 ? f * 2 : 2 - f * 2;
}

/* ───────────────────────── 3D ───────────────────────── */
let three = false, showModel = function () {};
try { three = init3D(); } catch (err) { console.warn('3D unavailable:', err); }

/* Stop 3: find each robot on Mars. Hy names one, you click its light. Wrong lights tell you who they are. */
(function () {
  const box = $('#g-mars'); if (!box) return; if (!globes.mars) { box.hidden = true; return; }
  const N = 5, dots = dotsRow(N), ask = el('p', { class: 'ask', text: 'Can you find 5 robots on Mars?' }), go = el('button', { class: 'btn big', text: 'Start' }), hint = el('p', { class: 'why' });
  box.append(ask, el('div', { class: 'row' }, go, dots), hint);
  let order = [], i = 0, misses = 0, first = 0;
  const g = () => globes.mars;
  function round() {
    if (i >= N) { g().onPick = null; ask.textContent = first + ' of ' + N + ' on the first try!'; hint.textContent = ''; go.textContent = 'Play again'; go.hidden = false; Notebook.badge('pin'); Sfx.win(); say('You know Mars like a local.', true); return; }
    misses = 0; ask.textContent = 'Click on: ' + order[i].name; hint.textContent = '';
  }
  go.addEventListener('click', () => {
    if (!g()) return;
    order = shuffle(C.filter(c => c.world === 'mars')).slice(0, N); i = 0; first = 0; go.hidden = true;
    $$('span', dots).forEach(d => d.className = ''); C.forEach(c => c.world === 'mars' && g().mark(c.id, 0xffffff));
    g().onPick = id => {
      const t = order[i]; if (!t) return;
      if (id === t.id) { answer(true); if (!misses) first++; dots.children[i].className = misses ? 'miss' : 'ok'; g().mark(id, 0x4be37a); g().focus(id); renderFile(t); i++; hint.textContent = 'Found it!'; setTimeout(round, 1300); }
      else { answer(false); misses++; g().mark(id, 0xff5a4d); hint.textContent = 'That one is ' + byId[id].name + '. Try another.'; if (misses >= 2) g().focus(t.id); }
    };
    say('I name a robot. You click its light.', true); round();
  });
})();

/* Stop 4: whose shadow is this? The model is blacked out until you name it. */
(function () {
  const box = $('#g-models'); if (!box) return; if (!LBF.shadow) { box.hidden = true; return; }
  const keys = Object.keys(LBF.MODELS), N = Math.min(5, keys.length), dots = dotsRow(N);
  const ask = el('p', { class: 'ask', text: 'Can you name a machine by its shadow?' }), go = el('button', { class: 'btn big', text: 'Start' }), choices = el('div', { class: 'choices' });
  box.append(ask, el('div', { class: 'row' }, go, dots), choices);
  let order = [], i = 0, right = 0;
  function round() {
    const hangar = $('#models .hangar');
    if (i >= N) { LBF.shadow(false); hangar.classList.remove('playing'); choices.replaceChildren(); ask.textContent = right + ' of ' + N + '. Now spin them yourself.'; go.textContent = 'Play again'; go.hidden = false; Notebook.badge('shadow'); Sfx.win(); say('Good eye, detective.', true); return; }
    const key = order[i]; let missed = false; hangar.classList.add('playing'); LBF.shadow(true); showModel(key); ask.textContent = 'Whose shadow is this? Spin it.';
    choices.replaceChildren(...shuffle([key].concat(shuffle(keys.filter(k => k !== key)).slice(0, 2))).map(k => el('button', { class: 'btn ghost', text: LBF.MODELS[k].name, onclick: e => {
      if (k !== key) { answer(false); missed = true; e.currentTarget.disabled = true; return; }
      answer(true); if (!missed) right++; dots.children[i].className = missed ? 'miss' : 'ok'; LBF.shadow(false); ask.textContent = LBF.MODELS[key].name + '!';
      $$('button', choices).forEach(b => b.disabled = true); i++; setTimeout(round, 2200);
    } })));
  }
  go.addEventListener('click', () => { order = shuffle(keys).slice(0, N); i = 0; right = 0; go.hidden = true; $$('span', dots).forEach(d => d.className = ''); say('Whose shadow is this?', true); round(); });
})();
if (!three) {
  document.body.classList.add('no3d');
  (function loop(now) { laserStep(now); requestAnimationFrame(loop); })(performance.now());
}

function init3D() {
  if (!window.THREE) return false;
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  const texLoader = new THREE.TextureLoader();
  const tex = (file, fallback) => {
    const t = texLoader.load('assets/' + file, undefined, undefined, () => { if (fallback) fallback(); });
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };
  const views = [];
  const ll = (lat, lon, r) => {
    const phi = (lon + 180) * RAD, cl = Math.cos(lat * RAD);
    return new THREE.Vector3(-Math.cos(phi) * cl * r, Math.sin(lat * RAD) * r, Math.sin(phi) * cl * r);
  };
  const moonTex = tex('moon.jpg'), marsTex = tex('mars.jpg');
  const globeMat = (map, tint) => new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, color: tint || 0xffffff });

  /* sky */
  const sky = new THREE.Scene(), skyCam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 32), new THREE.MeshBasicMaterial({ map: tex('stars.jpg'), side: THREE.BackSide, color: 0xbbbbbb }));
  sky.add(skyMesh);

  /* hero: the Moon up close, Mars in the distance, lit from one side */
  (function () {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100); cam.position.z = 7;
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.1, 96, 64), globeMat(moonTex));
    const mars = new THREE.Mesh(new THREE.SphereGeometry(0.62, 64, 48), globeMat(marsTex));
    scene.add(moon, mars, new THREE.AmbientLight(0xffffff, 0.06));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(-4, 1.2, 1.2); scene.add(sun);
    moon.rotation.y = -1.9; mars.rotation.y = 2.2;
    views.push({ el: $('#st-hero'), scene, cam, update(dt, a) {
      const wide = a > 1.05;
      moon.position.set(wide ? Math.min(3.2, 1.25 * a) : 0.6, wide ? -0.9 : -2.5, 0);
      mars.position.set(wide ? Math.min(3.4, 1.5 * a) - 2.9 : 1.0, wide ? 1.75 : 2.75, -3);
      if (!RM) { moon.rotation.y += dt * 0.012; mars.rotation.y += dt * 0.05; }
    } });
  })();

  /* interactive globes */
  function makeGlobe(world, map, tint) {
    const stage = $('#st-' + world), tip = $('.tip', stage), label = $('.pinlabel', stage);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const globe = new THREE.Group(); scene.add(globe);
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), globeMat(map, tint)));
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const keyL = new THREE.DirectionalLight(0xffffff, 1.2); keyL.position.set(-2.4, 1.6, 2.8); scene.add(keyL);
    const pins = {}, hits = [];
    C.filter(c => c.world === world).forEach(c => {
      const p = c.plot ? ll(c.plot[0], c.plot[1], 1.002) : ll(c.lat, c.lon, 1.002);
      const g = new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().multiplyScalar(2));
      const col = STATUS_COL[c.status];
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.015, 20), new THREE.MeshBasicMaterial({ color: col }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.033, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
      dot.position.z = 0.003; ring.position.z = 0.003;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.userData.id = c.id;
      g.add(dot, ring, hit); globe.add(g); pins[c.id] = { g, dot, ring, hit }; hits.push(hit);
    });
    const rot = { x: 0.2, y: 0 }, target = { x: 0.2, y: 0 };
    let idle = 0, drag = null, sel = null, clock = 0;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3(), camDir = new THREE.Vector3(0, 0, 1);
    const facing = obj => obj.getWorldPosition(v).normalize().dot(camDir) > 0.12;
    function pick(e) {
      const r = stage.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const h = ray.intersectObjects(hits.filter(x => x.parent.visible)).find(x => facing(x.object));
      return h ? { id: h.object.userData.id, x: e.clientX - r.left, y: e.clientY - r.top } : null;
    }
    stage.addEventListener('pointerdown', e => { if (e.target.closest('.mission')) return; drag = { x: e.clientX, y: e.clientY, moved: 0 }; stage.classList.add('grabbing'); try { stage.setPointerCapture(e.pointerId); } catch (_) {} });
    stage.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        target.y += dx * 0.006; target.x = Math.max(-1.35, Math.min(1.35, target.x + dy * 0.006)); idle = 0; tip.style.display = 'none';
      } else {
        const h = pick(e);
        if (h && !api.onPick) { tip.textContent = byId[h.id].name; tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px'; tip.style.display = 'block'; stage.style.cursor = 'pointer'; }
        else { tip.style.display = 'none'; stage.style.cursor = ''; }
      }
    });
    const end = e => {
      stage.classList.remove('grabbing');
      if (drag && drag.moved < 6) { const h = pick(e); if (h) { if (api.onPick) api.onPick(h.id); else openCase(h.id, { user: true }); } }
      drag = null;
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', () => { drag = null; stage.classList.remove('grabbing'); });
    stage.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    const api = {
      focus(id) {
        const c = byId[id]; sel = id; idle = -6;
        const la = c.plot ? c.plot[0] : c.lat, lo = c.plot ? c.plot[1] : c.lon;
        let ty = -Math.PI / 2 - lo * RAD;
        ty += Math.round((rot.y - ty) / (2 * Math.PI)) * 2 * Math.PI;
        target.y = ty; target.x = Math.max(-1.25, Math.min(1.25, la * RAD));
        label.textContent = c.name;
      },
      mark(id, col) { const p = pins[id]; if (!p) return; const c = col === null ? STATUS_COL[byId[id].status] : col; p.dot.material.color.set(c); p.ring.material.color.set(c); },
      applyFilter(f) { for (const id in pins) pins[id].g.visible = f === 'all' || byId[id].status === f; }
    };
    views.push({ el: stage, scene, cam, update(dt, a, rect) {
      clock += dt; idle += dt;
      cam.position.z = 4.5 / Math.min(1, a * 0.98);
      if (!drag && idle > 4 && !RM) target.y += dt * 0.05;
      const k = RM ? 1 : Math.min(1, dt * 5);
      rot.x += (target.x - rot.x) * k; rot.y += (target.y - rot.y) * k;
      globe.rotation.set(rot.x, rot.y, 0);
      globe.updateMatrixWorld(true);
      for (const id in pins) {
        const p = pins[id], on = id === sel, s = on ? 2.1 : 1;
        p.dot.scale.setScalar(s);
        p.ring.scale.setScalar(on ? 2.1 + (RM ? 0 : Math.sin(clock * 4) * 0.35) : 1);
        p.ring.material.opacity = on ? 1 : 0.7;
      }
      const sp = sel && pins[sel];
      if (sp && sp.g.visible && facing(sp.g)) {
        sp.g.getWorldPosition(v).project(cam);
        label.style.display = 'block';
        label.style.left = ((v.x + 1) / 2 * rect.width) + 'px';
        label.style.top = ((1 - v.y) / 2 * rect.height) + 'px';
      } else label.style.display = 'none';
    } });
    return api;
  }
  globes.moon = makeGlobe('moon', moonTex);
  globes.mars = makeGlobe('mars', marsTex, 0xffe9dc);
  globes.moon.focus(selected.moon); globes.mars.focus(selected.mars);

  /* laser view */
  (function () {
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-5, 5, 1.3, -1.3, 0.1, 50);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), globeMat(tex('earth.jpg')));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.273, 48, 32), globeMat(moonTex));
    earth.position.x = -3.4; moon.position.x = 3.9; earth.rotation.y = 1.2; moon.rotation.y = -Math.PI / 2;
    scene.add(earth, moon, new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-1, 1.5, 4); scene.add(sun);
    const a = new THREE.Vector3(-2.4, 0.05, 0), b = new THREE.Vector3(3.63, 0.02, 0);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0x63f08a, transparent: true, opacity: 0.18 }));
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0x63f08a }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0x63f08a, transparent: true, opacity: 0.25 }));
    pulse.add(glow); pulse.visible = false; scene.add(line, pulse);
    views.push({ el: $('#st-laser'), scene, cam, update(dt, asp) {
      const hw = Math.max(5.1, 1.35 * asp), hh = hw / asp;
      cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.position.set(0.25, 0, 10);
      if (!RM) earth.rotation.y += dt * 0.05;
      pulse.visible = laser.firing;
      line.material.opacity = laser.firing ? 0.5 : 0.18;
      if (laser.firing) pulse.position.lerpVectors(a, b, laser.frac);
    } });
  })();

  /* model viewer */
  (function () {
    const stage = $('#st-model'), loadingEl = $('#model-loading');
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    const holder = new THREE.Group(); scene.add(holder);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a30, 0.85));
    const k = new THREE.DirectionalLight(0xffffff, 1.5); k.position.set(3, 4, 5); scene.add(k);
    const rim = new THREE.DirectionalLight(0xbfd9ff, 0.7); rim.position.set(-4, 2, -4); scene.add(rim);
    const cache = {}, rot = { x: 0.28, y: -0.6 }; let drag = null, idle = 9, current = null;
    const loader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
    function fit(obj) {
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group(); obj.position.sub(ctr); wrap.add(obj);
      wrap.scale.setScalar(2 / Math.max(size.x, size.y, size.z)); return wrap;
    }
    function load(key) {
      if (cache[key]) return Promise.resolve(cache[key]);
      return new Promise((res, rej) => {
        if (!loader) return rej(new Error('no loader'));
        const parse = () => {
          try {
            const bin = atob(window.LBF_MODELS[key]), buf = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
            /* decode the models' built-in textures through <img>, which works under stricter page security rules */
            const cib = window.createImageBitmap;
            try { window.createImageBitmap = undefined; } catch (_) {}
            try { loader.parse(buf.buffer, '', g => { cache[key] = fit(g.scene); res(cache[key]); }, rej); }
            finally { try { window.createImageBitmap = cib; } catch (_) {} }
          } catch (e) { rej(e); }
        };
        if (window.LBF_MODELS && window.LBF_MODELS[key]) return parse();
        /* each model ships as its own script so only the one you pick is downloaded */
        const sc = document.createElement('script');
        sc.src = 'models/' + key + '.js'; sc.onload = parse; sc.onerror = () => rej(new Error('model file missing'));
        document.head.append(sc);
      });
    }
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1f2740 });
    LBF.shadow = on => { scene.overrideMaterial = on ? shadowMat : null; };
    const tabs = $('#model-tabs'), note = $('#model-note');
    Object.keys(LBF.MODELS).forEach(key => tabs.append(el('button', { role: 'tab', 'data-k': key, 'aria-selected': 'false', text: LBF.MODELS[key].name, onclick: () => showModel(key) })));
    showModel = function (key) {
      const m = LBF.MODELS[key]; if (!m) return; current = key;
      $$('button', tabs).forEach(b => b.setAttribute('aria-selected', b.dataset.k === key));
      const links = el('span', {}, document.createTextNode('Files: '));
      m.cases.forEach((id, i) => { if (i) links.append(', '); links.append(el('a', { href: '#' + byId[id].world, text: byId[id].name, onclick: e => { e.preventDefault(); openCase(id); $('#' + byId[id].world).scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); } })); });
      note.replaceChildren(el('strong', { text: m.name }), el('span', { text: m.note }), links, el('span', { text: 'Model: NASA 3D Resources.' }));
      loadingEl.textContent = 'Fetching the evidence…'; loadingEl.style.display = 'grid';
      load(key).then(obj => {
        if (current !== key) return;
        holder.clear(); holder.add(obj); loadingEl.style.display = 'none'; rot.x = 0.28; idle = 9;
      }).catch(() => { if (current === key) { holder.clear(); loadingEl.textContent = 'This model would not load. Try another one.'; } });
    };
    stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; stage.classList.add('grabbing'); try { stage.setPointerCapture(e.pointerId); } catch (_) {} });
    stage.addEventListener('pointermove', e => { if (!drag) return; rot.y += (e.clientX - drag.x) * 0.008; rot.x = Math.max(-1.4, Math.min(1.4, rot.x + (e.clientY - drag.y) * 0.008)); drag.x = e.clientX; drag.y = e.clientY; idle = 0; });
    const up = () => { drag = null; stage.classList.remove('grabbing'); };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    let started = false;
    views.push({ el: stage, scene, cam, update(dt, a) {
      if (!started) { started = true; showModel('percy'); }
      idle += dt; cam.position.z = 4.1 / Math.min(1, a);
      if (!drag && idle > 3 && !RM) rot.y += dt * 0.25;
      holder.rotation.set(rot.x, rot.y, 0);
    } });
  })();


  /* Quest 1: walk on a small Moon as an astronaut and find three kinds of machine */
  (function () {
    const stage = $('#walk-stage'), box = $('#walk'), R = 10;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
    (function () {      /* a ball made from a cube, so the crater texture stays sharp and even everywhere, poles included */
      const geo = new THREE.BoxGeometry(2, 2, 2, 48, 48, 48), pa = geo.attributes.position, na = geo.attributes.normal, v = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).normalize(); na.setXYZ(i, v.x, v.y, v.z); pa.setXYZ(i, v.x * R, v.y * R, v.z * R); }
      const map = tex('moonsurf.jpg'), bump = texLoader.load('assets/moonbump.jpg');
      [map, bump].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.anisotropy = 8; });
      scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.05, roughness: 1, metalness: 0, color: 0xdcdce4 })));
    })();
    scene.add(new THREE.HemisphereLight(0xcfc8ff, 0x30343c, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15); sun.position.set(30, 22, 18); scene.add(sun);
    /* the sky: a big blue Earth, twinkling stars, shooting stars and an orbiter passing overhead */
    const earth = new THREE.Mesh(new THREE.SphereGeometry(13, 64, 48), globeMat(tex('earth.jpg'))); scene.add(earth);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(14.2, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.3, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(0.955); earth.add(halo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 48, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { up: { value: new THREE.Vector3(0, 1, 0) } },
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 up; varying vec3 d; void main(){ float h = dot(normalize(d), up);' +
        ' vec3 top = vec3(0.03, 0.025, 0.14), mid = vec3(0.11, 0.08, 0.34), low = vec3(0.27, 0.21, 0.6), glow = vec3(0.46, 0.38, 0.8);' +
        ' vec3 c = mix(mid, top, smoothstep(0.25, 0.95, h)); c = mix(low, c, smoothstep(-0.02, 0.34, h)); c = mix(glow, c, smoothstep(-0.12, 0.07, h));' +
        ' c = mix(vec3(0.06, 0.05, 0.2), c, smoothstep(-0.6, -0.12, h)); gl_FragColor = vec4(c, 1.0); }'
    })); dome.renderOrder = -2; dome.frustumCulled = false; scene.add(dome);
    const starTex = (spikes) => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.9)'); gr.addColorStop(0.45, 'rgba(200,210,255,.25)'); gr.addColorStop(1, 'rgba(200,210,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      if (spikes) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 2); g.lineTo(32, 62); g.moveTo(2, 32); g.lineTo(62, 32); g.stroke(); }
      return new THREE.CanvasTexture(c);
    };
    const dotTex = starTex(false), sparkTex = starTex(true);
    const starLayers = [[700, 3, 0xffffff, dotTex], [420, 5, 0xcfe0ff, dotTex], [160, 9, 0xffffff, dotTex], [70, 15, 0xfff0d0, sparkTex], [36, 24, 0xdfe8ff, sparkTex]].map(([N, size, color, map], n) => {
      const a = new Float32Array(N * 3); let sd = 11 + n * 97; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < N; i++) { const u = rnd() * 2 - 1, t = rnd() * 6.2832, q = Math.sqrt(1 - u * u); a[i * 3] = q * Math.cos(t) * 300; a[i * 3 + 1] = u * 300; a[i * 3 + 2] = q * Math.sin(t) * 300; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; scene.add(pts); return pts;
    });
    /* the Big Dipper: seven bright stars, placed in the sky beside Earth */
    const dipper = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 30, map: sparkTex, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); dipper.frustumCulled = false; scene.add(dipper);
    const DIP = [[0, 0], [1.5, 0.75], [2.6, 0.95], [3.8, 1.05], [4.25, 0.0], [5.9, 0.2], [5.8, 1.55]];
    function placeDipper(fwd, upv) {       /* called when the walk starts, once the player's starting view is known */
      const side = new THREE.Vector3().crossVectors(upv, fwd).normalize(), c = fwd.clone().multiplyScalar(0.72).addScaledVector(upv, 0.62).addScaledVector(side, -0.42).normalize(), a = new Float32Array(21);
      const u2 = upv.clone().addScaledVector(c, -upv.dot(c)).normalize(), s2 = new THREE.Vector3().crossVectors(u2, c).normalize();
      DIP.forEach(([x, y], i) => { const p = c.clone().addScaledVector(s2, (x - 3) * 0.085).addScaledVector(u2, (y - 0.6) * 0.085).normalize().multiplyScalar(290); a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; });
      dipper.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3));
    }
    const meteors = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.5, 26, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.userData = { t: 9, wait: 1 + Math.random() * 4, from: new THREE.Vector3(), vel: new THREE.Vector3() }; scene.add(m); return m;
    });
    const orbiter = new THREE.Group();
    (function () {
      const pc = document.createElement('canvas'); pc.width = 256; pc.height = 128; const g = pc.getContext('2d');
      g.fillStyle = '#c9d2e6'; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { const gr = g.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32); gr.addColorStop(0, '#2f56c8'); gr.addColorStop(1, '#16276e'); g.fillStyle = gr; g.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); }
      const pt = new THREE.CanvasTexture(pc); pt.encoding = THREE.sRGBEncoding;
      const panelM = new THREE.MeshStandardMaterial({ map: pt, emissiveMap: pt, emissive: 0x6677aa, metalness: 0.4, roughness: 0.35 });
      const foil = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.9, roughness: 0.3, emissive: 0x5a4010, flatShading: true });
      const shell = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, metalness: 0.2, roughness: 0.5, emissive: 0x333338 }), metal = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, metalness: 0.8, roughness: 0.35, emissive: 0x1c1e24 });
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); orbiter.add(m); return m; };
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 14), shell).rotation.x = Math.PI / 2;                 /* body */
      add(new THREE.CylinderGeometry(0.23, 0.23, 0.22, 9), foil, 0, 0, -0.3).rotation.x = Math.PI / 2;    /* gold foil section */
      add(new THREE.BoxGeometry(0.26, 0.26, 0.2), foil, 0, 0, 0.32);
      [-1, 1].forEach(sg => {
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6), metal, sg * 0.36, 0, 0).rotation.z = Math.PI / 2;            /* boom */
        [0, 1].forEach(k => { const w = add(new THREE.BoxGeometry(0.62, 0.015, 0.4), panelM, sg * (0.84 + k * 0.66), 0, 0); w.rotation.x = 0.35; });
      });
      const dish = add(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, 1.0), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.4, emissive: 0x44444a, side: THREE.DoubleSide }), 0, 0.3, 0.05); dish.rotation.x = Math.PI;
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 5), metal, 0, 0.2, 0.05);
      const lamp = add(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4d }), 0, -0.24, 0); orbiter.userData.lamp = lamp;
      orbiter.scale.setScalar(1.5);
    })();
    scene.add(orbiter);
    function skyStep(dt) {
      earth.rotation.y += dt * 0.05;
      dome.position.copy(cam.position); dome.material.uniforms.up.value.copy(pos);
      starLayers.forEach((p, n) => { p.material.opacity = 0.6 + 0.4 * Math.sin(clock * (0.8 + n * 0.55) + n * 2); p.rotation.y += dt * 0.003 * (n % 3 + 1); });
      dipper.material.opacity = 0.85 + 0.15 * Math.sin(clock * 2.2);
      meteors.forEach(m => {
        const u = m.userData; u.t += dt;
        if (u.t > u.wait + 1.1) {                                  /* launch a new streak somewhere in the sky above the player */
          u.t = 0; u.wait = 2 + Math.random() * 5;
          u.from.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().addScaledVector(pos, 0.9).normalize().multiplyScalar(220);
          u.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); u.vel.addScaledVector(u.from, -u.vel.dot(u.from) / u.from.lengthSq()).normalize().multiplyScalar(190);
          m.quaternion.setFromUnitVectors(tmp.set(0, 1, 0), tmp2.copy(u.vel).normalize().negate());
        }
        if (u.t < 1.1) { m.position.copy(u.from).addScaledVector(u.vel, u.t); m.material.opacity = Math.sin(u.t / 1.1 * Math.PI) * 0.9; } else m.material.opacity = 0;
      });
      const a = clock * 0.22; orbiter.position.set(Math.cos(a) * (R + 3.6), Math.sin(a * 0.7) * 3, Math.sin(a) * (R + 3.6)); orbiter.up.set(0, 1, 0); orbiter.lookAt(0, 0, 0); orbiter.rotateZ(0.5); orbiter.rotateY(clock * 0.15);
      orbiter.userData.lamp.visible = (clock % 1.2) < 0.25;
    }
    const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, o || {}));
    const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };

    /* ---------- hardware models (built y-up, then stood on the surface) ---------- */
    const white = M(0xe9e9e6), grey = M(0x8d9096), dark = M(0x2a2c31), gold = M(0xc9973a, { metalness: 0.7, roughness: 0.35 });
    const trayTex = (function () {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#cfd2d6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#8b8f96'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
        const x = 22 + i * 23.5, y = 22 + j * 23.5;
        g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(x, y, 8.5, 0, 7); g.fill();
        g.fillStyle = '#9aa4b5'; g.beginPath(); g.arc(x - 2, y - 2, 3, 0, 7); g.fill();
      }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
    })();
    function reflector() {           /* the Apollo laser mirror: a tilted tray of 100 prisms on a pallet */
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.62, 0.04, 0.52), white, 0, 0.02, 0));
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.1), grey, 0, 0.07, -0.14), mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), grey, 0, 0.14, -0.12));
      const tray = new THREE.Group(); tray.position.set(0, 0.2, 0); tray.rotation.x = 0.55;
      tray.add(mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), M(0xd8dade, { metalness: 0.5, roughness: 0.4 })));
      const face = mesh(new THREE.PlaneGeometry(0.44, 0.44), new THREE.MeshStandardMaterial({ map: trayTex, metalness: 0.4, roughness: 0.35 }), 0, 0.031, 0); face.rotation.x = -Math.PI / 2; tray.add(face);
      const laser = mesh(new THREE.CylinderGeometry(0.012, 0.012, 14, 6), new THREE.MeshBasicMaterial({ color: 0x63f08a, transparent: true, opacity: 0.85 }), 0, 7, 0); tray.add(laser);
      const hit = mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb6ffcc }), 0, 0.05, 0); tray.add(hit);
      g.add(tray); g.userData.laser = laser; return g;
    }
    function lander(apollo) {        /* a legged lander: gold four-legged Apollo stage, or a three-legged Surveyor */
      const g = new THREE.Group(), n = apollo ? 4 : 3, body = apollo ? gold : white;
      g.add(mesh(new THREE.CylinderGeometry(apollo ? 0.34 : 0.2, apollo ? 0.34 : 0.22, apollo ? 0.26 : 0.16, apollo ? 8 : 6), body, 0, apollo ? 0.42 : 0.4, 0));
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + 0.4, leg = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), grey, Math.cos(a) * 0.36, 0.22, Math.sin(a) * 0.36);
        leg.rotation.z = Math.cos(a) * 0.55; leg.rotation.x = -Math.sin(a) * 0.55; g.add(leg);
        g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 10), grey, Math.cos(a) * 0.5, 0.012, Math.sin(a) * 0.5));
      }
      if (apollo) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 10), dark, 0, 0.24, 0));
      else { g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), grey, 0, 0.78, 0)); const pnl = mesh(new THREE.BoxGeometry(0.36, 0.24, 0.015), M(0x23345c, { metalness: 0.5, roughness: 0.3 }), 0.06, 1.05, 0); pnl.rotation.set(0.5, 0.4, 0); g.add(pnl); }
      return g;
    }
    function buggy() {               /* the Apollo Moon car: four wire wheels, two seats and a gold umbrella antenna */
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.04, 0.72), grey, 0, 0.17, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
        const w = mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), dark, x * 0.24, 0.13, z * 0.28); w.rotation.y = Math.PI / 2; g.add(w);
        const f = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.3), M(0xd0703a), x * 0.24, 0.29, z * 0.28); g.add(f);
      });
      [-0.09, 0.09].forEach(x => { g.add(mesh(new THREE.BoxGeometry(0.13, 0.03, 0.14), white, x, 0.22, -0.05)); g.add(mesh(new THREE.BoxGeometry(0.13, 0.2, 0.025), white, x, 0.32, -0.13)); });
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), dark, 0, 0.27, 0.16));
      g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), grey, 0.1, 0.44, 0.3));
      const dish = mesh(new THREE.ConeGeometry(0.2, 0.07, 16, 1, true), M(0xc9973a, { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }), 0.1, 0.7, 0.3); dish.rotation.x = Math.PI; dish.rotation.z = 0.3; g.add(dish);
      g.add(mesh(new THREE.BoxGeometry(0.07, 0.05, 0.1), gold, -0.1, 0.36, 0.32));
      g.scale.setScalar(1.5); return g;
    }
    function crater() {              /* an impact site: a dark bowl with a raised rim and scattered pieces */
      const g = new THREE.Group();
      const rim = mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 28), M(0x9a9a9a, { roughness: 1 }), 0, 0.02, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
      const bowl = mesh(new THREE.CircleGeometry(0.5, 28), M(0x1c1c1e, { roughness: 1 }), 0, 0.012, 0); bowl.rotation.x = -Math.PI / 2; g.add(bowl);
      for (let i = 0; i < 7; i++) { const a = i * 0.9, r = 0.25 + (i % 3) * 0.22, bit = mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), i % 2 ? grey : gold, Math.cos(a) * r, 0.03, Math.sin(a) * r); bit.rotation.set(i, i * 2, i * 3); g.add(bit); }
      return g;
    }
    const TARGETS = { apollo15: 'The laser mirror', apollo17: 'The Moon car', surveyor3: 'The robot lander', lcross: 'The crash crater' };
    const sites = C.filter(c => TARGETS[c.id]).map(c => {
      const spot = ({ surveyor5: [6, 29], surveyor3: [-9, -29] })[c.id] || c.plot || [c.lat, c.lon];   /* neighbours nudged apart so the models do not overlap */
      const dir = ll(spot[0], spot[1], 1).normalize();
      const g = new THREE.Group(); g.position.copy(dir).multiplyScalar(R); g.lookAt(dir.clone().multiplyScalar(R * 2));
      const up = new THREE.Group(); up.rotation.x = Math.PI / 2; g.add(up);          /* inside `up`, +Y points away from the Moon */
      const col = STATUS_COL[c.status];
      let model;
      if (c.id === 'apollo15') { model = reflector(); model.scale.setScalar(1.3); }
      else if (c.id === 'apollo17') { model = buggy(); const l = lander(true); l.position.set(1.1, 0, -0.6); l.scale.setScalar(1.25); up.add(l); }
      else if (c.id === 'lcross') { model = crater(); model.scale.setScalar(1.5); }
      else { model = lander(false); model.scale.setScalar(1.5); }
      up.add(model);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.84, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75 })); ring.position.z = 0.02; g.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 })); beam.rotation.x = Math.PI / 2; beam.position.set(-0.6, 0.6, 2.5); g.add(beam);
      scene.add(g);
      return { c, dir, beam, ring, g, up, model, found: false, t: 0 };
    });

    /* ---------- the astronaut: a jointed rig ---------- */
    const suit = M(0xd9dadc), glove = M(0x6f747c), boot = M(0x7b7f86), red = M(0xc8372d);
    const rig = new THREE.Group(); scene.add(rig);
    const hips = new THREE.Group(); rig.add(hips);
    const chest = new THREE.Group(); chest.position.y = 0.04; hips.add(chest);
    chest.add(mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.36, 14), suit, 0, 0.2, 0));
    chest.add(mesh(new THREE.SphereGeometry(0.19, 14, 10), suit, 0, 0.36, 0));
    chest.add(mesh(new THREE.BoxGeometry(0.2, 0.14, 0.08), M(0xd5d6d8), 0, 0.24, 0.17));           /* chest control unit */
    chest.add(mesh(new THREE.BoxGeometry(0.34, 0.46, 0.17), M(0xc4c6c9), 0, 0.3, -0.22));            /* life-support backpack */
    chest.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.15), M(0xb4b6ba), 0, 0.57, -0.22));
    const antenna = new THREE.Group(); antenna.position.set(0.12, 0.62, -0.22); antenna.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5), grey, 0, 0.15, 0)); chest.add(antenna);
    const head = new THREE.Group(); head.position.y = 0.6; chest.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.185, 20, 16), suit, 0, 0, 0));
    const visor = mesh(new THREE.SphereGeometry(0.15, 20, 16), new THREE.MeshStandardMaterial({ color: 0xd9a23c, metalness: 1, roughness: 0.18, emissive: 0x3a2606 }), 0, 0, 0.065); visor.scale.set(1, 0.92, 0.82); head.add(visor);
    function limb(x, y, upper, lower, r, end) {
      const top = new THREE.Group(); top.position.set(x, y, 0);
      top.add(mesh(new THREE.SphereGeometry(r * 1.15, 10, 8), suit, 0, 0, 0), mesh(new THREE.CylinderGeometry(r, r * 0.92, upper, 10), suit, 0, -upper / 2, 0));
      const mid = new THREE.Group(); mid.position.y = -upper; top.add(mid);
      mid.add(mesh(new THREE.SphereGeometry(r, 10, 8), suit, 0, 0, 0), mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.85, lower, 10), suit, 0, -lower / 2, 0), end);
      return { top, mid };
    }
    const hand = () => mesh(new THREE.SphereGeometry(0.062, 10, 8), glove, 0, -0.2, 0);
    const foot = () => mesh(new THREE.BoxGeometry(0.13, 0.08, 0.24), boot, 0, -0.27, 0.04);
    const armL = limb(0.25, 0.42, 0.2, 0.18, 0.06, hand()), armR = limb(-0.25, 0.42, 0.2, 0.18, 0.06, hand());
    armL.top.add(mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.03, 10), red, 0, -0.1, 0)); armR.top.add(mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.03, 10), red, 0, -0.1, 0));
    chest.add(armL.top, armR.top);
    const legL = limb(0.1, 0, 0.24, 0.24, 0.078, foot()), legR = limb(-0.1, 0, 0.24, 0.24, 0.078, foot());
    hips.add(legL.top, legR.top);
    const LEG = 0.59;                                   /* hip height when standing */
    const shadow = mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }), 0, 0.015, 0); shadow.rotation.x = -Math.PI / 2; rig.add(shadow);
    const puffs = []; for (let i = 0; i < 6; i++) { const pf = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xb9b6ae, transparent: true, opacity: 0 })); pf.userData.t = 9; scene.add(pf); puffs.push(pf); }
    let puffI = 0;
    /* springs give follow-through: parts overshoot and settle instead of stopping dead */
    const spring = (k, c) => ({ x: 0, v: 0, k, c, step(target, dt) { this.v += (-this.k * (this.x - target) - this.c * this.v) * dt; this.x += this.v * dt; return this.x; } });
    const sLean = spring(60, 9), sRoll = spring(70, 10), sAnt = spring(120, 5), sArms = spring(50, 7), sHead = spring(40, 8);

    /* The animation drives a small set of joints. Two bodies can wear it: the simple block figure above
       (a stand-in while loading) and NASA's own astronaut model, which gets a skeleton fitted to it here. */
    const SIGN = [1, -1];
    let body = {
      hips(y, sx, sy) { hips.position.y = LEG * y; hips.scale.set(sx, sy, sx); }, lift(h) { hips.position.y += h; },
      chest(x, y, z) { chest.rotation.set(x, y, z); }, head(x, y) { head.rotation.set(x, y, 0); },
      arm(i, rx, rz, erx) { const a = i ? armR : armL; a.top.rotation.set(rx, 0, SIGN[i] * rz); a.mid.rotation.x = erx; },
      leg(i, rx, krx) { const l = i ? legR : legL; l.top.rotation.x = rx; l.mid.rotation.x = krx; }
    };
    if (THREE.GLTFLoader) new THREE.GLTFLoader().load('assets/astro.glb', g => {
      try {
        g.scene.updateMatrixWorld(true);
        const parts = []; g.scene.traverse(o => { if (o.isMesh) parts.push(o); });
        const boxAll = new THREE.Box3().setFromObject(g.scene), H = boxAll.max.y - boxAll.min.y, cx = (boxAll.min.x + boxAll.max.x) / 2, cz = (boxAll.min.z + boxAll.max.z) / 2;
        /* joints, in units of body height, y up, facing +z (the model stands in a T pose) */
        const B = name => { const b = new THREE.Bone(); b.name = name; return b; };
        const J = { hips: [0, 0.44, 0], chest: [0, 0.55, 0], head: [0, 0.80, 0], armL: [0.15, 0.735, 0], foreL: [0.30, 0.735, 0], armR: [-0.15, 0.735, 0], foreR: [-0.30, 0.735, 0], legL: [0.09, 0.43, 0], shinL: [0.09, 0.265, 0], legR: [-0.09, 0.43, 0], shinR: [-0.09, 0.265, 0] };
        const PARENT = { chest: 'hips', head: 'chest', armL: 'chest', foreL: 'swingL', armR: 'chest', foreR: 'swingR', legL: 'hips', shinL: 'legL', legR: 'hips', shinR: 'legR' };
        const bones = {}; Object.keys(J).forEach(k => bones[k] = B(k));
        bones.swingL = B('swingL'); bones.swingR = B('swingR'); J.swingL = J.armL; J.swingR = J.armR; PARENT.swingL = 'armL'; PARENT.swingR = 'armR';
        Object.keys(bones).forEach(k => { const p = PARENT[k], a = J[k], b = p ? J[p] : [0, 0, 0]; bones[k].position.set(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (p) bones[p].add(bones[k]); });
        const order = ['hips', 'chest', 'head', 'swingL', 'foreL', 'swingR', 'foreR', 'legL', 'shinL', 'legR', 'shinR', 'armL', 'armR'], idx = {}; order.forEach((k, i) => idx[k] = i);

        const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
        const holder = new THREE.Group(); holder.add(bones.hips); holder.updateMatrixWorld(true);
        const skeleton = new THREE.Skeleton(order.map(k => bones[k]));          /* bind pose is captured here, in the T pose */
        holder.scale.setScalar(1.12);
        const v = new THREE.Vector3();
        parts.forEach(o => {
          const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
          const pa = geo.attributes.position, n = pa.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
          const visorPart = n < 400;
          for (let i = 0; i < n; i++) {
            v.fromBufferAttribute(pa, i); const x = (v.x - cx) / H, y = (v.y - boxAll.min.y) / H, z = (v.z - cz) / H; pa.setXYZ(i, x, y, z);
            const w = {}, ax = Math.abs(x), side = x >= 0 ? 'L' : 'R';
            if (visorPart) w.head = 1;
            else if (z < -0.085 && y > 0.36 && ax < 0.2) w.chest = 1;                         /* life-support backpack rides on the chest */
            else if (y > 0.62 && y < 0.83 && ax > 0.135) {                                  /* arms: chest → upper arm → forearm */
              const a = sm(0.135, 0.21, ax), f = sm(0.27, 0.33, ax);
              w.chest = 1 - a; w['swing' + side] = a * (1 - f); w['fore' + side] = a * f;
            } else if (y > 0.775 && ax < 0.135) { const h = sm(0.775, 0.825, y); w.head = h; w.chest = 1 - h; }
            else if (y < 0.47) {                                                             /* legs: hips → thigh → shin */
              const t = 1 - sm(0.39, 0.47, y), k = 1 - sm(0.235, 0.295, y);
              w.hips = 1 - t; w['leg' + side] = t * (1 - k); w['shin' + side] = t * k;
            } else { const c = sm(0.47, 0.6, y); w.chest = c; w.hips = 1 - c; }
            let j = 0; for (const k in w) if (w[k] > 0.001 && j < 4) { si[i * 4 + j] = idx[k]; sw[i * 4 + j] = w[k]; j++; }
          }
          pa.needsUpdate = true; geo.computeVertexNormals();
          geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
          const mat = o.material.clone(); mat.skinning = true;
          if (visorPart) { mat.color.set(0xd9a23c); mat.metalness = 1; mat.roughness = 0.18; mat.emissive = new THREE.Color(0x3a2606); }
          const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; holder.add(m); m.bind(skeleton, new THREE.Matrix4());
        });
        /* after binding in the T pose, the arms are lowered to hang at the sides */
        bones.armL.rotation.z = -1.2; bones.armR.rotation.z = 1.2;
        rig.add(holder); hips.visible = false;
        body = {
          hips(y, sx, sy) { bones.hips.position.y = 0.44 * y; bones.hips.scale.set(sx, sy, sx); }, lift(h) { bones.hips.position.y += h / 1.12; },
          chest(x, y, z) { bones.chest.rotation.set(x, y, z); }, head(x, y) { bones.head.rotation.set(x, y, 0); },
          arm(i, rx, rz, erx) { const s = SIGN[i]; bones[i ? 'swingR' : 'swingL'].rotation.set(0, s * rx, s * (rz - 0.16)); bones[i ? 'foreR' : 'foreL'].rotation.set(0, s * erx, 0); },
          leg(i, rx, krx) { bones[i ? 'legR' : 'legL'].rotation.x = rx; bones[i ? 'shinR' : 'shinL'].rotation.x = krx; }
        };
      } catch (err) { console.warn('astronaut model not rigged:', err); }
    }, undefined, () => {});

    /* rocks to walk between, and bootprints that stay behind you (on the Moon there is no wind to erase them) */
    (function () {
      const geo = new THREE.IcosahedronGeometry(1, 0), mat = M(0x8e8e90, { roughness: 1, flatShading: true });
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 220; i++) {
        const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(), k = 0.03 + rnd() * rnd() * 0.16;
        const r = mesh(geo, mat); r.position.copy(d).multiplyScalar(R + k * 0.3); r.scale.set(k * (0.7 + rnd()), k * (0.5 + rnd() * 0.5), k * (0.7 + rnd())); r.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); scene.add(r);
      }
    })();
    const prints = [], printGeo = new THREE.CircleGeometry(1, 12), printMat = new THREE.MeshBasicMaterial({ color: 0x2b2b2d, transparent: true, opacity: 0.5 });
    let printI = 0;
    function bootprint(sideSign) {
      let pr = prints[printI % 90]; if (!pr) { pr = new THREE.Mesh(printGeo, printMat); pr.scale.set(0.055, 0.1, 1); scene.add(pr); prints[printI % 90] = pr; }
      printI++;
      tmp.copy(pos).multiplyScalar(R + 0.012).addScaledVector(right, sideSign * 0.11); pr.position.copy(tmp);
      basis.makeBasis(right, headDir, pos); pr.quaternion.setFromRotationMatrix(basis);
    }

    /* sound: music from the team's folder plus small synth effects */
    let actx = null, soundOn = true;
    function tone(f0, f1, dur, vol, type, delay) {
      if (!soundOn) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (_) {}
    }
    const sfx = {
      step() { tone(95, 55, 0.09, 0.12, 'sine'); }, jump() { tone(220, 620, 0.28, 0.12, 'triangle'); }, land() { tone(120, 45, 0.2, 0.25, 'sine'); },
      rock() { tone(880, 880, 0.09, 0.14, 'triangle'); tone(1320, 1320, 0.16, 0.14, 'triangle', 0.08); },
      find() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 0.16, 'triangle', i * 0.11)); },
      yes() { tone(660, 660, 0.12, 0.15, 'triangle'); tone(990, 990, 0.22, 0.15, 'triangle', 0.11); }, no() { tone(210, 150, 0.3, 0.12, 'square'); },
      boom() { tone(140, 30, 0.7, 0.35, 'sawtooth'); }, zap() { tone(1800, 300, 0.5, 0.1, 'sawtooth'); }
    };
    const soundBtn = el('button', { class: 'btn ghost', id: 'walk-sound', text: 'Sound: on', onclick: () => { soundOn = !soundOn; soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); Music.set(soundOn); } });
    box.append(soundBtn);

    /* Moon rocks to pick up on the way, like the Apollo crews did. They lead toward the four machines. */
    const START = ll(8, 12, 1).normalize(), rocks = [], ROCK_COL = [0x4f5054, 0x77736c, 0xb4b1a8, 0x625f5b];   /* basalt, breccia, pale highland rock */
    const rockMap = tex('moonsurf.jpg');
    function rockShape(seed) {          /* a lumpy, angular stone: no two alike */
      const geo = new THREE.IcosahedronGeometry(1, 1), pa = geo.attributes.position, v = new THREE.Vector3(), memo = {};
      let sd = seed * 7919 + 13; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i); const key = v.x.toFixed(2) + v.y.toFixed(2) + v.z.toFixed(2);
        const k = memo[key] || (memo[key] = 0.72 + rnd() * 0.5); pa.setXYZ(i, v.x * k, v.y * k * 0.72, v.z * k);
      }
      geo.computeVertexNormals(); return geo;
    }
    sites.forEach((s, n) => [0.3, 0.52, 0.74].forEach((t, m) => {
      const d = START.clone().lerp(s.dir, t).normalize(), side = new THREE.Vector3().crossVectors(START, s.dir).normalize();
      d.addScaledVector(side, ((m + n) % 2 ? 1 : -1) * 0.035).normalize();
      const g = new THREE.Group(); g.position.copy(d).multiplyScalar(R); g.lookAt(d.clone().multiplyScalar(R * 2));
      const size = 0.15 + ((n * 3 + m) % 4) * 0.025;
      const core = new THREE.Mesh(rockShape(n * 3 + m + 1), new THREE.MeshStandardMaterial({ color: ROCK_COL[(n + m) % 4], map: rockMap, roughness: 1, metalness: 0, flatShading: true }));
      core.scale.setScalar(size); core.position.z = size * 0.5; core.rotation.set(Math.PI / 2, (n * 3 + m) * 1.3, 0);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.325, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); glow.position.z = 0.02;
      g.add(core, glow); scene.add(g); rocks.push({ g, d, core, glow, got: false, t: 0, ph: n * 1.7 + m, size });
    }));
    const rockCount = el('span', { class: 'rocks', text: '' }); $('#walk .hud').append(rockCount);
    let rocksGot = 0;
    function rockStep(dt, can) {
      rocks.forEach(r => {
        if (r.got) { if (r.t < 0.5) { r.t += dt; const k = r.t / 0.5; r.core.position.z = r.size * 0.5 + Math.sin(k * Math.PI * 0.5) * 0.9; r.core.scale.setScalar(r.size * (1 - k * k)); r.core.rotation.y += dt * 9; r.glow.material.opacity = 0.5 * (1 - k); r.glow.scale.setScalar(1 + k); if (k >= 1) r.g.visible = false; } return; }
        r.glow.scale.setScalar(1 + Math.sin(clock * 3 + r.ph) * 0.08);
        if (can && pos.dot(r.d) > 0.9985) { r.got = true; r.t = 0; rocksGot++; rockCount.textContent = 'Moon rocks: ' + rocksGot + ' / ' + rocks.length; sfx.rock(); if (rocksGot === rocks.length) { cheer = 0; sfx.find(); } }
      });
    }

    /* each machine does something when you find it, and a flag pops up to mark it */
    const flagMat = { mirror: 0xa57bff, silent: 0xe9e9e6, impact: 0xf5c26b };
    function react(s) {
      const f = new THREE.Group(); f.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), grey, 0, 0.45, 0), mesh(new THREE.BoxGeometry(0.34, 0.2, 0.01), new THREE.MeshBasicMaterial({ color: flagMat[s.c.status] }), 0.18, 0.78, 0));
      f.position.set(-0.75, 0, 0.5); f.scale.setScalar(0.001); s.up.add(f); s.flag = f; s.t = 0;
      if (s.c.id === 'apollo15') {                    /* a laser pulse flashes from the mirror back to Earth */
        const a = s.dir.clone().multiplyScalar(R + 0.3), b = earth.position.clone(), len = a.distanceTo(b);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 6), new THREE.MeshBasicMaterial({ color: 0x63f08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); scene.add(m); s.fx = m; sfx.zap();
      } else if (s.c.id === 'lcross') {               /* the rocket comes down again */
        const r = new THREE.Group(); r.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 10), white, 0, 0, 0), mesh(new THREE.ConeGeometry(0.09, 0.2, 10), gold, 0, -0.4, 0)); r.children[1].rotation.x = Math.PI;
        const fl = mesh(new THREE.ConeGeometry(0.07, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.8 }), 0, 0.55, 0); r.add(fl);
        s.up.add(r); s.fx = r; s.dust = [];
        for (let i = 0; i < 10; i++) { const d = mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd8d2c4, transparent: true, opacity: 0 }), 0, 0.05, 0); d.userData.a = i / 10 * 6.283; s.up.add(d); s.dust.push(d); }
      }
    }
    function reactStep(dt) {
      sites.forEach(s => {
        if (!s.found || !s.flag) return; const t = s.t += dt;
        const k = Math.min(1, t / 0.45); s.flag.scale.setScalar(k < 1 ? k * (1 + Math.sin(k * Math.PI) * 0.5) : 1); s.flag.rotation.y = Math.sin(clock * 2) * 0.25;   /* pop with overshoot, then wave */
        const id = s.c.id;
        if (id === 'apollo15' && s.fx) { s.fx.material.opacity = t < 3 ? (0.35 + 0.35 * Math.sin(t * 22)) * (1 - t / 3) : 0; }
        else if (id === 'apollo17') { if (t < 5) { const a = t / 5 * 6.283, e = 0.5 - 0.5 * Math.cos(Math.min(1, t / 0.6) * Math.PI); s.model.position.set(-Math.sin(a) * 1.1 * e, 0, (1 - Math.cos(a)) * 1.1 * e - 0.0); s.model.rotation.y = -a - Math.PI / 2 * e; } else { s.model.position.set(0, 0, 0); s.model.rotation.y = 0; } }
        else if (id === 'surveyor3') { if (t < 3.2) { s.model.rotation.y = Math.sin(t * 5) * 0.5 * (1 - t / 3.2); s.model.position.y = Math.abs(Math.sin(t * 6)) * 0.22 * (1 - t / 3.2); } else { s.model.rotation.y = 0; s.model.position.y = 0; } }
        else if (id === 'lcross' && s.fx) {
          if (t < 0.9) { s.fx.visible = true; s.fx.position.set(0, 9 * (1 - (t / 0.9) * (t / 0.9)), 0); }
          else { if (s.fx.visible) { s.fx.visible = false; sfx.boom(); } const u = (t - 0.9) / 1.6; s.dust.forEach(d => { if (u < 1) { d.position.set(Math.cos(d.userData.a) * u * 1.6, 0.1 + Math.sin(u * Math.PI) * 1.1, Math.sin(d.userData.a) * u * 1.6); d.scale.setScalar(1 + u * 3); d.material.opacity = 0.7 * (1 - u); } else d.material.opacity = 0; }); s.model.scale.setScalar(1.5 * (1 + Math.max(0, 0.25 * Math.sin(Math.min(1, u * 2) * Math.PI)))); }
        }
      });
    }

    const svg = d => '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const ICONS = {
      apollo15: svg('<path d="M3 16l11-5 5 5-11 5z"/><path d="M6.5 16.2l8-3.6M9 18.6l8-3.6M8 13.7l5 5M11.5 12.1l5 5"/><path d="M14 11l7-9" stroke-dasharray="2 2"/>'),
      apollo17: svg('<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 14h12M9 14v-4h4l2 4M17 14V5"/><path d="M13 5h8l-4 3z"/>'),
      surveyor3: svg('<path d="M8 11h8l1.5 4h-11z"/><path d="M7 15l-4 6M17 15l4 6M12 15v6M2 21h3M19 21h3M10.500 21h3"/><path d="M12 11V4"/><path d="M7 2l9 2-1 3-9-2z"/>'),
      lcross: svg('<ellipse cx="12" cy="17" rx="9" ry="4"/><ellipse cx="12" cy="17.500" rx="5" ry="1.800"/><path d="M12 12V3M12 3l-2 3M12 3l2 3M5 11L3 8M19 11l2-3M8 10L7 6M16 10l1-4"/>')
    };
    const NEED = sites.map(s => [s.c.id, TARGETS[s.c.id], s.c.status]);
    const keys = { up: 0, down: 0, left: 0, right: 0, jump: 0 };
    const pos = new THREE.Vector3(), headDir = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), right = new THREE.Vector3(), basis = new THREE.Matrix4();
    let active = false, zoom = 0, clock = 0, got = {}, paused = false, rows = {};
    let speed = 0, turnV = 0, phase = 0, antic = 0, moving = false, cheer = -1, lastStep = 0, idle = 0;
    let jumpT = -1, jumpY = 0, jumpV = 0, landT = 9, camYaw = 0, camPitch = 0.3, look = null, lookIdle = 9, learned = [];
    function reset() {
      pos.copy(START); headDir.set(0, 0, -1); headDir.addScaledVector(pos, -headDir.dot(pos)).normalize();
      earth.position.copy(pos).multiplyScalar(R + 2).addScaledVector(headDir, 100); placeDipper(headDir, pos);      /* Earth hangs low over the horizon ahead */
      zoom = 0; got = {}; learned = []; paused = false; speed = 0; phase = 0; cheer = -1; jumpT = -1; jumpY = 0; camYaw = 0; camPitch = 0.3; sites.forEach(s => { s.found = false; s.beam.material.opacity = 0.35; if (s.flag) { s.up.remove(s.flag); s.flag = null; } if (s.fx) { (s.fx.parent || scene).remove(s.fx); s.fx = null; } (s.dust || []).forEach(d => s.up.remove(d)); s.dust = null; s.model.position.set(0, 0, 0); s.model.rotation.y = 0; });
      rocks.forEach(r => { r.got = false; r.g.visible = true; r.core.scale.setScalar(r.size); r.core.position.z = r.size * 0.5; r.glow.material.opacity = 0.5; r.glow.scale.setScalar(1); }); rocksGot = 0; rockCount.textContent = 'Moon rocks: 0 / ' + rocks.length;
      const list = $('#walk-list'); list.replaceChildren(); rows = {};
      NEED.forEach(([k, label, st]) => { const ic = el('span', { class: 'icon' }); ic.innerHTML = ICONS[k]; const li = el('li', { class: 's-' + st }, ic, el('span', { text: label }), el('span', { class: 'arrow', text: '➤' })); rows[k] = li; list.append(li); });
      $('#walk-found').hidden = true;
    }
    function card(title, lines, btn, fn) {
      const f = $('#walk-found'); paused = true;
      f.replaceChildren(el('h3', { text: title }), ...lines.map(t => el('p', { text: t })), el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: btn, onclick: () => { f.hidden = true; paused = false; fn && fn(); } })));
      f.hidden = false;
    }
    function find(s) {
      s.found = true; s.beam.material.opacity = 0.08; Notebook.file(s.c.id); cheer = 0; react(s); sfx.find(); G.react('yes');
      const k = s.c.status, L = LBF.LEARN[s.c.id];
      got[s.c.id] = 1; learned.push(s.c.id); rows[s.c.id].classList.add('done'); rows[s.c.id].querySelector('.arrow').textContent = '✓';
      say(s.c.name + '. ' + QUIPS[k], true, { silent: true }); Voice.speak(QUIPS[k]);
      const all = NEED.every(([n]) => got[n]);
      setTimeout(() => {
        if (!active) return;
        const f = $('#walk-found'); paused = true;
        f.replaceChildren(el('h3', { text: s.c.name }), el('div', { class: 'stamp s-' + k, text: LBF.STATUS[k].label }),
          (() => { const p = el('p', { class: 'fact' }); (L ? L[0] : s.c.story).split('*').forEach((t, n) => p.append(n % 2 ? el('mark', { text: t }) : t)); return p; })(),
          el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: all ? 'Hy\'s questions' : 'Keep walking', onclick: () => { f.hidden = true; paused = false; if (all) debrief(0, 0); } })));
        f.hidden = false;
      }, s.c.id === 'lcross' ? 2600 : 2000);
    }
    /* before leaving, Hy checks what you remember about the three machines you found */
    function debrief(i, misses) {
      const f = $('#walk-found'); paused = true; f.hidden = false;
      if (i >= learned.length) {
        cheer = 0;
        f.replaceChildren(el('h3', { text: 'Quest complete!' }), el('p', { class: 'fact', text: 'You remembered all ' + learned.length + '.' }),
          el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: 'Go to Stop 2', onclick: finish })));
        say(misses ? 'Case closed. You earned your badge, partner.' : 'A perfect score. You could run this agency, kid.', true);
        return;
      }
      const id = learned[i], L = LBF.LEARN[id], opts = L[2].map((t, n) => ({ t, ok: n === 0 })).sort(() => Math.random() - 0.5);
      const note = el('p', { text: (i + 1) + ' of ' + learned.length });
      const list = el('div', { class: 'opts' });
      opts.forEach(o => list.append(el('button', { text: o.t, onclick: e => {
        if (o.ok) { sfx.yes(); G.react('yes'); e.currentTarget.classList.add('yes'); $$('button', list).forEach(b => b.disabled = true); note.textContent = 'Yes!'; setTimeout(() => debrief(i + 1, misses), 1500); }
        else { sfx.no(); G.react('no'); e.currentTarget.classList.add('no'); e.currentTarget.disabled = true; misses++; note.textContent = 'Try again.'; }
      } })));
      f.replaceChildren(el('h3', { text: L[1] }), note, list);
    }
    function finish() {
      Notebook.badge('walker'); stop();
      document.body.classList.remove('locked'); try { sessionStorage.setItem('lbf-q1', '1'); } catch (_) {}
      setTimeout(() => $('#mirrors').scrollIntoView({ behavior: 'auto', block: 'start' }), 80);
    }
    function start() {
      reset(); active = true; box.hidden = false; document.body.classList.add('questing'); Missions.stopAll && Missions.stopAll();
      say('Find all four. Remember them. I will ask.', true);
      soundOn = Music.isOn(); soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); Music.scene('m-aurora');
    }
    function stop() { Music.scene(null); active = false; box.hidden = true; document.body.classList.remove('questing'); for (const k in keys) keys[k] = 0; }
    LBF.walk = { start, stop, quiz(ids) { learned = ids; debrief(0, 0); }, warp(v) { pos.copy(typeof v === 'number' ? rocks[v].d : sites.find(x => x.c.id === v).dir); headDir.addScaledVector(pos, -headDir.dot(pos)).normalize(); } };
    const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump' };
    addEventListener('keydown', e => { if (!active || !KEYMAP[e.code] || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; keys[KEYMAP[e.code]] = 1; e.preventDefault(); });
    addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = 0; });
    $$('#walk .pad button').forEach(b => {
      const k = b.dataset.k, on = v => e => { e.preventDefault(); keys[k] = v; b.classList.toggle('on', !!v); };
      b.addEventListener('pointerdown', on(1)); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, on(0)));
    });
    $('#walk-exit').addEventListener('click', stop);
    const ease = t => t * t * (3 - 2 * t), clamp01 = t => Math.max(0, Math.min(1, t));

    function animate(dt, want, turn) {
      /* 2 anticipation: a quick crouch before setting off; 6 slow in and slow out: speed eases toward the target */
      if (want > 0 && !moving) { moving = true; antic = 0.2; }
      if (want <= 0 && Math.abs(speed) < 0.05) moving = false;
      antic = Math.max(0, antic - dt);
      const target = antic > 0 ? 0 : want;
      speed += (target - speed) * Math.min(1, dt * (Math.abs(target) > Math.abs(speed) ? 3.0 : 4.2));
      const v = Math.min(1, Math.abs(speed)), dir = speed < 0 ? -1 : 1, grounded = jumpT < 0;
      /* 9 timing: a slow, floaty low-gravity lope */
      if (grounded) phase += dt * (2.9 + 2.3 * v) * (v > 0.03 ? 1 : 0);
      const s = Math.sin(phase), c = Math.cos(phase), air = Math.pow(Math.abs(s), 0.8);
      /* 7 arcs: the body bounds along in arcs */
      let hop = grounded ? air * 0.17 * v : 0;
      /* 1 squash and stretch: compress on landing and in the crouch, lengthen in flight */
      let squash = grounded ? (1 - air) * 0.1 * v - air * 0.05 * v : 0;
      squash += antic > 0 ? Math.sin((1 - antic / 0.2) * Math.PI) * 0.16 : 0;
      let armsUp = 0, armsOut = 0, tuck = 0;
      /* the jump: crouch (anticipation), spring off, float under Moon gravity, land with a squash and a dust burst */
      if (jumpT >= 0) {
        jumpT += dt;
        if (jumpT < 0.18) { squash += Math.sin(jumpT / 0.18 * Math.PI * 0.5) * 0.24; tuck = jumpT / 0.18 * 0.5; armsOut = -jumpT / 0.18 * 0.5; }
        else {
          if (jumpV === 0 && jumpY === 0) jumpV = 2.6;
          jumpV -= 2.9 * dt; jumpY += jumpV * dt;
          squash -= Math.max(0, jumpV) * 0.05; armsOut = 0.9 - Math.abs(jumpV) * 0.12; tuck = Math.max(0, 0.35 - Math.abs(jumpV) * 0.1);
          if (jumpY <= 0) { jumpY = 0; jumpV = 0; jumpT = -1; landT = 0; sfx.land(); for (let i = 0; i < 4; i++) { const pf = puffs[puffI++ % puffs.length]; pf.position.copy(pos).multiplyScalar(R + 0.05).addScaledVector(right, (i % 2 ? 0.2 : -0.2)).addScaledVector(headDir, i < 2 ? 0.15 : -0.15); pf.userData.t = 0; } bootprint(1); bootprint(-1); }
        }
        hop += jumpY;
      }
      landT += dt; if (landT < 0.3) squash += Math.sin(landT / 0.3 * Math.PI) * 0.22;
      /* 10 exaggeration: a big jump for joy on every find */
      if (cheer >= 0) {
        cheer += dt; const t = cheer;
        if (t < 0.25) { squash += Math.sin(t / 0.25 * Math.PI * 0.5) * 0.26; tuck = 0.5; }
        else if (t < 0.95) { const u = (t - 0.25) / 0.7; hop += Math.sin(u * Math.PI) * 0.7; squash -= Math.sin(u * Math.PI) * 0.1; armsUp = Math.sin(u * Math.PI); }
        else if (t < 1.2) squash += Math.sin((t - 0.95) / 0.25 * Math.PI) * 0.2;
        else cheer = -1;
      }
      body.hips(1 - squash * 0.9, 1 + squash * 0.4, 1 - squash * 0.6); body.lift(hop);
      /* 5 follow through and overlapping action: lean, roll, arms and head each trail on their own spring */
      const lean = sLean.step(speed * 0.26 - (antic > 0 ? 0.2 : 0) + (jumpT >= 0.18 ? 0.12 : 0), dt), roll = sRoll.step(-turn * 0.2 * (0.4 + v), dt);
      const twist = grounded ? -s * 0.2 * v * dir : 0;
      body.chest(lean + air * 0.04 * v, twist, roll);
      const armLag = sArms.step(v, dt), sw = Math.sin(phase - 0.55) * 0.7 * armLag * (grounded ? 1 : 0.2);
      /* 8 secondary action: arms swing against the legs, elbows flex, the head looks into turns and stays level */
      const up = -armsUp * 2.75, out = 0.16 + armLag * 0.1 + armsUp * 0.4 + Math.max(0, armsOut) * 0.9;
      body.arm(0, -sw * dir + up + Math.min(0, armsOut), out, -0.3 - Math.max(0, -sw) * 0.7 - armLag * 0.25 - armsUp * 0.3);
      body.arm(1, sw * dir + up + Math.min(0, armsOut), out, -0.3 - Math.max(0, sw) * 0.7 - armLag * 0.25 - armsUp * 0.3);
      body.head(-lean * 0.6 + (v < 0.05 && grounded ? Math.sin(idle * 0.7) * 0.05 : 0), sHead.step(turn * 0.5 - twist * 0.8 + (v < 0.05 && grounded ? Math.sin(idle * 0.45) * 0.4 : 0), dt));
      /* 4 pose to pose: each leg blends through contact, push-off, passing and reach */
      const stride = 0.62 * v * dir, kn = grounded ? 0.95 * v : 0, crouch = squash * 1.5 + tuck;
      body.leg(0, -s * stride - crouch, Math.max(0, Math.sin(phase + 0.8)) * kn + crouch * 2);
      body.leg(1, s * stride - crouch, Math.max(0, Math.sin(phase + 0.8 + Math.PI)) * kn + crouch * 2);
      if (v < 0.05 && cheer < 0 && grounded) idle += dt; else idle = 0;
      shadow.scale.setScalar(1 - Math.min(0.55, hop * 0.5)); shadow.material.opacity = 0.4 - Math.min(0.28, hop * 0.3);
      /* dust and a bootprint at each footfall */
      const step = Math.floor(phase / Math.PI);
      if (step !== lastStep && v > 0.25 && grounded) { lastStep = step; const sd = step % 2 ? 1 : -1; sfx.step(); bootprint(sd); const pf = puffs[puffI++ % puffs.length]; pf.position.copy(pos).multiplyScalar(R + 0.05).addScaledVector(right, sd * 0.1); pf.userData.t = 0; }
      puffs.forEach(pf => { const t = pf.userData.t += dt; if (t < 0.8) { pf.material.opacity = 0.45 * (1 - t / 0.8); pf.scale.setScalar(1 + t * 5); } else pf.material.opacity = 0; });
    }

    /* look around: hold the right mouse button (or drag with a finger) to orbit the camera a full 360° */
    stage.addEventListener('contextmenu', e => e.preventDefault());
    stage.addEventListener('pointerdown', e => { look = { x: e.clientX, y: e.clientY }; lookIdle = 0; stage.style.cursor = 'grabbing'; try { stage.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    stage.addEventListener('pointermove', e => { if (!look) return; camYaw -= (e.clientX - look.x) * 0.007; camPitch = Math.max(-0.05, Math.min(1.25, camPitch + (e.clientY - look.y) * 0.005)); look.x = e.clientX; look.y = e.clientY; lookIdle = 0; });
    const lookEnd = () => { look = null; stage.style.cursor = ''; };
    stage.addEventListener('pointerup', lookEnd); stage.addEventListener('pointercancel', lookEnd);

    views.push({ el: stage, scene, cam, quest: true, update(dt) {
      if (!active) return;
      clock += dt; zoom = Math.min(1, zoom + dt / 2.6);
      const can = !paused && zoom >= 1 && cheer < 0;
      /* walk where the screen is facing: forward goes away from the camera, left and right go across the screen,
         and the astronaut turns to face the way it is going */
      const ix = can ? keys.right - keys.left : 0, iz = can ? keys.up - keys.down : 0;
      let want = 0, turn = 0;
      if (ix || iz) {
        tmp.copy(headDir).applyAxisAngle(pos, camYaw); tmp2.crossVectors(pos, tmp);          /* the camera's forward and left, on the ground */
        tmp.multiplyScalar(iz).addScaledVector(tmp2, -ix).normalize();
        tmp2.crossVectors(headDir, tmp);
        const ang = Math.atan2(pos.dot(tmp2), headDir.dot(tmp)), stepA = Math.max(-7 * dt, Math.min(7 * dt, ang));
        headDir.applyAxisAngle(pos, stepA); camYaw -= stepA;                                 /* the camera stays where the player left it */
        turn = Math.max(-1, Math.min(1, ang * 1.4)); want = Math.max(0.12, Math.cos(ang));
      }
      if (can && keys.jump && jumpT < 0 && landT > 0.25) { jumpT = 0; jumpY = 0; jumpV = 0; sfx.jump(); }
      turnV += (turn - turnV) * Math.min(1, dt * 6);
      animate(dt, want, turnV);
      if (Math.abs(speed) > 0.01) pos.addScaledVector(headDir, speed * 2.7 * dt / R).normalize();
      headDir.addScaledVector(pos, -headDir.dot(pos)).normalize();
      right.crossVectors(pos, headDir).normalize();
      if (can && jumpT < 0) for (const s of sites) if (!s.found && pos.dot(s.dir) > 0.9955) { find(s); break; }
      /* 11 solid drawing: the figure stands on the ground with its own up, right and forward */
      basis.makeBasis(right, pos, headDir); rig.quaternion.setFromRotationMatrix(basis); rig.position.copy(pos).multiplyScalar(R);
      { const cf = tmp2.copy(headDir).applyAxisAngle(pos, camYaw), cl = new THREE.Vector3().crossVectors(pos, cf);     /* pointers follow the screen: up means straight ahead */
        sites.forEach(s => { if (s.found) return; tmp.copy(s.dir).addScaledVector(pos, -s.dir.dot(pos)); rows[s.c.id].querySelector('.arrow').style.transform = 'rotate(' + (Math.atan2(-tmp.dot(cl), tmp.dot(cf)) - Math.PI / 2) + 'rad)'; }); }
      skyStep(dt); rockStep(dt, can); reactStep(dt);
      sites.forEach(s => { s.ring.scale.setScalar(1 + Math.sin(clock * 3 + s.dir.x * 9) * 0.06); });
      /* 3 staging: fly in from above, then hold the astronaut in clear silhouette against the black sky.
         The camera orbits wherever the player drags it and drifts back behind them once they walk on. */
      lookIdle += dt;
      if (!look && lookIdle > 1.5 && Math.abs(speed) > 0.2 && keys.up && !keys.down) { camYaw += (Math.atan2(Math.sin(-camYaw), Math.cos(-camYaw))) * Math.min(1, dt * 0.9); camPitch += (0.3 - camPitch) * Math.min(1, dt * 1.2); }
      const e = ease(zoom), dist = 3.5;
      tmp2.copy(headDir).multiplyScalar(-1).applyAxisAngle(pos, camYaw);                 /* direction from astronaut to camera, on the ground */
      tmp.copy(pos).multiplyScalar(R + 1.0 + Math.sin(camPitch) * dist).addScaledVector(tmp2, Math.cos(camPitch) * dist);
      tmp2.copy(pos).multiplyScalar(R + 60);
      cam.position.lerpVectors(tmp2, tmp, e); cam.up.copy(zoom < 1 ? headDir : pos);
      tmp.copy(pos).multiplyScalar(R + 1.45); cam.lookAt(tmp);
    } });
  })();

  /* render loop: one canvas, one viewport per stage */
  let last = performance.now(), W = 0, H = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    laserStep(now);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== W || h !== H) { W = w; H = h; renderer.setSize(w, h, false); skyCam.aspect = w / h; skyCam.updateProjectionMatrix(); }
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear();
    const sc = window.scrollY || 0;
    skyCam.rotation.set(-sc * 0.00012, sc * 0.00006 + (RM ? 0 : now * 0.000004), 0);
    renderer.render(sky, skyCam);
    renderer.setScissorTest(true);
    const questing = document.body.classList.contains('questing');
    for (const vw of views) {
      if (questing && !vw.quest) continue;
      const r = vw.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.width < 2 || r.height < 2) continue;
      const a = r.width / r.height;
      vw.cam.aspect = a; vw.update(dt, a, r); vw.cam.updateProjectionMatrix();
      const y = H - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height);
      renderer.clearDepth(); renderer.render(vw.scene, vw.cam);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return true;
}

/* ───────────────────────── Detective notebook ───────────────────────── */
const Notebook = (function () {
  const BADGES = { first: 'Rookie detective', moon: 'Moon expert', mars: 'Mars expert', laser: 'Laser ranger', mystery: 'Mystery cracked', interview: 'Interviewer', tour: 'Rode along', talk: 'Talked to Hy', quiz: 'Quiz badge', walker: 'Moon walker', pin: 'Mars mapper', shadow: 'Shadow spotter', stay: 'Overtime expert' };
  const st = { files: [], badges: [] };
  try {
    const o = JSON.parse(localStorage.getItem('lbf-notebook') || '{}');
    st.files = (o.files || []).filter(id => byId[id]); st.badges = (o.badges || []).filter(b => BADGES[b]);
  } catch (_) {}
  const save = () => { try { localStorage.setItem('lbf-notebook', JSON.stringify(st)); } catch (_) {} };
  let toastT = null;
  function toast(text) {
    let t = $('#toast');
    if (!t) { t = el('div', { id: 'toast', role: 'status', style: 'position:fixed;left:14px;bottom:14px;z-index:50;background:#ff9a3d;color:#17171a;font-family:var(--display);padding:10px 14px 8px;border-radius:3px;box-shadow:0 10px 40px rgba(0,0,0,.7);max-width:calc(100vw - 28px)' }); document.body.append(t); }
    t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function render() {
    $('#nb-count').textContent = st.files.length + ' of ' + C.length + ' files opened. ' + st.badges.length + ' of ' + Object.keys(BADGES).length + ' badges earned.';
    $('#nb-stamps').replaceChildren(...C.map(c => el('i', { class: 's-' + c.status + (st.files.includes(c.id) ? ' got' : ''), title: c.name })));
    $('#nb-badges').replaceChildren(...Object.keys(BADGES).map(k => el('li', { class: st.badges.includes(k) ? 'got' : '', text: BADGES[k] })));
  }
  function badge(k) {
    if (!BADGES[k] || st.badges.includes(k)) return;
    st.badges.push(k); save(); render(); toast('New badge for your notebook: ' + BADGES[k]);
  }
  function file(id) {
    if (st.files.includes(id)) return;
    st.files.push(id); save(); render();
    if (st.files.length >= 3) badge('first');
    ['moon', 'mars'].forEach(w => { if (C.filter(c => c.world === w).every(c => st.files.includes(c.id))) badge(w); });
  }
  render();
  return { badge, file };
})();

/* ───────────────────────── Missions: mystery machine and ride-along tours ───────────────────────── */
const Missions = (function () {
  let mystery = null, tour = null;
  const ban = w => $('#mis-' + w);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reveal = w => $('#' + w).scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  function banner(w, title, text, buttons) {
    const b = ban(w);
    b.replaceChildren(el('strong', { text: title }), el('span', { text }),
      el('div', { class: 'row' }, ...buttons.filter(Boolean).map(([label, fn, ghost]) => el('button', { class: 'btn onpaper' + (ghost ? ' ghost' : ''), text: label, onclick: fn }))));
    b.classList.add('on');
  }
  function clear() { ['moon', 'mars'].forEach(w => { ban(w).classList.remove('on'); ban(w).replaceChildren(); }); }

  /* --- mystery machine --- */
  function mask(c, text) {
    const words = [c.name].concat(c.name.split(/[ :(),]+/).filter(w => w.length > 4 && !/^(Mission|Lunar|Module)$/.test(w)));
    words.forEach(w => { text = text.split(w + "'s").join('its').split(w).join('this machine'); });
    return text.replace(/^this machine/, 'This machine').replace(/\. this machine/g, '. This machine');
  }
  function clues(c) {
    const decade = Math.floor(c.year / 10) * 10;
    return [
      ({ lander: 'It is a lander that reached ' + WORLD_NAME[c.world], rover: 'It is a rover that reached ' + WORLD_NAME[c.world], heli: 'It is a flying machine that reached ' + WORLD_NAME[c.world],
         crew: 'It is a place where astronauts landed on ' + WORLD_NAME[c.world], impactor: 'It is a spacecraft that hit ' + WORLD_NAME[c.world] + ' on purpose' })[c.kind] + ' in the ' + decade + 's. Today: ' + LBF.STATUS[c.status].label.toLowerCase() + '.',
      mask(c, c.clue),
      'Look near ' + c.site + '.'
    ];
  }
  function showClue() {
    const c = byId[mystery.id];
    banner(c.world, 'Mystery machine: clue ' + (mystery.clue + 1) + ' of 3', mystery.clues[mystery.clue] + (mystery.hint ? ' ' + mystery.hint : ''), [
      mystery.clue < 2 ? ['Next clue', () => { mystery.clue++; mystery.hint = ''; showClue(); say(mystery.clues[mystery.clue], true); }] : null,
      ['Ask Hy yes or no', () => startMode({ type: 'mystery', id: c.id }), true],
      ['Give up', () => endMystery(false), true]
    ]);
  }
  function startMystery() {
    stopAll();
    const pool = C.filter(c => c.status !== 'lost'), c = pool[Math.floor(Math.random() * pool.length)];
    mystery = { id: c.id, clue: 0, tries: 0, hint: '', clues: clues(c) };
    reveal(c.world); showClue();
    say("I'm thinking of one machine on " + WORLD_NAME[c.world] + ". " + mystery.clues[0] + " Click its light on the globe when you think you've found it.", true);
  }
  function guess(c) {
    const t = byId[mystery.id];
    if (c.world !== t.world) { say('Wrong world, partner. Our machine is on ' + WORLD_NAME[t.world] + '.', true); reveal(t.world); return; }
    if (c.id === t.id) return endMystery(true);
    mystery.tries++;
    mystery.hint = 'Not ' + c.name + '. Our machine arrived ' + (c.year === t.year ? 'in the same year' : t.year < c.year ? 'earlier than that' : 'later than that') + '.';
    if (mystery.tries >= 6) return endMystery(false);
    if (mystery.tries % 2 === 0 && mystery.clue < 2) mystery.clue++;
    showClue(); say(mystery.hint + ' Try another light.', true);
  }
  function endMystery(won) {
    const c = byId[mystery.id]; mystery = null;
    if (chatMode && chatMode.type === 'mystery') endMode();
    openCase(c.id, { quiet: true });
    banner(c.world, won ? 'Case cracked' : 'Case file revealed', (won ? 'You found it: ' : 'It was ') + c.name + '. Its file is open.', [['Play again', startMystery], ['Close', clear, true]]);
    if (won) Notebook.badge('mystery');
    say(won ? "You cracked it! That's " + c.name + '. Fine detective work, partner.' : 'It was ' + c.name + '. A tough one. Read the file, then try another.', true);
  }

  /* --- ride-along tours --- */
  const TOURS = {
    moon: ['surveyor1', 'surveyor3', 'apollo11', 'apollo15', 'prospector', 'lcross', 'blueghost'],
    mars: ['viking1', 'pathfinder', 'opportunity', 'phoenix', 'curiosity', 'insight', 'perseverance', 'ingenuity']
  };
  async function startTour(w) {
    stopAll();
    const run = tour = { stop: false, skip: null }, stops = TOURS[w];
    reveal(w); Notebook.badge('tour');
    for (let i = 0; i < stops.length && !run.stop; i++) {
      const c = byId[stops[i]];
      openCase(c.id, { quiet: true });
      banner(w, 'Ride along: stop ' + (i + 1) + ' of ' + stops.length, c.name + ', ' + c.year + '. ' + c.site + '.', [['Next stop', () => run.skip && run.skip()], ['End the tour', stopTour, true]]);
      const line = (i === 0 ? 'Buckle up. First stop: ' : 'Next stop: ') + c.name + '. ' + c.story + ' ' + c.clue;
      const told = Voice.isOn() ? Promise.race([say(line, true).then(() => wait(900)), wait(5000 + line.length * 95)]) : (say(line, true), wait(2600 + line.length * 55));
      await Promise.race([told, new Promise(r => { run.skip = r; })]);
      Voice.stop();
    }
    if (run.stop) return;
    tour = null;
    const other = w === 'moon' ? 'mars' : 'moon';
    banner(w, 'End of the line', 'That was the ' + (w === 'moon' ? 'Moon' : 'Mars') + ' tour.', [['Take the ' + (other === 'moon' ? 'Moon' : 'Mars') + ' tour', () => startTour(other)], ['Close', clear, true]]);
    say("That's the tour. Now go poke around yourself. Every light has a story.", true);
  }
  function stopTour() { if (tour) { tour.stop = true; if (tour.skip) tour.skip(); tour = null; Voice.stop(); } clear(); }
  function stopAll() { stopTour(); mystery = null; clear(); }
  return {
    startMystery, startTour, stopAll,
    /* a click on a light or a list entry: a guess during a mystery, and it ends a running tour */
    intercept(c) { if (mystery) { guess(c); return true; } if (tour) stopTour(); return false; }
  };
})();
$('#m-mystery').addEventListener('click', Missions.startMystery);
$$('[data-tour]').forEach(b => b.addEventListener('click', () => Missions.startTour(b.dataset.tour)));

/* ───────────────────────── Talking with Hy ───────────────────────── */
const chat = $('#chat'), log = $('#log'), modeEl = $('#mode');
const STARTERS = ['Take me to a machine that still works', 'Why did Opportunity stop working?', 'How do the mirrors on the Moon work?', 'Show me the helicopter that flew on Mars', 'Did anything find water?', 'Why are you a hydrogen atom?'];
const BRIEF = LBF.buildPrompt();
const ENDPOINT = (LBF.AI_ENDPOINT || '').trim();
let sample = null, history = [], busy = false, greeted = false, chatMode = null;

function setMode() {
  const live = !!sample || !!ENDPOINT;
  modeEl.textContent = live ? 'Live AI' : 'Case-file mode';
  modeEl.classList.toggle('live', live);
  $('#ask-mode').textContent = live ? 'Hy answers with live AI, grounded in the NASA case files on this page.' : 'Hy is answering from the case files on this page.';
}
(async function connectAI() {
  for (let i = 0; i < 20 && !(window.claude && window.claude.use); i++) await new Promise(r => setTimeout(r, 150));
  try { if (window.claude && window.claude.use) sample = await window.claude.use('sample'); } catch (e) { sample = null; }
  setMode();
})();
setMode();

/* Public visitors: a small server run by the team passes the conversation to an AI model. */
async function askServer(turns, mode) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: turns, mode }), signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.text) { const e = new Error(j.error || 'http ' + r.status); e.status = r.status; throw e; }
    return String(j.text);
  } finally { clearTimeout(timer); }
}

function closeChat() { chat.classList.remove('open'); guide.classList.remove('chatting'); }
function greet() {
  if (greeted) return; greeted = true;
  addMsg('hy', "Pull up a chair, kid. Ask me about any machine on the Moon or Mars and I'll take you there. Or say the word and we'll play a game.");
}
function openChat() {
  chat.classList.add('open'); guide.classList.add('chatting');
  if (!chatMode) greet();
  setTimeout(() => { try { $('#chat-q').focus({ preventScroll: true }); } catch (_) {} }, 50);
}
function addMsg(who, text) { const m = el('div', { class: 'msg ' + who, text }); log.append(m); log.scrollTop = log.scrollHeight; return m; }
function setChips(list) {
  const box = $('#chat-qs'); box.replaceChildren();
  list.forEach(q => box.append(el('button', { type: 'button', text: q, onclick: () => ask(q) })));
}

/* Interview and mystery modes change who is talking */
function startMode(m) {
  const c = byId[m.id]; if (!c) return;
  chatMode = m; history = []; log.replaceChildren(); chat.classList.add('mode'); Voice.stop();
  if (m.type === 'interview') {
    $('#chat-title').textContent = 'Interview: ' + c.name;
    const hi = "Hello! I'm " + c.name + '. I reached ' + WORLD_NAME[c.world] + ' in ' + c.year + '. Ask me anything about my mission.';
    addMsg('them', hi); Voice.speak(hi, { pitch: 0.8, rate: 0.98 });
    setChips(['What was your landing like?', 'What is the coolest thing you found?', 'Are you still working?']);
    openCase(c.id, { quiet: true }); Notebook.badge('interview');
  } else {
    $('#chat-title').textContent = 'Mystery: yes or no?';
    addMsg('hy', "Ask me yes-or-no questions about the mystery machine. I won't say its name.");
    setChips(['Is it a rover?', 'Did it arrive before 1980?', 'Is it still working?']);
  }
  openChat();
}
function endMode() {
  chatMode = null; history = []; log.replaceChildren(); chat.classList.remove('mode'); Voice.stop();
  $('#chat-title').textContent = 'Talk to Hy'; greeted = false; greet(); setChips(STARTERS.slice(0, 4));
}
$('#chat-back').addEventListener('click', endMode);
(function () {
  const sel = $('#m-who');
  C.filter(c => c.status !== 'lost').forEach(c => sel.append(el('option', { value: c.id, text: c.name + ' (' + (c.world === 'moon' ? 'Moon' : 'Mars') + ', ' + c.year + ')' })));
  sel.value = 'curiosity';
  $('#m-interview').addEventListener('click', () => startMode({ type: 'interview', id: sel.value }));
})();
LBF.interview = id => startMode({ type: 'interview', id });

/* Hy's replies can carry control lines such as [[go:curiosity]]; pull them out and act on them */
function parseReply(raw) {
  const r = { next: [] };
  r.text = String(raw).replace(/\[\[(go|model|do|next):([^\]]*)\]\]/g, (m, k, v) => {
    v = v.trim();
    if (k === 'next') r.next = v.split('|').map(x => x.trim()).filter(Boolean).slice(0, 3);
    else if (!r[k]) r[k] = v.toLowerCase();
    return '';
  }).replace(/\[\[[^\]]*\]\]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return r;
}
const DO = {
  laser: ['Try the laser experiment', () => $('#mirrors').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' })],
  mystery: ['Play mystery machine', () => Missions.startMystery()],
  'tour-moon': ['Take the Moon tour', () => Missions.startTour('moon')],
  'tour-mars': ['Take the Mars tour', () => Missions.startTour('mars')],
  quiz: ['Take the quiz', () => $('#quiz').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' })]
};
function applyReply(bot, r) {
  const acts = el('div', { class: 'acts' }), small = innerWidth < 900;
  const after = fn => () => { fn(); if (small) closeChat(); };
  if (!chatMode && r.go && byId[r.go]) {
    const c = byId[r.go];
    openCase(c.id, { quiet: true, reveal: !small });          /* the globe turns while Hy talks */
    acts.append(el('button', { text: 'Open file ' + c.file + ': ' + c.name, onclick: after(() => openCase(c.id, { quiet: true, reveal: true })) }));
  }
  if (!chatMode && r.model && LBF.MODELS[r.model]) {
    if (!r.go) showModel(r.model);
    acts.append(el('button', { text: 'Spin the ' + LBF.MODELS[r.model].name + ' in 3D', onclick: after(() => { showModel(r.model); $('#models').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); }) }));
  }
  if (!chatMode && r.do && DO[r.do]) acts.append(el('button', { text: DO[r.do][0], onclick: after(DO[r.do][1]) }));
  if (acts.children.length) bot.append(acts);
  if (r.next.length) setChips(r.next);
}

async function ask(q) {
  q = (q || '').trim(); openChat(); if (!q || busy) return;
  busy = true; Voice.stop(); addMsg('me', q);
  const mode = chatMode, who = mode && mode.type === 'interview' ? byId[mode.id] : null;
  const bot = addMsg(who ? 'them' : 'hy', who ? 'Thinking…' : 'Checking the files…');
  guideState.think = true;
  const turns = history.slice(-8).concat([{ role: 'user', content: q }]);
  const modeLine = mode ? mode.type + ' ' + mode.id : '';
  let answer = null;
  if (sample) {
    try {
      const msgs = turns.map((m, i) => i === 0 ? { role: 'user', content: BRIEF + (modeLine ? '\n\nACTIVE MODE: ' + modeLine : '') + '\n\nToday is ' + new Date().toDateString() + '.\n\nThe kid says: ' + m.content } : m);
      const res = await sample(msgs, { onText: ({ text }) => { const t = text.replace(/\[\[[^\]]*(\]\]|$)/g, '').trim(); if (t) { bot.textContent = t; log.scrollTop = log.scrollHeight; } }, cache: false });
      answer = (res && res.text || '').trim() || null;
    } catch (err) {
      const code = err && err.code;
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared') { sample = null; setMode(); }
      else if (code === 'rate_limited') addMsg('note', 'The live AI line is busy. Try again in a minute.');
    }
  }
  if (!answer && ENDPOINT) {
    try { answer = (await askServer(turns, modeLine || undefined)).trim() || null; }
    catch (err) { addMsg('note', err && err.status === 429 ? 'Hy is getting a lot of questions right now. This answer comes from the case files.' : 'The live AI line is not answering. This answer comes from the case files.'); }
  }
  let r;
  if (answer) r = parseReply(answer);
  else if (who) r = { text: "My radio link is weak right now, so here is what my file says. " + who.story + ' ' + who.science, next: [] };
  else if (mode) r = { text: 'I can only answer yes-or-no questions when my live line is up. Use the clues on the globe, partner.', next: [] };
  else { const off = offlineAnswer(q); r = { text: off.text, go: off.id, next: [] }; }
  bot.textContent = r.text || 'I lost my train of thought. Ask me again?';
  applyReply(bot, r);
  history.push({ role: 'user', content: q }, { role: 'assistant', content: r.text });
  log.scrollTop = log.scrollHeight;
  guideState.think = false; busy = false;
  Notebook.badge('talk');
  Voice.speak(r.text, who ? { pitch: 0.8, rate: 0.98 } : undefined);
}
LBF.ask = ask;

/* Answers built from the case files, used when live AI is not available. */
function offlineAnswer(q) {
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ') + ' ';
  const has = (...w) => w.some(x => s.includes(x));
  const ALIAS = { pathfinder: ['sojourner', 'pathfinder'], mpl: ['polar lander', 'deep space 2'], grail: ['grail', ' ebb', ' flow '], odysseus: ['odysseus', 'im 1', 'intuitive machines'], athena: ['athena', 'im 2'], blueghost: ['blue ghost', 'firefly', 'nglr'], prospector: ['prospector'], perseverance: ['perseverance', 'percy', 'moxie', 'jezero'], curiosity: ['curiosity', 'gale', 'mount sharp'], ingenuity: ['ingenuity', 'helicopter', ' fly ', 'flew', 'flight'], insight: ['insight', 'marsquake', 'quake'], opportunity: ['opportunity', 'oppy'], phoenix: ['phoenix'], lcross: ['lcross'], ladee: ['ladee'], viking1: ['viking 1', 'viking'], viking2: ['viking 2'], apollo11: ['apollo 11', 'first people', 'first moon landing', 'armstrong', 'aldrin'] };
  let best = null, score = 0;
  C.forEach(c => {
    let sc = 0; const nm = c.name.toLowerCase();
    if (s.includes(' ' + nm + ' ')) sc += 6;
    (ALIAS[c.id] || []).forEach(a => { if (s.includes(a)) sc += 4; });
    if (sc > score) { score = sc; best = c; }
  });
  const m = s.match(/(apollo|surveyor|ranger|viking) (\d+)/);
  if (m) { const c = C.find(x => x.name.toLowerCase() === m[1] + ' ' + m[2]); if (c) { best = c; score = 9; } else return { text: "That one isn't in my cabinet, kid. My Moon files cover Ranger 7, Surveyors 1, 3, 5, 6 and 7, and Apollo 11, 12, 14, 15, 16 and 17." }; }
  if (has('who are you', 'your name', 'why are you', 'hydrogen', 'what are you')) return { text: "I'm Hy Drogen: one proton, one electron, and a nose for clues. Hydrogen is the most common atom in the universe, so I get into every case. Detectors on Lunar Prospector and Curiosity even hunt for hydrogen, because where there's hydrogen there may be water." };
  if (best && score >= 4) return { id: best.id, text: 'File ' + best.file + ', ' + best.name + '. ' + best.story + ' ' + best.science + ' ' + best.clue };
  if (has('mirror', 'reflector', 'laser')) return { id: 'apollo15', text: "Apollo 11, 14 and 15 left trays of glass prisms on the Moon. Each prism sends light straight back where it came from. Scientists fire a laser, time the echo (about 2.5 seconds) and get the distance to about a millimeter. That's how we know the Moon drifts away 3.8 cm a year." };
  if (has('still work', 'still active', 'still alive', 'working', 'still driving', 'active', 'still works')) return { id: 'perseverance', text: 'As of November 2026, two machines are still driving on Mars: Curiosity, since 2012, and Perseverance, since 2021. On the Moon, the Apollo laser mirrors and the new Blue Ghost mirror still work, because a mirror needs no power.' };
  if (has('water', ' ice ')) return { id: 'lcross', text: "Plenty of clues, kid. Lunar Prospector found extra hydrogen at the Moon's poles, and LCROSS confirmed water there in 2009. On Mars, Phoenix dug up water ice, and Spirit, Opportunity, Curiosity and Perseverance all found signs of ancient water." };
  if (has('how many', 'list', 'all the')) { const mo = C.filter(c => c.world === 'moon').length, ma = C.length - mo; return { text: 'My cabinet holds ' + mo + ' Moon files and ' + ma + ' Mars files. They cover every NASA lander, rover and helicopter that reached Mars, the Apollo and Surveyor sites, and the most important crash sites. There is even more out there: spent rocket stages, old orbiters and landing gear.' }; }
  if (has('first') && has('mars')) best = byId.viking1, score = 5;
  else if (has('first') && has('rover')) best = byId.pathfinder, score = 5;
  else if (has('first') && has('moon')) best = byId.surveyor1, score = 5;
  if (has('farthest', 'furthest', 'record', 'longest drive')) best = byId.perseverance, score = 5;
  if (has('lost', 'missing', 'never found', 'disappear')) best = byId.mpl, score = 5;
  if (has('car', 'buggy', 'lunar rover', 'moon rover')) best = byId.apollo15, score = 5;
  if (best && score >= 4) return { id: best.id, text: 'File ' + best.file + ', ' + best.name + '. ' + best.story + ' ' + best.science + ' ' + best.clue };
  return { text: "I can't crack that one from the case files alone, partner. Try asking about a machine by name, like Curiosity, Ingenuity or Apollo 15, or ask which machines still work, how the mirrors work, or who found water." };
}

/* talking to Hy with the microphone, where the browser allows it */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#mic'); let rec = null;
  if (!SR) return;
  mic.classList.add('ok');
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    try {
      Voice.stop(); rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = e => { const t = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript; if (t) ask(t); };
      rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { addMsg('note', 'The microphone is blocked here. You can still type.'); mic.classList.remove('ok'); } };
      rec.onend = () => { rec = null; mic.classList.remove('live'); mic.textContent = 'Talk'; };
      rec.start(); mic.classList.add('live'); mic.textContent = 'Listening…';
    } catch (e) { rec = null; }
  });
})();

STARTERS.forEach(q => $('#ask-qs').append(el('button', { type: 'button', text: q, onclick: () => ask(q) })));
setChips(STARTERS.slice(0, 4));
$('#ask-form').addEventListener('submit', e => { e.preventDefault(); const i = $('#ask-q'); ask(i.value || i.placeholder); i.value = ''; });
$('#chat-form').addEventListener('submit', e => { e.preventDefault(); const i = $('#chat-q'); if (i.value.trim()) ask(i.value); i.value = ''; });
$('#chat-x').addEventListener('click', closeChat);
$('#guide-btn').addEventListener('click', () => { chat.classList.contains('open') ? closeChat() : openChat(); });
$('#bubble-ask').addEventListener('click', openChat);
$$('[data-ask]').forEach(b => b.addEventListener('click', () => ask(b.dataset.ask)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });

/* ───────────────────────── Quest gate: the page opens one stop at a time ───────────────────────── */
(function () {
  let done = false; try { done = sessionStorage.getItem('lbf-q1') === '1'; } catch (_) {}
  const can3d = !document.body.classList.contains('no3d') && LBF.walk;
  if (!done) document.body.classList.add('locked');
  const go = () => { if (can3d) LBF.walk.start(); else { document.body.classList.remove('locked'); $('#moon').scrollIntoView(); } };
  $('#quest1').addEventListener('click', go);
  $('#quest1-again').addEventListener('click', go);
})();

/* ───────────────────────── Intro: meet Hy before anything else ───────────────────────── */
(function () {
  const box = $('#intro'), v = $('#intro-v'), line = $('#intro-line'), M = window.LBF_MEDIA || {};
  if (!M.appear) return;                       /* the intro always plays: there is no way to skip it */
  const LINES = ["Hi! I'm Hy.", "I'm a hydrogen atom. And a detective.", "NASA left robots, cars and mirrors on the Moon and Mars.", "Nobody brought them home.", "Want to help me find them?"];
  const CUES = [0, 1.6, 4.7, 9.1, 10.75];          /* when each line starts in audio/intro.mp3 */
  let over = false, audio = null, timers = [];
  box.hidden = false; document.body.classList.add('intro-on'); guide.classList.add('gone');
  v.src = M.speaking; v.loop = true; v.pause();
  line.textContent = 'Someone wants to meet you.';
  const go = $('#intro-go'), meet = $('#intro-voice');
  meet.textContent = 'Meet Hy'; meet.className = 'btn big'; go.hidden = true;
  function finish() { $('#intro-go').hidden = false; v.pause(); }
  function run(withSound) {
    meet.hidden = true;
    v.src = M.appear; v.loop = false; v.play().catch(() => {});
    v.onended = () => { v.onended = null; v.src = M.speaking; v.loop = true; v.play().catch(() => {}); };
    const start = t0 => LINES.forEach((t, i) => timers.push(setTimeout(() => { if (!over) line.textContent = t; }, (CUES[i] + t0) * 1000)));
    if (withSound) {
      audio = new Audio('audio/intro.mp3');
      audio.onended = finish; audio.onerror = () => { timers.push(setTimeout(finish, 12500)); };
      const p = audio.play(); if (p && p.catch) p.catch(() => { timers.push(setTimeout(finish, 12500)); });
      start(0);
    } else { start(0.4); timers.push(setTimeout(finish, 13000)); }
  }
  function done() {
    if (over) return; over = true; timers.forEach(clearTimeout); if (audio) { try { audio.pause(); } catch (_) {} }
    try { sessionStorage.setItem('lbf-intro', '1'); } catch (_) {}
    box.classList.add('bye'); document.body.classList.remove('intro-on');
    setTimeout(() => { box.hidden = true; v.pause(); }, 550);
    G.back(); say(SAY.top, true);
  }
  go.addEventListener('click', done);
  meet.addEventListener('click', () => {
    Voice.set(true); const b = $('#sound'); b.setAttribute('aria-pressed', 'true'); b.textContent = 'Voice on'; $('#bubble-voice').hidden = true;
    run(true);
  });
})();
})();
