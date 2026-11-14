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
  const pick = () => {
    const vs = synth.getVoices().filter(v => /^en/i.test(v.lang));
    voice = vs.find(v => /Google US English|Samantha|Aria|Jenny|Zira|Daniel/i.test(v.name)) || vs[0] || null;
  };
  if (ok) { try { pick(); synth.addEventListener('voiceschanged', pick); } catch (_) {} }
  function stop() { if (ok) { try { synth.cancel(); } catch (_) {} } guideState.voice = 0; }
  /* resolves when the line has been spoken (or at once when the voice is off) */
  function speak(text, opts) {
    return new Promise(res => {
      if (!ok || !on || !text) return res(false);
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(String(text).slice(0, 900));
        if (voice) u.voice = voice;
        u.lang = 'en-US'; u.pitch = (opts && opts.pitch) || 1.35; u.rate = (opts && opts.rate) || 1.04;
        let done = false; const end = () => { if (done) return; done = true; guideState.voice = 0; res(true); };
        u.onstart = () => { guideState.voice = 1; }; u.onend = end; u.onerror = end;
        setTimeout(end, 40000);
        synth.speak(u);
      } catch (e) { guideState.voice = 0; res(false); }
    });
  }
  return { ok, isOn: () => on, set(v) { on = !!v && ok; if (!on) stop(); }, speak, stop };
})();
function setVoice(v) {
  Voice.set(v);
  const b = $('#sound'); b.setAttribute('aria-pressed', Voice.isOn()); b.textContent = Voice.isOn() ? 'Voice on' : 'Voice off';
  $('#bubble-voice').hidden = Voice.isOn() || !Voice.ok;
  if (Voice.isOn()) say("Voice on. Now I can talk you through the files, partner.", true);
}
if (!Voice.ok) { $('#sound').hidden = true; $('#bubble-voice').hidden = true; }
$('#sound').addEventListener('click', () => setVoice(!Voice.isOn()));
$('#bubble-voice').addEventListener('click', () => setVoice(true));

/* ───────────────────────── The guide's notes ───────────────────────── */
const SAY = {
  top: "Name's Hy. Hy Drogen. One proton, one electron, zero days off. Scroll down, kid. We've got cases to crack.",
  story: "Hydrogen is the most common atom in the universe. So wherever these machines went, I was already there.",
  moon: "Drag the Moon around. Each light is a machine somebody left behind. Purple ones are mirrors that still work.",
  mirrors: "Light is the fastest thing there is. It still needs more than a second to reach the Moon. Fire the laser and time it.",
  mars: "Mars. Cold, dusty, and on average about 225 million km from my office. Teal lights are still driving.",
  models: "These models come straight from NASA. Turn them over. A good detective checks underneath.",
  overtime: "Planned for 90 days. Lasted over 14 years. I like a machine that doesn't know when to quit.",
  ask: "This is my favorite room. Pick a mission, or just talk to me. I talk back.",
  quiz: "Time to see what stuck, partner. No peeking at the files.",
  sources: "Never trust a detective who won't show the evidence. Here's mine."
};
const sayEl = $('#say'), guide = $('#guide');
let typing = null;
let restTimer = null;
function wake(ms) { guide.classList.remove('rest'); clearTimeout(restTimer); restTimer = setTimeout(() => guide.classList.add('rest'), ms || 9000); }
function say(text, force, opts) {
  if (!text || (sayEl.dataset.full === text && !force)) return Promise.resolve();
  sayEl.dataset.full = text;
  clearInterval(typing); guideState.typing = 0; wake(9000 + text.length * 60);
  const spoken = Voice.speak(text, opts);
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
  if (ok) ['appear', 'speaking', 'moving', 'sleeping', 'disappear'].forEach(n => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.preload = 'auto'; v.loop = n === 'speaking' || n === 'moving' || n === 'sleeping'; v.src = M[n];
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
    if (!ok || away || cur === 'appear' || cur === 'disappear') return;
    const busy = guideState.think || performance.now() - scrollT < 350;
    const talking = guideState.typing || guideState.voice;
    show(busy ? 'moving' : talking ? 'speaking' : (guide.classList.contains('rest') && !guide.classList.contains('chatting')) ? 'sleeping' : 'idle');
  }
  if (ok) {
    vids.appear.addEventListener('ended', () => { cur = null; decide(); });
    vids.disappear.addEventListener('ended', () => finishHide());
    addEventListener('scroll', () => { scrollT = performance.now(); }, { passive: true });
    setInterval(decide, 200);
    show('appear');
  }
  function finishHide() { guide.classList.add('gone'); $('#guide-show').hidden = false; }
  return {
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
Object.keys(LBF.STATUS).forEach(s => key.append(el('li', {}, el('span', { class: 'dot s-' + s }), el('span', {}, el('strong', { text: LBF.STATUS[s].label }), document.createTextNode(': ' + LBF.STATUS[s].note)))));

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
    el('dl', { class: 'facts' },
      el('dt', { text: 'When' }), el('dd', { text: c.date }),
      el('dt', { text: 'Where' }), el('dd', { text: c.site }),
      el('dt', { text: 'Map' }), el('dd', { text: coordText(c) }),
      el('dt', { text: 'Type' }), el('dd', { text: LBF.KINDS[c.kind] })),
    el('div', { class: 'blk' }, el('h4', { text: 'What happened' }), el('p', { text: c.story })),
    el('div', { class: 'blk' }, el('h4', { text: 'What it taught us' }), el('p', { text: c.science })),
    el('div', { class: 'blk' }, el('h4', { text: 'Still there today' }), el('p', { text: c.left })),
    el('p', { class: 'clue', text: c.clue }),
    el('div', { class: 'row' },
      c.model ? el('button', { class: 'btn onpaper', text: 'See it in 3D', onclick: () => { showModel(c.model); $('#models').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); } }) : '',
      el('button', { class: 'btn onpaper ghost', text: 'Ask Hy about it', onclick: () => ask('Tell me more about ' + c.name + '.') }),
      c.status !== 'lost' ? el('button', { class: 'btn onpaper ghost', text: 'Interview it', onclick: () => LBF.interview(c.id) }) : ''),
    el('p', { class: 'src' }, document.createTextNode('Source: '), el('a', { href: c.src[1], target: '_blank', rel: 'noopener', text: c.src[0] }))
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
  if (!opts.quiet) say('File ' + c.file + ', ' + c.name + '. ' + QUIPS[c.status], true);
}
['moon', 'mars'].forEach(w => { buildPicker(w); renderFile(byId[selected[w]]); });

/* ───────────────────────── Overtime bars ───────────────────────── */
(function () {
  const box = $('#over'), max = Math.max.apply(null, LBF.OVER.map(o => o.x));
  LBF.OVER.forEach(o => {
    const pct = Math.max(4, o.x / max * 78);
    box.append(el('div', { class: 'r' },
      el('div', { class: 'n', text: o.name }),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + pct + '%' }), el('div', { class: 'x', style: 'left:' + pct + '%', text: 'about ' + o.x + ' times' })),
      el('div', { class: 'd', text: 'Planned: ' + o.plan + '. Actually did: ' + o.did + '.' })));
  });
})();

/* ───────────────────────── Quiz ───────────────────────── */
(function () {
  const box = $('#quiz-box'); let done = 0, right = 0;
  const score = el('p', { class: 'score', 'aria-live': 'polite', text: 'Answered 0 of ' + LBF.QUIZ.length });
  LBF.QUIZ.forEach((q, qi) => {
    const why = el('p', { class: 'why' });
    const as = el('div', { class: 'as' });
    q.a.forEach((a, ai) => as.append(el('button', { type: 'button', text: a, onclick: e => {
      $$('button', as).forEach(b => b.disabled = true);
      const ok = ai === q.ok; done++; if (ok) right++;
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      as.children[q.ok].classList.add('right');
      why.textContent = (ok ? 'Correct. ' : 'Not this time. ') + q.why;
      if (done === LBF.QUIZ.length) {
        const rank = right === done ? 'Chief Inspector' : right >= 4 ? 'Detective' : 'Junior Detective';
        score.textContent = right + ' of ' + done + '. Badge earned: ' + rank + '.';
        Notebook.badge('quiz');
        say(right === done ? "A perfect score. You could run this agency, kid." : "Case closed. You earned your badge, partner.", true);
      } else score.textContent = 'Answered ' + done + ' of ' + LBF.QUIZ.length;
    } })));
    box.append(el('fieldset', { class: 'qcard' }, el('legend', { text: (qi + 1) + '. ' + q.q }), as, why));
  });
  box.append(score);
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
MIRRORS.forEach(([id, label], i) => $('#mirror-opts').append(el('label', {}, el('input', Object.assign({ type: 'radio', name: 'mirror', value: id, id: 'mir-' + id }, i === 2 ? { checked: '' } : {})), el('span', { text: label }))));
$('#fire').addEventListener('click', () => {
  if (laser.firing) return;
  const d = NEAR + (FAR - NEAR) * ($('#orbit').value / 100);
  laser.total = 2 * d / LIGHT; laser.d = d; laser.t0 = performance.now(); laser.firing = true;
  $('#dist').textContent = 'Pulse on its way…'; $('#fire').disabled = true;
});
function laserStep(now) {
  if (!laser.firing) return;
  const t = (now - laser.t0) / 1000;
  if (t >= laser.total) {
    laser.firing = false; laser.frac = 0; $('#fire').disabled = false;
    $('#echo').textContent = laser.total.toFixed(3) + ' s';
    const km = Math.round(laser.d).toLocaleString('en-US');
    const who = MIRRORS.find(m => m[0] === ($('input[name=mirror]:checked') || {}).value) || MIRRORS[2];
    $('#dist').textContent = '299,792 km/s × ' + laser.total.toFixed(3) + ' s ÷ 2 = ' + km + ' km to the ' + who[1] + ' mirror.';
    say("Echo received. That's how scientists know the Moon is slipping away from us, 3.8 cm a year.", true);
    Notebook.badge('laser');
  } else {
    $('#echo').textContent = t.toFixed(3) + ' s';
    const f = t / laser.total; laser.frac = f < .5 ? f * 2 : 2 - f * 2;
  }
}

/* ───────────────────────── 3D ───────────────────────── */
let three = false, showModel = function () {};
try { three = init3D(); } catch (err) { console.warn('3D unavailable:', err); }
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
        if (h) { tip.textContent = byId[h.id].name; tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px'; tip.style.display = 'block'; stage.style.cursor = 'pointer'; }
        else { tip.style.display = 'none'; stage.style.cursor = ''; }
      }
    });
    const end = e => {
      stage.classList.remove('grabbing');
      if (drag && drag.moved < 6) { const h = pick(e); if (h) openCase(h.id, { user: true }); }
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
    for (const vw of views) {
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
  const BADGES = { first: 'Rookie detective', moon: 'Moon expert', mars: 'Mars expert', laser: 'Laser ranger', mystery: 'Mystery cracked', interview: 'Interviewer', tour: 'Rode along', talk: 'Talked to Hy', quiz: 'Quiz badge' };
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
    startMystery, startTour,
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
})();
