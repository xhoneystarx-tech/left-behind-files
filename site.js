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
  let ctx = null, on = true; const loops = {};
  function tone(f0, f1, dur, vol, type, delay) {
    if (!on) return;
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
    zap() { tone(1800, 300, 0.4, 0.08, 'sawtooth'); }, tick() { tone(520, 520, 0.05, 0.08); },
    lock() { tone(1200, 1200, 0.04, 0.12, 'square'); tone(1800, 1800, 0.07, 0.1, 'square', 0.05); }, ping() { tone(1320, 1320, 0.5, 0.14, 'sine'); },
    whoosh() { tone(140, 900, 0.55, 0.07, 'sawtooth'); },
    thunk() { tone(150, 60, 0.12, 0.2, 'square'); tone(900, 300, 0.05, 0.05, 'triangle'); }, click() { tone(2400, 1800, 0.03, 0.1, 'square'); tone(1500, 1200, 0.05, 0.08, 'square', 0.07); },
    beep() { tone(1040, 1040, 0.07, 0.07, 'sine'); tone(1560, 1560, 0.07, 0.07, 'sine', 0.09); }, rumble() { tone(70, 38, 1.4, 0.16, 'sawtooth'); tone(110, 50, 1.2, 0.08, 'square', 0.05); },
    /* a steady tone that can change pitch and loudness: a drill, a rotor. Give 0 as the pitch to stop it. */
    loop(id, f, vol, type) {
      const L = loops[id];
      if (!on || !f) { if (L) { try { L.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); L.o.stop(ctx.currentTime + 0.4); } catch (_) {} delete loops[id]; } return; }
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (!L) {
          const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type || 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 700; g.gain.value = 0.0001;
          o.connect(lp); lp.connect(g); g.connect(ctx.destination); o.start(); loops[id] = { o, g };
        }
        loops[id].o.frequency.setTargetAtTime(f, ctx.currentTime, 0.06); loops[id].g.gain.setTargetAtTime(vol, ctx.currentTime, 0.06);
      } catch (_) {}
    },
    set(v) { on = !!v; if (!on) for (const k in loops) this.loop(k, 0); }
  };
})();
/* background music: a quiet playlist for the whole site, with its own track for the Moon walk */
const Music = (function () {
  const LIST = ['m-hour-page', 'music', 'm-feelalive', 'm-memories', 'm-latenight', 'm-falling', 'm-aurora'], a = new Audio(); a.preload = 'none';
  let on = true, started = false, i = 0, special = null;
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
/* a skip button that asks "Are you sure?" first: the second click within 6 seconds does the skipping */
const skipBtn = (label, fn, cls) => {
  let t = null; const b = el('button', { class: cls || 'skip', type: 'button', text: label });
  b.addEventListener('click', () => {
    if (t) { clearTimeout(t); t = null; b.textContent = label; b.classList.remove('sure'); fn(); return; }
    b.textContent = 'Are you sure?'; b.classList.add('sure'); t = setTimeout(() => { t = null; b.textContent = label; b.classList.remove('sure'); }, 6000);
  });
  return b;
};
const dotsRow = n => { const d = el('div', { class: 'dots' }); for (let i = 0; i < n; i++) d.append(el('span')); return d; };
const answer = good => { if (good) Sfx.yes(); else Sfx.no(); G.react(good ? 'yes' : 'no'); };
/* puzzles that live on the page tell Hy which part the child is on: each entry returns [help key, progress] while a round is on */
const PARTS = [];
const inView = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 90 && r.top < innerHeight - 90; };
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
  const CLIPS = {"Hi, I'm Hy. Press Start and follow me.": "audio/hy-01.mp3", "Keep scrolling. I'll explain as we go.": "audio/hy-02.mp3", "Spin the Moon. Tap any light.": "audio/hy-03.mp3", "Press the big button. Count with me.": "audio/hy-04.mp3", "Mars! Teal lights are still driving.": "audio/hy-05.mp3", "Drag it. Look underneath.": "audio/hy-06.mp3", "Planned for 90 days. Lasted 14 years.": "audio/hy-07.mp3", "My favorite stop. Pick a game, or talk to me.": "audio/hy-08.mp3", "Last stop. Six questions, one badge.": "audio/hy-09.mp3", "This part is for grown-ups.": "audio/hy-10.mp3", "Still on the job. My kind of machine.": "audio/hy-11.mp3", "No batteries, no moving parts, still working. Smartest thing anyone ever left on the Moon.": "audio/hy-12.mp3", "Gone quiet. But the clues it sent home are still paying off.": "audio/hy-13.mp3", "This one went out with a bang, on purpose. Sometimes a crash is the experiment.": "audio/hy-14.mp3", "A cold case. Even the ones that got away taught the engineers something.": "audio/hy-15.mp3", "Voice on. Now I can talk you through the files, partner.": "audio/hy-16.mp3", "Echo received. That's how scientists know the Moon is slipping away from us, 3.8 cm a year.": "audio/hy-17.mp3", "Wrong world, partner. Our machine is on the Moon.": "audio/hy-18.mp3", "Wrong world, partner. Our machine is on Mars.": "audio/hy-19.mp3", "Ask me yes-or-no questions about the mystery machine. I won't say its name.": "audio/hy-20.mp3", "That's the tour. Now go poke around yourself. Every light has a story.": "audio/hy-21.mp3", "Pull up a chair, kid. Ask me about any machine on the Moon or Mars and I'll take you there. Or say the word and we'll play a game.": "audio/hy-22.mp3", "I lost my train of thought. Ask me again?": "audio/hy-23.mp3", "I can only answer yes-or-no questions when my live line is up. Use the clues on the globe, partner.": "audio/hy-24.mp3", "A perfect score. You could run this agency, kid.": "audio/hy-25.mp3", "Case closed. You earned your badge, partner.": "audio/hy-26.mp3", "Find all four. Remember them. I will ask.": "audio/hy-27.mp3", "Whose shadow is this?": "audio/hy-28.mp3", "Last stop. Real or fake? You decide.": "audio/hy-29.mp3", "I name a robot. You click its light.": "audio/hy-30.mp3", "You know Mars like a local.": "audio/hy-31.mp3", "Good eye, detective.": "audio/hy-32.mp3", "They just would not quit.": "audio/hy-33.mp3", "Aim at the mirror on the Moon. Then fire.": "audio/hy-34.mp3", "Just dust. It scatters the light. Find the mirror.": "audio/hy-35.mp3", "One point three seconds. Light is fast!": "audio/hy-36.mp3", "The beam spread out. It is two kilometers wide now.": "audio/hy-37.mp3", "Turn the mirror. Send the light home.": "audio/hy-38.mp3", "Uh-oh. The Moon wobbles, and the light slips away.": "audio/hy-39.mp3", "Add a second mirror. Find the angle that sticks.": "audio/hy-40.mp3", "A square corner! But it still slips sideways.": "audio/hy-41.mp3", "One more mirror. Fold it up.": "audio/hy-42.mp3", "Three mirrors in a corner. The light always comes home!": "audio/hy-43.mp3", "The astronauts left three hundred of these.": "audio/hy-44.mp3", "Here comes the echo.": "audio/hy-45.mp3", "Slide the Moon until the echo matches.": "audio/hy-46.mp3", "That is how we measure the Moon.": "audio/hy-47.mp3", "You are Perseverance. Drive to the glowing rock.": "audio/hy-48.mp3", "Hold to drill. Stay in the green.": "audio/hy-49.mp3", "Easy! Push too hard and the core crumbles.": "audio/hy-50.mp3", "A rock core, as big as a piece of chalk.": "audio/hy-51.mp3", "Sealed tight. It waits here for pickup.": "audio/hy-52.mp3", "Now the trip home. Nobody has flown it yet.": "audio/hy-53.mp3", "Missed. Aim for where the orbiter will be.": "audio/hy-54.mp3", "That is the plan. The real tubes are still on Mars.": "audio/hy-55.mp3", "Now you are Curiosity. Steer around the sharp rocks.": "audio/hy-56.mp3", "Ouch. Sharp rocks poke holes in the wheels.": "audio/hy-57.mp3", "This drill spins and hammers. Tap on the beat.": "audio/hy-58.mp3", "Grey powder! Mars is only red on top.": "audio/hy-59.mp3", "No tubes here. Curiosity has a lab inside.": "audio/hy-60.mp3", "The rock stays. The answers fly home.": "audio/hy-61.mp3", "Radio moves at light speed. It still takes minutes.": "audio/hy-62.mp3", "Earth heard you. An old lake was here.": "audio/hy-63.mp3", "You are Ingenuity. Mars air is thin. Spin fast!": "audio/hy-64.mp3", "Lift-off! Take three pictures.": "audio/hy-65.mp3", "Great shots. Now land by the rover.": "audio/hy-66.mp3", "Your radio is tiny. Who can hear you?": "audio/hy-67.mp3", "Your pictures reached Earth.": "audio/hy-68.mp3", "You did it, detective!": "audio/hy-69.mp3", "All six quests. This medal is yours.": "audio/hy-70.mp3", "Good luck out there. Keep looking up!": "audio/hy-71.mp3", "They are still up there. Keep looking up.": "audio/hy-72.mp3", "Mars! Be three robots.": "audio/hy-73.mp3", "Look at the arrows on your list. Each one points to a machine. Walk that way until you stand in a tall beam of light.": "audio/hy-74.mp3", "Think back to what you found. Tap the answer you remember. A wrong tap is fine: just try another.": "audio/hy-75.mp3", "Tap the Moon. That points the telescope at it.": "audio/hy-76.mp3", "Find the small glowing ring on the Moon. Tap it to fire the laser.": "audio/hy-77.mp3", "Drag the mirror. Tilt it until the beam of light points at Earth, then hold it still.": "audio/hy-78.mp3", "Drag the new mirror. Open or close it until the two mirrors make a square corner.": "audio/hy-79.mp3", "Drag the last mirror up, like closing the corner of a box.": "audio/hy-80.mp3", "Drag anywhere to spin the corner. Then press Next.": "audio/hy-81.mp3", "Drag the Moon closer or farther away. Stop when the clock says 2.56 seconds.": "audio/hy-82.mp3", "Think back to the laser and the mirrors. Tap the answer you remember. A wrong tap is fine.": "audio/hy-83.mp3", "Drive to the tall blue light. Press the up arrow to go. Press left and right to steer.": "audio/hy-84.mp3", "Press and hold the big button to push the drill. If the needle leaves the green, let go for a moment, then hold again.": "audio/hy-85.mp3", "Press the button that says Plan the trip home.": "audio/hy-86.mp3", "Watch the small ring move around Mars. Press Launch when it reaches the big ring that says Meet here.": "audio/hy-87.mp3", "Drive to the tall blue light. Steer around the dark, pointed rocks. They hurt the wheels.": "audio/hy-88.mp3", "Tap the button each time the needle is in the green. Tap, tap, tap, like a drum.": "audio/hy-89.mp3", "Wait for the orbiter to fly into the blue cone. Then press Send.": "audio/hy-90.mp3", "Press and hold the big button. Keep holding until the blades reach the green.": "audio/hy-91.mp3", "Fly to a label on the ground: your shadow, the parachute or the rover. When the camera box turns blue, press Snap.": "audio/hy-92.mp3", "Follow the arrow back to the blue ring next to the rover. Fly into the ring to land.": "audio/hy-93.mp3", "Your radio is small. Tap who is closest first: the rover. Then the orbiter. Then Earth.": "audio/hy-94.mp3", "Think back to the three robots. Tap the answer you remember. A wrong tap is fine.": "audio/hy-95.mp3", "Drag the dark shape to spin it. Look for wheels, legs or blades. Then tap its name.": "audio/hy-96.mp3", "Read the clue above the Moon. Spin the Moon and tap a light. Want more help? Press Next clue.": "audio/hy-97.mp3", "Read the card. Does it sound true? Tap Real or Fake. A wrong guess is fine.": "audio/hy-98.mp3", "Watch this part, or press the button on the card. I will tell you when it is your turn.": "audio/hy-99.mp3", "Start with Quest 1. Walk on the Moon and find four machines.": "audio/hy-100.mp3", "Next is Quest 2. Fire a laser at the Moon, and build the mirror that sends it back.": "audio/hy-101.mp3", "Next is Quest 3. Drive two Mars rovers and fly a helicopter.": "audio/hy-102.mp3", "Next is Quest 4. Name five machines by their shadows.": "audio/hy-103.mp3", "Next is Quest 5. Pick a game to play with me: a mystery, an interview or a tour.": "audio/hy-104.mp3", "One quest left. Real or fake? Tap your answer on each card.": "audio/hy-105.mp3", "You finished all six quests, detective. Want to see the ending again?": "audio/hy-106.mp3", "Pull up a chair, kid. Tap a question and I'll answer. Some answers take you places.": "audio/hy-107.mp3", "Tap a yes-or-no question about the mystery machine. I won't say its name.": "audio/hy-108.mp3", "I lost my train of thought. Tap a question again?": "audio/hy-109.mp3", "Tap one of the questions below, partner.": "audio/hy-110.mp3", "I'm thinking of one machine on the Moon. Read the clue, then click its light on the globe.": "audio/hy-111.mp3", "Here is another clue.": "audio/hy-112.mp3", "Not that one. Ours arrived in the same year. Try another light.": "audio/hy-113.mp3", "Not that one. Ours arrived earlier. Try another light.": "audio/hy-114.mp3", "Not that one. Ours arrived later. Try another light.": "audio/hy-115.mp3", "You cracked it! Fine detective work, partner.": "audio/hy-116.mp3", "A tough one. Read the file, then try another.": "audio/hy-117.mp3", "Buckle up. First stop: Surveyor 1. Nobody knew if the Moon's surface could hold a spacecraft or if it would sink into dust. Surveyor 1 came down gently on three legs and stayed put. It launched on May 30 and landed on June 2. A three-day trip.": "audio/hy-118.mp3", "Next stop: Surveyor 3. Surveyor 3 carried a robot scoop that dug trenches so scientists could test the soil. Two and a half years later, it had visitors. So far it is the only robot on another world that people have walked up to and touched.": "audio/hy-119.mp3", "Next stop: Apollo 11. The first two people to walk on the Moon set up their experiments, then flew home in the top half of their lander. The bottom half is still there. Each prism is 3.8 cm across, about the width of a ping-pong ball.": "audio/hy-120.mp3", "Next stop: Apollo 15. Apollo 15 brought the first car to the Moon, the battery-powered Lunar Roving Vehicle. The crew drove it 27.8 km, then parked it for good. A camera on the parked rover filmed the crew blasting off for home.": "audio/hy-121.mp3", "Next stop: Lunar Prospector. For about 19 months Lunar Prospector circled the Moon with a detector that can sniff out hydrogen. That's me, kid. At the end it was steered into a dark crater to kick up water vapor. Telescopes saw none that day, so the case stayed open.": "audio/hy-122.mp3", "Next stop: LCROSS. An empty rocket stage slammed into a permanently dark crater. Four minutes later LCROSS flew through the cloud of debris, measured it, and then hit the Moon too. LCROSS hit at about 9,000 km per hour.": "audio/hy-123.mp3", "Next stop: Blue Ghost Mission 1. Firefly Aerospace's lander delivered 10 NASA instruments and worked for two weeks, until lunar night fell on March 16, 2025. It also watched an eclipse from the Moon: Earth sliding in front of the Sun.": "audio/hy-124.mp3", "As of November 2026, two machines are still driving on Mars: Curiosity, since 2012, and Perseverance, since 2021. On the Moon, the Apollo laser mirrors and the new Blue Ghost mirror still work, because a mirror needs no power.": "audio/hy-125.mp3", "File M-06, Opportunity. Spirit's twin was also built for 90 days. It drove 45.16 km over more than 14 years. A dust storm that covered the whole planet blocked its solar panels, and it last called home on June 10, 2018. Opportunity found evidence that Mars may once have been able to support tiny living things, and a gully that looks like it was carved by flowing water. It rolled to a stop inside a small crater on landing. Mission scientists called it a hole in one.": "audio/hy-126.mp3", "Apollo 11, 14 and 15 left trays of glass prisms on the Moon. Each prism sends light straight back where it came from. Scientists fire a laser, time the echo (about 2.5 seconds) and get the distance to about a millimeter. That's how we know the Moon drifts away 3.8 cm a year.": "audio/hy-127.mp3", "File M-11, Ingenuity. Ingenuity rode to Mars under Perseverance's belly. The plan was no more than five test flights in 30 days. It flew 72 times. It proved that powered flight works in air about 1% as thick as Earth's. It spent 128.8 minutes in the air and covered 17 km, scouting ahead for the rover. Its last flight was January 18, 2024. It carries a tiny piece of fabric from the Wright brothers' first airplane.": "audio/hy-128.mp3", "Still on Mars, kid. Perseverance drills rock cores and seals each one in a tube. By July 2025 it had filled 33 of them, and ten wait on the ground at a spot called Three Forks. The mission to fetch them was cancelled, so NASA is looking for another way to bring them home.": "audio/hy-129.mp3", "Plenty of clues, kid. Lunar Prospector found extra hydrogen at the Moon's poles, and LCROSS confirmed water there in 2009. On Mars, Phoenix dug up water ice, and Spirit, Opportunity, Curiosity and Perseverance all found signs of ancient water.": "audio/hy-130.mp3", "File L-07, Apollo 11. The first two people to walk on the Moon set up their experiments, then flew home in the top half of their lander. The bottom half is still there. The mirror they left is a tray of 100 small glass prisms. It still bounces laser light back to Earth, and it is the only Apollo experiment that never stopped working. Each prism is 3.8 cm across, about the width of a ping-pong ball.": "audio/hy-131.mp3", "I'm Hy Drogen: one proton, one electron, and a nose for clues. Hydrogen is the most common atom in the universe, so I get into every case. Detectors on Lunar Prospector and Curiosity even hunt for hydrogen, because where there's hydrogen there may be water.": "audio/hy-132.mp3", "That one is not in my files, partner. Tap one of the questions below.": "audio/hy-133.mp3", "No. No person has been there.": "audio/hy-134.mp3", "No. Think of people, or of a crash.": "audio/hy-135.mp3", "Yes. It is from the early days.": "audio/hy-136.mp3", "No. It has gone quiet.": "audio/hy-137.mp3", "Yes. It hit the Moon so scientists could watch.": "audio/hy-138.mp3", "File L-01, Ranger 7. Before anyone could land on the Moon, somebody had to get a good look at it. Ranger 7 flew straight at the surface with its cameras rolling and sent home 4,316 photos before it hit. These were the first pictures of the Moon taken by a U.S. spacecraft. They showed the ground in far more detail than any telescope on Earth could. It was the first U.S. success at the Moon after 13 failures in a row. Space is hard.": "audio/hy-139.mp3", "Yes. It landed with nobody on board.": "audio/hy-140.mp3", "No. It was meant to land gently.": "audio/hy-141.mp3", "File L-02, Surveyor 1. Nobody knew if the Moon's surface could hold a spacecraft or if it would sink into dust. Surveyor 1 came down gently on three legs and stayed put. It made the first true soft landing by the U.S. and sent back 11,240 photos. It proved the technology for landing and working on the Moon was possible, which cleared the way for astronauts. It launched on May 30 and landed on June 2. A three-day trip.": "audio/hy-142.mp3", "File L-03, Surveyor 3. Surveyor 3 carried a robot scoop that dug trenches so scientists could test the soil. Two and a half years later, it had visitors. In November 1969 the Apollo 12 crew landed within walking distance, walked over, and brought pieces of the lander back to Earth, including its camera. Engineers studied them to learn how machines age on the Moon. So far it is the only robot on another world that people have walked up to and touched.": "audio/hy-143.mp3", "File L-04, Surveyor 5. Surveyor 5 brought a tiny chemistry kit. Its alpha-scattering instrument could work out what the soil was made of without a single test tube. It made the first chemical analysis of the surface of another world. The soil looked a lot like basalt, a dark volcanic rock that is common on Earth. It sits in the same lunar 'sea' where Apollo 11 landed two years later.": "audio/hy-144.mp3", "File L-05, Surveyor 6. A week after landing, mission control fired its thrusters for 2.5 seconds. Surveyor 6 rose about 3 meters and came back down 2.5 meters to the west. That little hop was the first liftoff from another world. The lander also sent back 29,952 pictures. Every rocket that has ever left the Moon owes something to this hop.": "audio/hy-145.mp3", "File L-06, Surveyor 7. The last Surveyor skipped the flat plains and went to the rugged highlands beside the bright crater Tycho. With a scoop, magnets on its feet and a chemistry instrument, it let scientists compare highland soil with the dark plains the earlier Surveyors tested. Tycho is the crater with the long bright rays. You can spot it with binoculars.": "audio/hy-146.mp3", "Yes. People walked there.": "audio/hy-147.mp3", "Yes. One part still does its job.": "audio/hy-148.mp3", "File L-08, Apollo 12. Apollo 12 made a pinpoint landing right next to an old robot: Surveyor 3. The crew walked over to it and collected parts. They also set up a science station with a moonquake detector and instruments to study the solar wind, the stream of particles (mostly hydrogen) that blows off the Sun. The pin for this file sits almost on top of Surveyor 3's. That is not a mistake.": "audio/hy-149.mp3", "File L-09, Apollo 14. The crew pulled their tools around in a handcart and left a second laser mirror, a twin of the one at Apollo 11. With more than one mirror, scientists can measure how the Moon wobbles and flexes, not just how far away it is. Two golf balls are here too. Astronaut Alan Shepard hit them with a club he made from a sampling tool.": "audio/hy-150.mp3", "File L-10, Apollo 15. Apollo 15 brought the first car to the Moon, the battery-powered Lunar Roving Vehicle. The crew drove it 27.8 km, then parked it for good. Its mirror has 300 prisms, three times as many as the others, so it sends back the strongest signal. Most laser measurements of the Moon use this one. A camera on the parked rover filmed the crew blasting off for home.": "audio/hy-151.mp3", "File L-11, Apollo 16. Apollo 16 was the first crew to explore the lunar highlands. Their rover covered 26.7 km. Rocks from here showed the highlands were shaped mostly by giant impacts, not volcanoes as many scientists had expected. Three Moon cars were driven on the Moon. All three are still parked where the crews left them.": "audio/hy-152.mp3", "File L-12, Apollo 17. The last Apollo crew stayed three days and drove their rover 35.9 km, farther than any other crew. One of the two moonwalkers, Harrison Schmitt, was a geologist. The rover let the crew reach rocks up to 7.6 km from their lander. As of 2026, nobody has walked on the Moon since this crew left.": "audio/hy-153.mp3", "No. It is newer than that.": "audio/hy-154.mp3", "File L-13, Lunar Prospector. For about 19 months Lunar Prospector circled the Moon with a detector that can sniff out hydrogen. That's me, kid. It found extra hydrogen at both poles. That was the first direct evidence of water ice hiding in craters where the Sun never shines. At the end it was steered into a dark crater to kick up water vapor. Telescopes saw none that day, so the case stayed open.": "audio/hy-155.mp3", "File L-14, LCROSS. An empty rocket stage slammed into a permanently dark crater. Four minutes later LCROSS flew through the cloud of debris, measured it, and then hit the Moon too. The cloud contained water. The impact dug out about 350 tons of material and left a crater about 20 meters wide. The case Lunar Prospector opened was closed. LCROSS hit at about 9,000 km per hour.": "audio/hy-156.mp3", "File L-15, GRAIL: Ebb and Flow. Twin spacecraft named Ebb and Flow chased each other around the Moon. Tiny changes in the gap between them revealed where the Moon's gravity pulls harder. They made the most detailed gravity map of any world. It showed dense lumps under the surface, left behind when huge asteroids hit the young Moon. The twins were named by schoolchildren in a contest.": "audio/hy-157.mp3", "File L-16, LADEE. LADEE studied the Moon's incredibly thin atmosphere and the dust that floats above the surface. It also tested sending data with a laser beam instead of radio waves, a faster way to talk across space. Its full name is the Lunar Atmosphere and Dust Environment Explorer.": "audio/hy-158.mp3", "File L-17, Odysseus (IM-1). NASA now pays companies to carry its instruments to the Moon. Odysseus, built by Intuitive Machines, was the first of these to land. It was the first U.S. landing on the Moon since Apollo 17 in 1972. It tipped over on touchdown but still sent data home. More than 51 years passed between Apollo 17 and this landing.": "audio/hy-159.mp3", "File L-18, Blue Ghost Mission 1. Firefly Aerospace's lander delivered 10 NASA instruments and worked for two weeks, until lunar night fell on March 16, 2025. All 10 instruments worked. One probe drilled about 1 meter into the ground to take the Moon's temperature. A new mirror called NGLR has already bounced laser light back to two observatories on Earth. It also watched an eclipse from the Moon: Earth sliding in front of the Sun.": "audio/hy-160.mp3", "File L-19, Athena (IM-2). Four days after Blue Ghost, a second company lander reached the Moon. Athena was headed for the south pole with a NASA drill built to look for ice. It reached the surface but ended up on its side, so the mission was cut short. Every attempt teaches engineers how to land near the pole, where the ice is. This is the closest any lander on this list has come to the south pole.": "audio/hy-161.mp3"};
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
  return { ok: true, isOn: () => on, set(v) { on = !!v; if (!on) stop(); }, speak, stop, clip, has: t => !!CLIPS[t] };
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
  mars: "Mars! Be three robots.",
  models: "Whose shadow is this?",
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
/* the spotlight: on while Hy's voice plays or his line is being typed, and for a moment after, so the child can finish reading */
(function () {
  let until = 0;
  setInterval(() => {
    const now = performance.now(), b = document.body.classList;
    if (guideState.voice || guideState.typing) until = now + 1600;
    b.toggle('hy-speaking', now < until && !guide.classList.contains('gone') && !guide.classList.contains('away') && !b.contains('intro-on') && !b.contains('finale-on'));
  }, 100);
})();
/* Enter skips whatever Hy is saying: the line appears in full and the voice stops. The intro is the one thing that cannot be skipped. */
addEventListener('keydown', e => {
  if (e.key !== 'Enter' || document.body.classList.contains('intro-on') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!guideState.typing && !guideState.voice) return;
  clearInterval(typing); guideState.typing = 0; if (sayEl.dataset.full) sayEl.textContent = sayEl.dataset.full; Voice.stop();
});
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
  const box = $('#file-' + c.world); if (!box) return;
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
  const c = byId[id]; if (!c || c.world !== 'moon') return;
  if (opts.user && Missions.intercept(c)) return;
  Notebook.file(id);
  selected[c.world] = id;
  $$('.caselist[data-world="' + c.world + '"] button').forEach(b => b.setAttribute('aria-current', b.parentNode.dataset.id === id));
  renderFile(c);
  if (globes[c.world]) globes[c.world].focus(id);
  if (opts.reveal) $('#' + c.world).scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  if (!opts.quiet) { say(c.name + '. ' + QUIPS[c.status], true, { silent: true }); Voice.speak(QUIPS[c.status]); }
}
buildPicker('moon'); renderFile(byId[selected.moon]);     /* only the Moon has a map of files; Mars is a quest */

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
  bReal.addEventListener('click', () => pick(true)); bFake.addEventListener('click', () => pick(false)); again.addEventListener('click', () => { Help.fresh('quiz'); start(); });
  start();
  PARTS.push(() => i < order.length && !bReal.disabled && inView(box) ? ['quiz', i] : null);
})();

/* ───────────────────────── Sources ───────────────────────── */
LBF.SOURCES.forEach(g => {
  const ul = el('ul');
  g.items.forEach(([t, u]) => ul.append(el('li', {}, el('a', { href: u, target: '_blank', rel: 'noopener', text: t }))));
  $('#srcgrid').append(el('div', {}, el('h3', { text: g.group }), ul));
});

/* ───────────────────────── 3D ───────────────────────── */
let three = false, showModel = function () {};
try { three = init3D(); } catch (err) { console.warn('3D unavailable:', err); }

/* Stop 4: whose shadow is this? The model is blacked out until you name it. */
(function () {
  const box = $('#g-models'); if (!box) return; if (!LBF.shadow) { box.hidden = true; return; }
  const keys = Object.keys(LBF.MODELS), N = Math.min(5, keys.length), dots = dotsRow(N);
  const ask = el('p', { class: 'ask', text: 'Can you name a machine by its shadow?' }), go = el('button', { class: 'btn big', text: 'Start' }), choices = el('div', { class: 'choices' });
  box.append(ask, el('div', { class: 'row' }, go, dots), choices);
  let order = [], i = 0, right = 0, playing = false;
  PARTS.push(() => playing && inView(box) ? ['shadow', i] : null);
  box._skip = () => { if (!playing) return; playing = false; i = N; LBF.shadow(false); $('#models .hangar').classList.remove('playing'); choices.replaceChildren(); ask.textContent = 'Can you name a machine by its shadow?'; go.textContent = 'Start'; go.hidden = false; };
  function round() {
    const hangar = $('#models .hangar');
    if (i >= N) { playing = false; LBF.shadow(false); hangar.classList.remove('playing'); choices.replaceChildren(); ask.textContent = right + ' of ' + N + '. Now spin them yourself.'; go.textContent = 'Play again'; go.hidden = false; Notebook.badge('shadow'); Sfx.win(); say('Good eye, detective.', true); return; }
    const key = order[i]; let missed = false; hangar.classList.add('playing'); LBF.shadow(true); showModel(key); ask.textContent = 'Whose shadow is this? Spin it.';
    choices.replaceChildren(...shuffle([key].concat(shuffle(keys.filter(k => k !== key)).slice(0, 2))).map(k => el('button', { class: 'btn ghost', text: LBF.MODELS[k].name, onclick: e => {
      if (k !== key) { answer(false); missed = true; e.currentTarget.disabled = true; return; }
      answer(true); if (!missed) right++; dots.children[i].className = missed ? 'miss' : 'ok'; LBF.shadow(false); ask.textContent = LBF.MODELS[key].name + '!';
      $$('button', choices).forEach(b => b.disabled = true); i++; setTimeout(round, 2200);
    } })));
  }
  go.addEventListener('click', () => { Help.fresh('shadow'); playing = true; order = shuffle(keys).slice(0, N); i = 0; right = 0; go.hidden = true; $$('span', dots).forEach(d => d.className = ''); say('Whose shadow is this?', true); round(); });
})();
if (!three) document.body.classList.add('no3d');

function init3D() {
  if (!window.THREE) return false;
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;   /* only Quest 3 has a light that casts shadows */
  renderer.setClearColor(0x000000, 1);
  const texLoader = new THREE.TextureLoader();
  const tex = (file, fallback) => {
    const t = texLoader.load('assets/' + file, undefined, undefined, () => { if (fallback) fallback(); });
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };
  const views = [], kit = {};                      /* kit: model builders one quest shares with another */
  const ll = (lat, lon, r) => {
    const phi = (lon + 180) * RAD, cl = Math.cos(lat * RAD);
    return new THREE.Vector3(-Math.cos(phi) * cl * r, Math.sin(lat * RAD) * r, Math.sin(phi) * cl * r);
  };
  const moonTex = tex('moon.jpg'), marsTex = tex('mars.jpg');
  const globeMat = (map, tint) => new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, color: tint || 0xffffff });

  /* sky */
  const sky = new THREE.Scene(), skyCam = new THREE.PerspectiveCamera(60, 1, 0.1, 100), skyAdd = { x: 0, y: 0 };     /* skyAdd: the ending turns the stars with its camera */
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
  globes.moon.focus(selected.moon);

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
    let lt = 0;
    views.push({ el: $('#st-laser'), scene, cam, update(dt, asp) {
      const hw = Math.max(5.1, 1.35 * asp), hh = hw / asp;
      cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.position.set(0.25, 0, 10);
      if (!RM) earth.rotation.y += dt * 0.05;
      lt = (lt + dt) % 5; const f = lt / 1.28;                   /* a pulse goes out and back at true speed, then rests */
      pulse.visible = f < 2; line.material.opacity = f < 2 ? 0.5 : 0.18;
      if (f < 2) pulse.position.lerpVectors(a, b, f < 1 ? f : 2 - f);
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
        const def = LBF.MODELS[key]; if (def && def.glb) return loader.load(def.glb, g => { cache[key] = fit(g.scene); res(cache[key]); }, undefined, () => rej(new Error('model file missing')));
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
    kit.lander = lander; kit.buggy = buggy;
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
    let jumpT = -1, jumpY = 0, jumpV = 0, landT = 9, camYaw = 0, camPitch = 0.3, look = null, lookIdle = 9, learned = [], qAt = -1;
    function reset() {
      pos.copy(START); headDir.set(0, 0, -1); headDir.addScaledVector(pos, -headDir.dot(pos)).normalize();
      earth.position.copy(pos).multiplyScalar(R + 2).addScaledVector(headDir, 100); placeDipper(headDir, pos);      /* Earth hangs low over the horizon ahead */
      zoom = 0; got = {}; learned = []; paused = false; qAt = -1; speed = 0; phase = 0; cheer = -1; jumpT = -1; jumpY = 0; camYaw = 0; camPitch = 0.3; sites.forEach(s => { s.found = false; s.beam.material.opacity = 0.35; if (s.flag) { s.up.remove(s.flag); s.flag = null; } if (s.fx) { (s.fx.parent || scene).remove(s.fx); s.fx = null; } (s.dust || []).forEach(d => s.up.remove(d)); s.dust = null; s.model.position.set(0, 0, 0); s.model.rotation.y = 0; });
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
      const f = $('#walk-found'); paused = true; f.hidden = false; qAt = i >= learned.length ? -1 : i;
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
      document.body.classList.remove('locked');
      setTimeout(() => $('#mirrors').scrollIntoView({ behavior: 'auto', block: 'start' }), 80);
    }
    function start() {
      reset(); active = true; box.hidden = false; document.body.classList.add('questing'); Missions.stopAll && Missions.stopAll();
      say('Find all four. Remember them. I will ask.', true); Help.fresh('q1:');
      soundOn = Music.isOn(); soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); Music.scene('m-hour-q1');
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
    box.append(skipBtn('Skip quest', () => {                 /* skipping opens the rest of the site and ticks the quest, but earns no badge */
      stop(); document.body.classList.remove('locked'); Notebook.skip('#moon');
      setTimeout(() => $('#mirrors').scrollIntoView({ behavior: 'auto', block: 'start' }), 80);
    }, 'btn ghost skipq'));
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
      { let near = 9; sites.forEach(s => { if (!s.found) near = Math.min(near, Math.acos(Math.min(1, pos.dot(s.dir)))); });       /* Hy watches: closer to a machine, or one more found, counts as progress */
        Help.part(paused ? (qAt >= 0 ? 'q1:quiz' : null) : zoom >= 1 ? 'q1:walk' : null, dt, paused ? qAt : Object.keys(got).length * 1000 - Math.round(near / 0.03)); }
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

  /* ══ Quest 2 begin ══ */
  /* Quest 2: bring the light home. The child fires a laser from Earth, rides it to the Moon, builds the corner of three
     mirrors that always sends light back where it came from, then uses the echo time to work out how far away the Moon is.
     Three places share one scene: the observatory on Earth (gA), Earth and Moon in space at true scale (gS), and the
     Apollo 15 site on the Moon (gM). Only one is shown at a time. */
  try { (function () {
    const box = $('#beam'), stage = $('#beam-stage'), B = LBF.BEAM; if (!box || !stage || !B) return;
    const tipEl = $('#beam-tip'), actBtn = $('#beam-act'), clockEl = $('#beam-clock'), reticle = $('#beam-reticle'), flashEl = $('#beam-flash'), foundEl = $('#beam-found'),
      scopeBox = $('#beam-scope'), portEl = $('#beam-port'), pipEl = $('#beam-pip'), ringEl = $('#beam-ring'), homeEl = $('#beam-home'), labelsEl = $('#beam-labels'), listEl = $('#beam-list'), keysEl = $('#beam-keys'), padEl = $('#beam .pad');
    const DEG = Math.PI / 180, V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), c01 = t => clamp(t, 0, 1), lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => { t = c01(t); return t * t * (3 - 2 * t); }, easeOut = t => 1 - Math.pow(1 - c01(t), 3);              /* slow in and slow out */
    const outBack = t => { t = c01(t); return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); };          /* overshoot, then settle: follow-through */
    const lin = hex => new THREE.Color(hex).convertSRGBToLinear();                 /* colours are written as they should look on screen */
    const M = (color, o) => { o = Object.assign({ roughness: 0.75, metalness: 0.05 }, o || {}); o.color = lin(color); if (o.emissive !== undefined) o.emissive = lin(o.emissive); return new THREE.MeshStandardMaterial(o); };
    const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };
    const CKM = 299792.458, MOON_KM = 384400, KM = 6371, T1 = MOON_KM / CKM;        /* light speed, Moon distance, Earth radius (km); one-way light time (s) */
    const km = n => Math.round(n).toLocaleString('en-US') + ' km';

    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.2, 6200), scopeCam = new THREE.PerspectiveCamera(30, 1, 0.5, 6200);
    cam.layers.enable(1);                                                          /* layer 1 = things only the main view shows */
    const hemi = new THREE.HemisphereLight(0xcfc8ff, 0x30343c, 0.6), sun = new THREE.DirectionalLight(0xffffff, 1.15); scene.add(hemi, sun);

    /* ---------- the sky: a dusk-violet dome and twinkling stars that travel with the camera ---------- */
    const skyG = new THREE.Group(); scene.add(skyG);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5500, 40, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: { up: { value: V(0, 1, 0) }, glow: { value: 1 } },
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 up; uniform float glow; varying vec3 d; void main(){ float h = dot(normalize(d), up);' +
        ' vec3 top = vec3(0.03, 0.025, 0.14), mid = vec3(0.11, 0.08, 0.34), low = vec3(0.27, 0.21, 0.6), hz = vec3(0.46, 0.38, 0.8);' +
        ' vec3 c = mix(mid, top, smoothstep(0.25, 0.95, h)); c = mix(mix(c, low, glow), c, smoothstep(-0.02, 0.34, h)); c = mix(mix(c, hz, glow), c, smoothstep(-0.12, 0.07, h));' +
        ' c = mix(vec3(0.06, 0.05, 0.2), c, smoothstep(-0.6, -0.12, h)); gl_FragColor = vec4(c, 1.0); }'
    })); dome.renderOrder = -10; dome.frustumCulled = false; skyG.add(dome);
    const starTex = spikes => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.9)'); gr.addColorStop(0.45, 'rgba(200,210,255,.25)'); gr.addColorStop(1, 'rgba(200,210,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      if (spikes) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 2); g.lineTo(32, 62); g.moveTo(2, 32); g.lineTo(62, 32); g.stroke(); }
      return new THREE.CanvasTexture(c);
    };
    const dotTex = starTex(false), sparkTex = starTex(true);
    const stars = [[700, 3, 0xffffff, dotTex], [380, 5, 0xcfe0ff, dotTex], [140, 9, 0xffffff, dotTex], [60, 15, 0xfff0d0, sparkTex], [28, 24, 0xdfe8ff, sparkTex]].map(([N, size, color, map], n) => {
      const a = new Float32Array(N * 3); let sd = 23 + n * 131; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < N; i++) { const u = rnd() * 2 - 1, t = rnd() * 6.2832, q = Math.sqrt(1 - u * u); a[i * 3] = q * Math.cos(t) * 5000; a[i * 3 + 1] = u * 5000; a[i * 3 + 2] = q * Math.sin(t) * 5000; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; skyG.add(pts); return pts;
    });

    /* ---------- shared bits: glowing sprites and laser beams ---------- */
    const earthTex = tex('earth.jpg');
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.8)'); gr.addColorStop(0.55, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const glow = (color, size, atten) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: !!atten })); s.scale.setScalar(size); return s; };
    /* A beam is a glowing tube from a to b. Its radius can grow with distance (k), because real laser beams spread out. */
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); beamGeo.translate(0, 0.5, 0);
    const beamMat = (color, op) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { len: { value: 1 }, r0: { value: 0.03 }, k: { value: 0 }, col: { value: new THREE.Color(color) }, op: { value: op } },
      vertexShader: 'uniform float len; uniform float r0; uniform float k; void main(){ float r = r0 + k * position.y * len; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x * r, position.y * len, position.z * r, 1.0); }',
      fragmentShader: 'uniform vec3 col; uniform float op; void main(){ gl_FragColor = vec4(col * op, 1.0); }' });
    const bTmp = V();
    function makeBeam(parent, layer) {
      const g = new THREE.Group(), glowM = beamMat(0x38e070, 0.5), coreM = beamMat(0xd8ffe4, 0.9);
      [glowM, coreM].forEach(m => { const o = new THREE.Mesh(beamGeo, m); o.frustumCulled = false; if (layer) o.layers.set(layer); g.add(o); });
      g.visible = false; parent.add(g);
      g.put = (a, b, r, k, power) => {
        bTmp.copy(b).sub(a); const len = bTmp.length(); if (len < 1e-4) { g.visible = false; return; }
        g.visible = true; g.position.copy(a); g.quaternion.setFromUnitVectors(UP, bTmp.divideScalar(len));
        glowM.uniforms.len.value = coreM.uniforms.len.value = len; glowM.uniforms.r0.value = r; glowM.uniforms.k.value = k || 0; coreM.uniforms.r0.value = r * 0.4; coreM.uniforms.k.value = (k || 0) * 0.4;
        const p = power === undefined ? 1 : power; glowM.uniforms.op.value = 0.5 * p; coreM.uniforms.op.value = 0.9 * p;
      };
      return g;
    }

    /* ════════ place A: the observatory on Earth, at night ════════ */
    const gA = new THREE.Group(); scene.add(gA);
    const CAM_A = V(0, 1.7, 14), MOON_R = 40, MOON_A = V(0, 1.7 + 300 * Math.sin(25 * DEG), 14 - 300 * Math.cos(25 * DEG));
    const lookWide = CAM_A.clone().add(V(0, Math.tan(13 * DEG), -1).multiplyScalar(100));
    (function () {
      const ground = mesh(new THREE.CircleGeometry(900, 40), M(0x0a0e22, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; gA.add(ground);
      let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, hill = new THREE.MeshBasicMaterial({ color: 0x0b0a26 }), tree = new THREE.MeshBasicMaterial({ color: 0x070818 });
      for (let i = 0; i < 18; i++) {                 /* low hills on the horizon, as dark shapes against the sky: staging */
        const a = -Math.PI * (0.04 + 0.92 * i / 17), r = 150 + rnd() * 120, s = 16 + rnd() * 26, h = mesh(new THREE.SphereGeometry(1, 16, 10), hill, Math.cos(a) * r, -2, 14 + Math.sin(a) * r);
        h.scale.set(s * 2.4, s * (0.2 + rnd() * 0.25), s); gA.add(h);
      }
      for (let i = 0; i < 26; i++) {                 /* pine trees, so it reads as Earth */
        const x = -34 + rnd() * 68, z = -40 + rnd() * 36, hgt = 2.6 + rnd() * 3; if (Math.abs(x + 2.2) < 3.4 && z > -6) continue;
        gA.add(mesh(new THREE.ConeGeometry(0.7 + rnd() * 0.6, hgt, 7), tree, x, hgt / 2, z));
      }
    })();
    const obs = new THREE.Group(); obs.position.set(-2.2, 0, 2); gA.add(obs);
    const white = M(0xe9eaf2, { roughness: 0.6 }), grey = M(0x8d9096), dark = M(0x24262e), steel = M(0xd0d4de, { metalness: 0.6, roughness: 0.35 });
    obs.add(mesh(new THREE.CylinderGeometry(1.0, 1.08, 1.3, 24), white, 0, 0.65, 0), mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 24), grey, 0, 1.33, 0), mesh(new THREE.BoxGeometry(0.5, 0.9, 0.06), dark, 0, 0.45, 1.06));
    const domeG = new THREE.Group(); domeG.position.y = 1.38; obs.add(domeG);                 /* the dome turns so its slit faces where the telescope points */
    domeG.add(mesh(new THREE.SphereGeometry(1.06, 28, 12, 0.38, Math.PI * 2 - 0.76, 0, Math.PI / 2), M(0xf3f4fa, { roughness: 0.5, side: THREE.DoubleSide })));
    const tube = new THREE.Group(); tube.position.set(0, 1.55, 0); obs.add(tube);
    const tubeIn = new THREE.Group(); tube.add(tubeIn);
    (function () {
      const t = mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.9, 16), steel, 0, 0, 0.55); t.rotation.x = Math.PI / 2; tubeIn.add(t);
      tubeIn.add(mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), dark, 0, 0, 1.5), mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshBasicMaterial({ color: 0x63f08a }), 0, 0, 1.505));
    })();
    const lamp = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4d }), 0, 2.5, 0); obs.add(lamp);
    const moonA = mesh(new THREE.SphereGeometry(MOON_R, 64, 48), new THREE.MeshBasicMaterial({ map: moonTex, color: 0xf6f3ea })); moonA.position.copy(MOON_A); gA.add(moonA);
    (function () {                                   /* near side toward us, north up, east on the right: the Moon as seen from the northern half of Earth */
      const x = CAM_A.clone().sub(MOON_A).normalize(), y = UP.clone().addScaledVector(x, -UP.dot(x)).normalize(), z = new THREE.Vector3().crossVectors(x, y);
      moonA.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      const halo = glow(0xcfd6ff, 190, true); halo.material.opacity = 0.35; halo.material.depthTest = true; halo.position.copy(MOON_A).addScaledVector(x, -30); halo.renderOrder = -5; gA.add(halo);
    })();
    const A15 = byId.apollo15 || { lat: 26.13, lon: 3.63 };
    const mark = new THREE.Group();                  /* the Apollo 15 mirror: a ring you can aim at */
    (function () {
      const p = ll(A15.lat, A15.lon, MOON_R + 0.3); mark.position.copy(p); mark.quaternion.setFromUnitVectors(V(0, 0, 1), p.clone().normalize());
      mark.add(mesh(new THREE.RingGeometry(2.3, 3.0, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })), mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0x63f08a })));
      moonA.add(mark);
    })();
    const dustS = glow(0xd8ffe6, 6, true); dustS.visible = false; gA.add(dustS);
    const dustR = mesh(new THREE.RingGeometry(0.72, 1, 48), new THREE.MeshBasicMaterial({ color: 0x4dff8a, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide })); dustR.visible = false; gA.add(dustR);
    const beamA = makeBeam(gA), aimP = MOON_A.clone(), markW = V(), muzzle = V();
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), moonSphere = new THREE.Sphere(MOON_A, MOON_R), aimPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(CAM_A.clone().sub(MOON_A).normalize(), MOON_A), hitTmp = V();
    function aimRay() {                              /* put the aim point where the current ray meets the Moon, or the sky beside it */
      if (ray.ray.intersectSphere(moonSphere, hitTmp)) { aimP.copy(hitTmp); return true; }
      if (ray.ray.intersectPlane(aimPlane, hitTmp)) aimP.copy(hitTmp);
      return false;
    }
    function aimAt(x, y) { ndc.set((x - R.left) / R.width * 2 - 1, -((y - R.top) / R.height) * 2 + 1); ray.setFromCamera(ndc, cam); S.onMoon = aimRay(); }

    /* ════════ place S: Earth and Moon in space, at true scale (1 unit = Earth's radius) ════════ */
    const gS = new THREE.Group(); scene.add(gS);
    const DM = MOON_KM / KM, MR = 0.2727, X0 = 1, X1 = DM - MR;                   /* the light leaves Earth's surface at X0 and meets the Moon's at X1 */
    const earthS = mesh(new THREE.SphereGeometry(1, 64, 48), globeMat(earthTex)), moonS = mesh(new THREE.SphereGeometry(MR, 48, 32), globeMat(moonTex), DM, 0, 0);
    earthS.rotation.y = 2.2; moonS.rotation.y = Math.PI; gS.add(earthS, moonS);
    earthS.add(mesh(new THREE.SphereGeometry(1.04, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.28, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    const pulse = glow(0x8dffb0, 0.055, false), pulseCore = glow(0xffffff, 0.022, false); gS.add(pulse, pulseCore);
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(X0, 0, 0), V(X0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0x63f08a, transparent: true, opacity: 0.6 })); trail.frustumCulled = false; gS.add(trail);
    const rings = new THREE.Group();                 /* hoops along the flight path: they rush past and make the speed visible */
    (function () {
      const rg = new THREE.TorusGeometry(0.5, 0.006, 6, 48), rm = new THREE.MeshBasicMaterial({ color: 0x7dffa6, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let x = 2.5; x < X1 - 0.8; x += 1.5) { const r = mesh(rg, rm, x, 0, 0); r.rotation.y = Math.PI / 2; rings.add(r); }
    })();
    rings.visible = false; gS.add(rings);
    const sat = new THREE.Group();                   /* a weather satellite, 36,000 km up: one tenth of the way to the Moon */
    (function () {
      const pm = M(0x2f56c8, { metalness: 0.4, roughness: 0.35, emissive: 0x1a2f7a });
      sat.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22), M(0xe0b04a, { metalness: 0.9, roughness: 0.3, emissive: 0x5a4010 })), mesh(new THREE.BoxGeometry(0.36, 0.012, 0.18), pm, 0.27, 0, 0), mesh(new THREE.BoxGeometry(0.36, 0.012, 0.18), pm, -0.27, 0, 0));
      const dish = mesh(new THREE.ConeGeometry(0.08, 0.05, 14, 1, true), M(0xffffff, { side: THREE.DoubleSide, emissive: 0x44444a }), 0, -0.12, 0); sat.add(dish);
      sat.position.set(42164 / KM, 0.1, -0.42); sat.rotation.set(0.4, 0.5, 0.2);
    })();
    gS.add(sat);

    /* ════════ place M: the Apollo 15 site on the Moon ════════ */
    const gM = new THREE.Group(); scene.add(gM);
    const m0 = V(0.45, 0.62, 0.64).normalize();                                     /* where Earth sits in the Moon's sky, on average */
    const Xr = V(m0.z, 0, -m0.x).normalize(), Yr = new THREE.Vector3().crossVectors(m0, Xr);   /* the mirror stand's own axes: Xr sideways (the hinge), Yr up and back, m0 toward Earth */
    const ORG = V(0, 1.35, 0), ED = 900, ER = 70, HOME = 4 * DEG, L = 1.3;          /* hinge point, Earth's distance and size, how close counts as "home", mirror size */
    const rigBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xr, Yr, m0));
    (function () {
      const map = tex('moonsurf.jpg'), bump = texLoader.load('assets/moonbump.jpg');
      [map, bump].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1120, 1120); t.anisotropy = 8; });
      const g = mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.05, roughness: 1, metalness: 0, color: lin(0xe6e6ee) })); g.rotation.x = -Math.PI / 2; gM.add(g);
      let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, hm = M(0x8a8a93, { roughness: 1 }), rk = M(0x9a989c, { roughness: 1, flatShading: true }), ico = new THREE.IcosahedronGeometry(1, 0);
      for (let i = 0; i < 20; i++) {                 /* the mountains around Hadley Rille, far away */
        const a = rnd() * 6.283, r = 1400 + rnd() * 900, s = 150 + rnd() * 170, h = mesh(new THREE.SphereGeometry(1, 18, 10), hm, Math.cos(a) * r, -10, Math.sin(a) * r); h.scale.set(s * 1.9, s * (0.28 + rnd() * 0.3), s * 1.3); gM.add(h);
      }
      for (let i = 0; i < 46; i++) {                 /* loose rocks */
        const a = rnd() * 6.283, r = 3.2 + rnd() * rnd() * 46, k = 0.06 + rnd() * rnd() * 0.5, s = mesh(ico, rk, Math.cos(a) * r, k * 0.3, Math.sin(a) * r); s.scale.set(k * (0.7 + rnd()), k * (0.5 + rnd() * 0.5), k * (0.7 + rnd())); s.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); gM.add(s);
      }
      if (kit.lander) { const l = kit.lander(true); l.scale.setScalar(7); l.position.set(-15, 0, -22); l.rotation.y = 0.6; gM.add(l); }        /* the lander's bottom half and the Moon car are still parked here */
      if (kit.buggy) { const b = kit.buggy(); b.scale.multiplyScalar(2.4); b.position.set(10, 0, -13); b.rotation.y = -0.9; gM.add(b); }
    })();
    const spotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.8, 'rgba(255,255,255,.7)'); gr.addColorStop(0.97, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
    const spot = mesh(new THREE.CircleGeometry(1000, 72), new THREE.MeshBasicMaterial({ map: spotTex, color: 0x4fe07a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }), ORG.x, 0.05, ORG.z);
    spot.rotation.x = -Math.PI / 2; spot.renderOrder = -1; gM.add(spot);           /* by the time it reaches the Moon the beam is about 2 km wide: this is its footprint */
    const earthM = mesh(new THREE.SphereGeometry(ER, 64, 48), new THREE.MeshBasicMaterial({ map: earthTex })); gM.add(earthM);
    const haloM = mesh(new THREE.SphereGeometry(ER * 1.07, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.28, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })); earthM.add(haloM);
    const earthHit = glow(0x8dffb0, 0.1, false); earthHit.visible = false; gM.add(earthHit);

    /* the mirrors. Each one is a square plate; the tracer below treats it as a perfect mirror on both sides. */
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { format: THREE.RGBFormat, generateMipmaps: false, minFilter: THREE.LinearFilter }), cubeCam = new THREE.CubeCamera(0.5, 6200, cubeRT);
    cubeCam.position.copy(ORG); scene.add(cubeCam);
    const mirrorMat = new THREE.MeshBasicMaterial({ color: 0xcfdcff, envMap: cubeRT.texture, reflectivity: 0.88, combine: THREE.MixOperation }), edgeMat = M(0xf0f2f8, { metalness: 0.6, roughness: 0.35 });
    const plateGeo = new THREE.BoxGeometry(L, L, 0.035), frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(L, L)), frameMat = new THREE.LineBasicMaterial({ color: 0xbfe6ff });
    const glintMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.55, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(22, 70); g.lineTo(70, 22); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(40, 84); g.lineTo(84, 40); g.stroke(); return new THREE.CanvasTexture(c); })() });
    const glintGeo = new THREE.PlaneGeometry(L * 0.94, L * 0.94);      /* the two slanted glints every cartoon mirror has, so these read as mirrors at a glance */
    const plate = () => { const m = new THREE.Mesh(plateGeo, [edgeMat, edgeMat, edgeMat, edgeMat, mirrorMat, mirrorMat]); m.add(new THREE.LineSegments(frameGeo, frameMat));
      const g1 = mesh(glintGeo, glintMat, 0, 0, 0.02), g2 = mesh(glintGeo, glintMat, 0, 0, -0.02); g2.rotation.y = Math.PI; m.add(g1, g2); return m; };
    const rig = new THREE.Group(); gM.add(rig);
    const pivA = new THREE.Group(), pivB = new THREE.Group(), pivC = new THREE.Group(), pA = plate(), pB = plate(), pC = plate();
    pA.position.set(0, L / 2, 0); pivA.add(pA); pB.position.set(0, L / 2, 0); pivB.add(pB); pivC.position.set(L / 2, 0, 0); pivB.add(pivC); pC.position.set(L / 2, L / 2, 0); pivC.add(pC); rig.add(pivA, pivB);
    const hingeB = mesh(new THREE.CylinderGeometry(0.04, 0.04, L + 0.12, 10), steel); hingeB.rotation.z = Math.PI / 2; rig.add(hingeB);
    const hingeC = mesh(new THREE.CylinderGeometry(0.035, 0.035, L + 0.06, 10), steel, 0, L / 2, 0); pivC.add(hingeC);
    const standG = new THREE.Group(); standG.position.set(ORG.x, 0, ORG.z); gM.add(standG);            /* a tripod: the hinge sits on top of its post */
    (function () {
      standG.add(mesh(new THREE.CylinderGeometry(0.045, 0.065, ORG.y - 0.04, 12), grey, 0, (ORG.y - 0.04) / 2, 0), mesh(new THREE.SphereGeometry(0.085, 14, 10), steel, 0, ORG.y - 0.03, 0));
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5, leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), grey, Math.cos(a) * 0.27, 0.24, Math.sin(a) * 0.27); leg.rotation.z = -Math.cos(a) * 0.85; leg.rotation.x = Math.sin(a) * 0.85; standG.add(leg);
        standG.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), grey, Math.cos(a) * 0.56, 0.015, Math.sin(a) * 0.56)); }
    })();
    /* the real thing: Apollo 15's panel of 300 little glass corners (20 across, 15 down) */
    const tray = new THREE.Group(); tray.position.copy(ORG); tray.quaternion.copy(rigBase); tray.visible = false; gM.add(tray);
    (function () {
      const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d');
      g.fillStyle = '#d2d5da'; g.fillRect(0, 0, 640, 400); g.strokeStyle = '#8b8f96'; g.lineWidth = 8; g.strokeRect(4, 4, 632, 392);
      for (let i = 0; i < 20; i++) for (let j = 0; j < 15; j++) {
        const x = 26 + i * 30.9, y = 24 + j * 25.1;
        g.fillStyle = '#353841'; g.beginPath(); g.arc(x, y, 10.5, 0, 7); g.fill();
        g.fillStyle = '#8fa6c9'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 9, -2.6, -0.5); g.fill();
        g.strokeStyle = '#c9d6ee'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(x, y); g.lineTo(x + Math.cos(k * 2.094 - 1.57) * 9.5, y + Math.sin(k * 2.094 - 1.57) * 9.5); } g.stroke();
      }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
      tray.add(mesh(new THREE.BoxGeometry(2.24, 1.42, 0.1), M(0xd8dade, { metalness: 0.5, roughness: 0.4 }), 0, 0, -0.05), mesh(new THREE.PlaneGeometry(2.1, 1.3), new THREE.MeshStandardMaterial({ map: t, metalness: 0.2, roughness: 0.5, emissive: lin(0x30343c) }), 0, 0, 0.004));
    })();
    const trayCell = V(-0.9, 0.52, 0.03).applyQuaternion(rigBase).add(ORG);         /* where the big corner shrinks to: one cell of the panel */
    /* light that travels: the beam into the mirrors (main view only), the hops between mirrors, and the beam out */
    const bIn = makeBeam(gM, 1), bSeg = [0, 1, 2, 3, 4, 5].map(() => makeBeam(gM)), bOut = makeBeam(gM, 1), bFar = makeBeam(gM);       /* the far part of the beam out is the only part the Earth scope shows */
    const beads = [0, 1, 2, 3, 4, 5].map(() => { const b = glow(0xf4fff8, 0.2, true); b.visible = false; gM.add(b); return b; }), path = [], lens = [], beadA = V(), beadB = V();    /* beads of light run along the beam to show which way it travels */
    const hitS = [0, 1, 2, 3, 4, 5, 6].map(() => { const s = glow(0xb8ffd0, 0.3, true); s.visible = false; gM.add(s); return s; });
    const landS = glow(0x8dffb0, 0.045, false); landS.visible = false; gM.add(landS);
    const splash = glow(0x8dffb0, 1.1, true); splash.visible = false; gM.add(splash);
    scopeCam.position.copy(ORG).addScaledVector(m0, -6).addScaledVector(Yr, 2.6); scopeCam.up.copy(Yr); scopeCam.lookAt(scopeCam.position.clone().add(m0));

    /* The tracer: follow one ray of laser light as it bounces off whichever mirrors are in place.
       Every bounce obeys the mirror law (angle in = angle out). Three mirrors at right angles turn any ray straight back. */
    const plates = [{ m: pA, on: () => true }, { m: pB, on: () => S.n >= 2 && S.popB > 0.9 }, { m: pC, on: () => S.n >= 3 && S.popC > 0.9 }];
    const T = { n: 0, err: 9, home: false, pts: [V(), V(), V(), V(), V(), V(), V(), V(), V()], dir: V() };
    const e1 = V(), e2 = V(), nn = V(), cc = V(), hh = V(), bestN = V();
    function trace(origin, dir) {
      T.pts[0].copy(origin); const d = T.dir.copy(dir); let n = 0;
      for (; n < 7; n++) {
        let best = Infinity;
        for (const pl of plates) {
          if (!pl.on()) continue;
          pl.m.matrixWorld.extractBasis(e1, e2, nn); cc.setFromMatrixPosition(pl.m.matrixWorld);
          const half = L / 2 * e1.length(); e1.normalize(); e2.normalize(); nn.normalize();
          const dn = d.dot(nn); if (Math.abs(dn) < 1e-6) continue;
          const t = hh.copy(cc).sub(T.pts[n]).dot(nn) / dn; if (t < 1e-4 || t >= best) continue;
          hh.copy(T.pts[n]).addScaledVector(d, t).sub(cc);
          if (Math.abs(hh.dot(e1)) <= half && Math.abs(hh.dot(e2)) <= half) { best = t; bestN.copy(nn); }
        }
        if (best === Infinity) break;
        T.pts[n + 1].copy(T.pts[n]).addScaledVector(d, best); d.addScaledVector(bestN, -2 * d.dot(bestN)).normalize();
      }
      T.n = n;
    }

    /* ---------- state, HUD and small helpers ---------- */
    const S = {}, keys = { left: 0, right: 0, up: 0, down: 0 }, tweens = [], stages = {}, rows = {}, labs = {};
    let active = false, clock = 0, R = { left: 0, top: 0, width: 1, height: 1 }, ASP = 1.6, labTick = 0, frameN = 0, drag = null, finished = false;
    const goal = { pos: V(), look: V(), fov: 50, speed: 3 }, look = V(), camUp = V(0, 1, 0), lp = V(), t1 = V(), t2 = V();
    function camTo(pos, at, fov, speed) { goal.pos.copy(pos); goal.look.copy(at); if (fov) goal.fov = fov; goal.speed = speed || 3; }
    function camSet(pos, at, fov) { camTo(pos, at, fov); cam.position.copy(pos); look.copy(at); cam.fov = goal.fov; }
    function tween(key, to, dur, fn, delay) { tweens.push({ key, from: S[key], to, t: 0, dur, fn: fn || ease, delay: delay || 0 }); }
    function showOnly(g) { gA.visible = g === gA; gS.visible = g === gS; gM.visible = g === gM; scopeBox.hidden = true; reticle.hidden = true; padEl.hidden = true; }
    function lights(k) {
      if (k === 'earth') { sun.position.copy(MOON_A).sub(CAM_A); sun.intensity = 0.7; hemi.intensity = 0.55; dome.material.uniforms.glow.value = 1; }
      else if (k === 'space') { sun.position.set(-20, 30, 60); sun.intensity = 1.25; hemi.intensity = 0.3; dome.material.uniforms.glow.value = 0.3; }
      else { sun.position.set(-50, 60, 30); sun.intensity = 1.15; hemi.intensity = 0.6; dome.material.uniforms.glow.value = 0.85; }
    }
    const tip = t => { if (tipEl.textContent !== t) tipEl.textContent = t; };
    const hint = t => { keysEl.textContent = t; };
    const line = k => { if (B.say[k]) say(B.say[k], true); };
    function act(label, fn) { if (!label) { actBtn.hidden = true; S.act = null; return; } actBtn.textContent = label; actBtn.hidden = false; S.act = fn; }
    function flash(ms) { flashEl.style.transition = 'none'; flashEl.style.opacity = 0.85; void flashEl.offsetWidth; flashEl.style.transition = 'opacity ' + ms + 'ms ease-out'; flashEl.style.opacity = 0; }
    function clock2(big, small, ok) { clockEl.hidden = false; clockEl.firstElementChild.textContent = big; clockEl.lastElementChild.textContent = small; clockEl.classList.toggle('ok', !!ok); }
    function lab(id, text, p, cls) {                 /* a word that floats next to a thing in the 3D scene */
      let s = labs[id]; if (!s) { s = labs[id] = el('span', { class: 'lab3d' }); labelsEl.append(s); }
      if (s.textContent !== text) s.textContent = text; s.className = 'lab3d ' + (cls || ''); s._t = labTick;
      lp.copy(p).project(cam); const ok = lp.z < 1 && Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 1.05; s.hidden = !ok;
      if (ok) s.style.transform = 'translate(' + ((lp.x + 1) / 2 * R.width + R.left).toFixed(1) + 'px,' + ((1 - lp.y) / 2 * R.height + R.top).toFixed(1) + 'px)';
    }
    const svg = d => '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const STEPS = [
      ['fire', 'Fire the laser', svg('<path d="M3 21h11M5 21v-5a3.5 3.5 0 017 0v5"/><path d="M10 13l9-9" stroke-dasharray="2 2.4"/><circle cx="20" cy="3.5" r="1.8"/>')],
      ['one', 'One mirror', svg('<path d="M4 19h16"/><path d="M5 5l7 14 7-14" stroke-dasharray="2 2.4"/>')],
      ['two', 'Two mirrors', svg('<path d="M5 3v16h16"/><path d="M17 3L5 15l4 4L21 7" stroke-dasharray="2 2.4"/>')],
      ['three', 'Three mirrors', svg('<path d="M12 13V3M12 13l-8 5M12 13l8 5"/><path d="M4 8l8-5 8 5v10l-8 4-8-4z"/>')],
      ['far', 'How far is the Moon?', svg('<circle cx="5" cy="12" r="3.2"/><circle cx="20" cy="12" r="1.7"/><path d="M9.5 12h8" stroke-dasharray="2 2.4"/>')]
    ];
    function buildList() {
      listEl.replaceChildren();
      STEPS.forEach(([k, label, icon]) => { const ic = el('span', { class: 'icon' }); ic.innerHTML = icon; const li = el('li', {}, ic, el('span', { text: label }), el('span', { class: 'arrow', text: '' })); rows[k] = li; listEl.append(li); });
    }
    const stepNow = k => { for (const id in rows) rows[id].classList.toggle('now', id === k); };
    const stepDone = k => { rows[k].classList.add('done'); rows[k].classList.remove('now'); rows[k].querySelector('.arrow').textContent = '✓'; };
    function card(c, fn) {                           /* a short fact to remember, with the key words highlighted */
      S.paused = true; const p = el('p', { class: 'fact' }); c[1].split('*').forEach((t, n) => p.append(n % 2 ? el('mark', { text: t }) : t));
      foundEl.replaceChildren(el('h3', { text: c[0] }), p, el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: c[2], onclick: () => { foundEl.hidden = true; S.paused = false; fn && fn(); } })));
      foundEl.hidden = false;
    }
    function quiz(i, misses) {                       /* before the quest ends, Hy checks what stuck */
      S.paused = true; foundEl.hidden = false; S.quizAt = i >= B.quiz.length ? -1 : i;
      if (i >= B.quiz.length) {
        foundEl.replaceChildren(el('h3', { text: 'Quest complete!' }), el('p', { class: 'fact', text: 'You brought the light home.' }), el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: 'Go to Stop 3', onclick: finish })));
        Sfx.win(); say(misses ? 'Case closed. You earned your badge, partner.' : 'A perfect score. You could run this agency, kid.', true); return;
      }
      const q = B.quiz[i], note = el('p', { text: (i + 1) + ' of ' + B.quiz.length }), list = el('div', { class: 'opts' });
      shuffle(q[1].map((t, n) => ({ t, ok: n === 0 }))).forEach(o => list.append(el('button', { text: o.t, onclick: e => {
        answer(o.ok);
        if (o.ok) { e.currentTarget.classList.add('yes'); $$('button', list).forEach(b => b.disabled = true); note.textContent = 'Yes!'; setTimeout(() => { if (active) quiz(i + 1, misses); }, 1400); }
        else { e.currentTarget.classList.add('no'); e.currentTarget.disabled = true; misses++; note.textContent = 'Try again.'; }
      } })));
      foundEl.replaceChildren(el('h3', { text: q[0] }), note, list);
    }
    function go(name) { const prev = stages[S.name]; if (prev && prev.exit) prev.exit(); S.name = name; S.t = 0; S.ddx = S.ddy = 0; S.released = false; const st = stages[name]; if (st.enter) st.enter(); }

    /* ════════ the story, one stage at a time ════════ */
    /* 1. On Earth: point the telescope at the Moon … */
    stages.aim = {
      enter() { showOnly(gA); lights('earth'); camUp.set(0, 1, 0); camSet(CAM_A, lookWide, ASP < 0.9 ? 64 : 52); S.shot = -1; stepNow('fire'); tip('Tap the Moon.'); hint('Tap the Moon to point the telescope at it.'); act(null); reticle.hidden = true; padEl.hidden = true; clockEl.hidden = true; line('aim'); },
      update(dt) {
        goal.fov = ASP < 0.9 ? 64 : 52;
        if (S.shot < 0) { const a = clock * 0.3; aimP.copy(MOON_A).add(lp.set(Math.cos(a) * 120, 30 + Math.sin(a * 1.3) * 28, 0)); }      /* the telescope scans the sky while it waits */
        else { S.shot += dt; if (S.shot > 1.1) S.shot = -1; }
        S.boost = S.shot >= 0 && S.shot < 0.45 ? 1 : 0;
      },
      tap(x, y) { aimAt(x, y); if (S.onMoon) go('zoom'); else { S.shot = 0; Sfx.zap(); tip('Nothing out there. Tap the Moon.'); } },
      space() { go('zoom'); }
    };
    /* … then find the mirror through the telescope and fire at it. Hitting bare ground just scatters the light. */
    const zoomFov = () => Math.max(26, 2 * Math.atan(Math.tan(8.8 * DEG) / ASP) / DEG);
    const lockTest = () => { mark.getWorldPosition(markW); S.locked = S.onMoon && aimP.distanceTo(markW) < 7; };
    stages.zoom = {
      enter() { camTo(CAM_A, MOON_A, zoomFov(), 2.6); aimP.copy(MOON_A).addScaledVector(lp.subVectors(CAM_A, MOON_A).normalize(), MOON_R); S.onMoon = true; S.dust = -1; S.shot = -1; reticle.hidden = false; padEl.hidden = false;
        tip('Find the mirror. Tap it to fire.'); hint('Tap the glowing ring to fire. Keys: arrows aim, Space fires.'); },
      update(dt) {
        goal.fov = zoomFov(); const kx = keys.right - keys.left, ky = keys.up - keys.down;
        if (kx || ky) { e1.set(1, 0, 0).applyQuaternion(cam.quaternion); e2.set(0, 1, 0).applyQuaternion(cam.quaternion); aimP.addScaledVector(e1, kx * 34 * dt).addScaledVector(e2, ky * 34 * dt);
          ray.ray.origin.copy(cam.position); ray.ray.direction.copy(aimP).sub(cam.position).normalize(); S.onMoon = aimRay(); }
        lockTest(); if (S.dust >= 0) { S.dust += dt; if (S.dust > 0.9) S.dust = -1; }
        S.boost = S.dust >= 0 && S.dust < 0.3 ? 1 : 0;
      },
      move(x, y) { aimAt(x, y); },
      tap(x, y) { aimAt(x, y); lockTest(); this.space(); },
      space() {
        if (S.locked) go('fire');
        else if (S.onMoon) { S.dust = 0; dustS.position.copy(aimP); dustR.position.copy(aimP); dustR.quaternion.setFromUnitVectors(lp.set(0, 0, 1), t1.copy(aimP).sub(MOON_A).normalize()); Sfx.zap(); tip('Just dust. It scatters the light. Tap the ring.'); if (!S.said.dust) { S.said.dust = 1; line('dust'); G.react('no'); } }
        else tip('Aim at the Moon.');
      }
    };
    stages.fire = {
      enter() { act(null); reticle.hidden = true; padEl.hidden = true; tip('Fire!'); S.fired = false; aimP.copy(markW); Sfx.zap(); Sfx.whoosh(); },
      update() {
        const t = S.t; S.kick = t < 0.12 ? -0.22 * (t / 0.12) : -0.22 * Math.max(0, 1 - (t - 0.12) / 0.35) * Math.cos((t - 0.12) * 16);   /* anticipation: the tube pulls back, then springs forward */
        S.boost = t > 0.1 ? 1 : 0; if (t > 0.55 && !S.fired) { S.fired = true; flash(650); }
        if (t > 0.8) { S.kick = 0; S.boost = 0; stepDone('fire'); go('launch'); }
      }
    };
    /* 2. In space, at true scale and true speed: 1.3 seconds from Earth to the Moon. */
    function wide(cx, half, snap) {                  /* frame Earth and Moon together, clear of the HUD; on tall screens turn the picture so the Moon is at the top */
      const port = ASP < 0.9, tn = Math.tan(20 * DEG); if (port) { cx += 6; half += 11; } const dist = half / (port ? tn : tn * ASP), lift = port ? 0 : dist * 0.1; camUp.set(port ? 1 : 0, port ? 0 : 1, 0);
      t1.set(cx, lift, dist); t2.set(cx, lift, 0); (snap ? camSet : camTo)(t1, t2, 40, 2.5);
    }
    stages.launch = {
      enter() { showOnly(gS); lights('space'); wide(DM / 2, DM / 2 + 5, true); S.px = X0; S.trailA = X0; S.trailB = undefined; moonS.position.x = DM; S.hit = false; S.carded = false; pulse.visible = pulseCore.visible = false; rings.visible = false; tip('Real size. Real speed. Watch!'); hint(''); clock2('0.00 s', '0 km'); },
      update() {
        wide(DM / 2, DM / 2 + 5); const tt = S.t - 0.9, f = c01(tt / T1); S.px = lerp(X0, X1, f); pulse.visible = pulseCore.visible = tt > 0;      /* light never speeds up or slows down, so no easing here */
        clock2((f * T1).toFixed(2) + ' s', km(f * MOON_KM));
        if (tt >= T1 && !S.hit) { S.hit = true; Sfx.ping(); tip('1.3 seconds!'); line('fast'); }
        if (tt > T1 + 1.7 && !S.carded) { S.carded = true; card(B.cards[0], () => go('ride')); }
      }
    };
    /* The same trip again in slow motion, riding beside the light. */
    stages.ride = {
      enter() { showOnly(gS); lights('space'); camUp.set(0, 1, 0); S.camFree = true; rings.visible = true; S.trailA = X0; S.trailB = undefined; moonS.position.x = DM; hint(''); tip('Slow motion. Ride the light!'); act('Skip', () => { flash(400); go('descend'); }); Sfx.whoosh(); },
      update() {
        const u = c01(S.t / 7.5), e = ease(u); S.px = lerp(X0, X1, e); pulse.visible = pulseCore.visible = true;
        const s1 = ease(u / 0.26), s2 = ease((u - 0.1) / 0.3), s3 = ease((u - 0.84) / 0.16);
        cam.position.set(S.px - lerp(lerp(-1.2, 1.7, s1), 0.6, s3), lerp(lerp(0.9, 0.4, s1), 0.14, s3), lerp(lerp(2.4, 0.85, s1), 0.3, s3));      /* start ahead of the light looking back at Earth, then fall in behind it */
        look.set(lerp(S.px - 0.6, S.px + 7, s2), 0, 0); if (s3 > 0) look.lerp(moonS.position, s3);
        cam.fov = lerp(52, 62, Math.sin(u * Math.PI));                                                   /* the view stretches wider at full speed: exaggeration */
        clock2(km(e * MOON_KM), 'slow motion');
        tip(u > 0.13 && u < 0.42 ? 'Weather satellites. Only one tenth of the way!' : 'Slow motion. Ride the light!');
        if (u >= 1) { flash(500); go('descend'); }
      },
      exit() { rings.visible = false; S.camFree = false; act(null); clockEl.hidden = true; }
    };
    /* 3. On the Moon. The beam has spread to about 2 km wide; only a sliver of it meets the mirror. */
    const cP = V(-0.49, 0.18, 0.855).normalize(), c3 = m0.clone().multiplyScalar(0.9).addScaledVector(Xr, -0.42).addScaledVector(Yr, 0.1).normalize(), HI = ORG.clone().add(V(-300, 2500, 900));
    const camDist = () => 5.9 * clamp(1.12 / Math.pow(ASP, 0.55), 1, 1.75);
    const viewP = () => [ORG.clone().addScaledVector(cP, camDist()), ORG.clone().add(V(0.55, 0.5, 0))];             /* side-on: the bounce is seen like a diagram */
    const view3 = () => [ORG.clone().addScaledVector(c3, camDist() * 0.95), ORG.clone().add(V(0.15, 0.15, 0))];      /* looking into the finished corner */
    const hingeW = V(), cornerW = V();
    function tipOf(kind, a, out) {                   /* where the free edge of a hinged mirror would be at angle a (in the stand's own axes, then in the world) */
      if (kind === 'A') out.set(0, L * Math.cos(a), L * Math.sin(a));
      else if (kind === 'B') { const b = Math.PI / 4 + a; out.set(0, L * Math.cos(b), L * Math.sin(b)); }
      else { const h = Math.PI - a, b = Math.PI / 4 + S.phi, y = L / 2, z = -L * Math.sin(h); out.set(L / 2 + L * Math.cos(h), y * Math.cos(b) - z * Math.sin(b), y * Math.sin(b) + z * Math.cos(b)); }
      return rig.localToWorld(out);
    }
    function turn(kind, a, dt) {                     /* drag a mirror as if you had hold of its edge; arrow keys push it the same way */
      tipOf(kind, a, t1).project(cam); tipOf(kind, a + DEG, t2).project(cam);
      const tx = (t2.x - t1.x) * R.width / 2, ty = -(t2.y - t1.y) * R.height / 2, m2 = tx * tx + ty * ty, m = Math.sqrt(m2) || 1;       /* pixels the edge moves per degree */
      const d = m2 > 0.02 ? clamp((S.ddx * tx + S.ddy * ty) / Math.max(m2, 4.8), -14, 14) : S.ddx * 0.22;       /* never more than about half a degree per pixel, so it does not run away when the edge points at the camera */
      const ux = tx / m, uy = -ty / m, kd = clamp((Math.abs(ux) > 0.25 ? (keys.right - keys.left) * Math.sign(ux) : 0) + (Math.abs(uy) > 0.25 ? (keys.up - keys.down) * Math.sign(uy) : 0), -1, 1);
      return a + (d + kd * 38 * dt) * DEG;
    }
    stages.descend = {
      enter() { showOnly(gM); lights('moon'); camUp.set(0, 1, 0); S.camFree = true; clockEl.hidden = true; act('Skip', () => go('m1')); tip('The beam spread out. It is 2 km wide now.'); line('wide'); Sfx.whoosh();
        Object.assign(S, { n: 1, w: -24 * DEG, phi: 125 * DEG, gam: 162 * DEG, rho: 0, popB: 0, popC: 0, spinA: 0, spinB: 0, rigScale: 1, trayPop: 0, trayMode: false, ampEl: 0, ampAz: 0, ampElGoal: 0, ampAzGoal: 0, wt: 0, homeT: 0 });
        tweens.length = 0; rig.visible = true; aimL.set(0, L / 2, 0); },
      update() {
        const u = easeOut(S.t / 3.6), v = viewP(); cam.position.lerpVectors(HI, v[0], u); look.lerpVectors(ORG, v[1], u); cam.fov = lerp(58, 48, u); spot.material.opacity = lerp(0.42, 0.08, u);
        if (S.t < 2.5) lab('spot', 'About 2 km wide', ORG, 'big');
        if (S.t >= 3.6) go('m1');
      },
      exit() { S.camFree = false; const v = viewP(); camSet(v[0], v[1], 48); spot.material.opacity = 0.08; act(null); }
    };
    /* One flat mirror: you can aim it at Earth … */
    stages.m1 = {
      enter() { stepNow('one'); scopeBox.hidden = false; padEl.hidden = false; S.homeT = 0; S.hit = false; hint('Drag the mirror, or use the arrow keys.'); tip('Turn the mirror. Send the light home to Earth.'); hint('Drag the mirror, or use the arrow keys.'); line('m1'); },
      update(dt) {
        const v = viewP(); camTo(v[0], v[1], 48); S.w = clamp(turn('A', S.w, dt), -40 * DEG, 32 * DEG); S.homeT = T.home ? S.homeT + dt : 0; if (!drag) lab('grab', '', tipOf('A', S.w, t1), 'grab');
        if (S.homeT > 0.45) { stepDone('one'); answer(true); go('m1w'); }
      }
    };
    /* … but the Moon wobbles, Earth slides around in its sky, and a flat mirror sends the light the wrong way. */
    stages.m1w = {
      enter() { S.ampElGoal = 5.5 * DEG; S.shook = false; tip('Uh-oh. The Moon wobbles, and the light slips off.'); line('wobble'); },
      update(dt) {
        S.w = clamp(turn('A', S.w, dt), -40 * DEG, 32 * DEG); if (!drag) lab('grab', '', tipOf('A', S.w, t1), 'grab'); if (S.t > 1.6 && !S.shook) { S.shook = true; G.react('no'); }
        if (S.t > 4.2 && !S.act) act('Add a mirror', () => go('m2'));
      }
    };
    /* Two mirrors on a hinge: at exactly 90° the light goes back the way it came, however Earth bobs up and down. */
    stages.m2 = {
      enter() { act(null); stepNow('two'); S.n = 2; S.phi = 125 * DEG; S.popB = 0; S.lockT = 0; S.phiLock = false; tween('w', 45 * DEG, 0.8); tween('popB', 1, 0.6, outBack, 0.5); Sfx.tick();
        tip('Swing the new mirror. Find the angle where the light sticks to Earth.'); line('m2'); },
      update(dt) {
        const v = viewP(); camTo(v[0], v[1], 48); rig.localToWorld(hingeW.set(-L / 2 - 0.12, 0, 0));
        if (S.phiLock) { lab('ang', '90°: a square corner!', hingeW, 'ang ok'); if (S.t > S.lockAt + 1.4) go('m2w'); return; }
        if (S.popB > 0.9) S.phi = clamp(turn('B', S.phi, dt), 52 * DEG, 132 * DEG);
        const off = Math.abs(S.phi - 90 * DEG); S.lockT = off < 1.6 * DEG ? S.lockT + dt : 0; lab('ang', Math.round(S.phi / DEG) + '°', hingeW, 'ang'); if (!drag && S.popB > 0.9) lab('grab', '', tipOf('B', S.phi, t1), 'grab');
        if (S.popB > 0.9 && (S.lockT > 0.3 || (S.released && off < 3.5 * DEG))) { S.phiLock = true; S.lockAt = S.t; tween('phi', 90 * DEG, 0.3, outBack); Sfx.lock(); stepDone('two'); answer(true); tip('A square corner! Now the light follows Earth.'); }
      }
    };
    /* … but only up and down. When Earth slides sideways the light slips again. */
    stages.m2w = {
      enter() { S.said2 = false; },
      update() {
        rig.localToWorld(hingeW.set(-L / 2 - 0.12, 0, 0)); lab('ang', '90°', hingeW, 'ang ok');
        if (S.t > 2.2 && !S.said2) { S.said2 = true; S.ampAzGoal = 6.5 * DEG; tip('But when Earth slides sideways, the light slips again.'); line('side'); G.react('no'); }
        if (S.t > 6 && !S.act) act('Add a mirror', () => go('m3'));
      }
    };
    /* Three mirrors, all at 90°: a corner. Now the light comes home whichever way Earth moves. */
    stages.m3 = {
      enter() { act(null); stepNow('three'); S.n = 3; S.gam = 162 * DEG; S.popC = 0; S.lockT = 0; S.gamLock = false; tween('rho', 35.264 * DEG, 1.3); tween('popC', 1, 0.6, outBack, 0.9); Sfx.tick();
        tip('Fold the last mirror up to close the corner.'); line('m3'); },
      update(dt) {
        const v = view3(); camTo(v[0], v[1], 48, 1.6); rig.localToWorld(cornerW.set(L / 2 + 0.1, -0.1, 0));
        if (S.gamLock) { lab('ang', 'Three square corners!', cornerW, 'ang ok'); if (S.t > S.lockAt + 1.3) go('m3w'); return; }
        if (S.popC > 0.9) S.gam = clamp(turn('C', S.gam, dt), 58 * DEG, 170 * DEG);
        const off = Math.abs(S.gam - 90 * DEG); S.lockT = off < 2 * DEG ? S.lockT + dt : 0; lab('ang', Math.round(S.gam / DEG) + '°', cornerW, 'ang'); if (!drag && S.popC > 0.9) lab('grab', '', tipOf('C', S.gam, t1), 'grab');
        if (S.popC > 0.9 && (S.lockT > 0.3 || (S.released && off < 4 * DEG))) { S.gamLock = true; S.lockAt = S.t; tween('gam', 90 * DEG, 0.3, outBack); Sfx.lock(); Sfx.win(); stepDone('three'); answer(true); tip('Three mirrors in a corner. The light always comes home!'); line('corner'); }
      }
    };
    /* Proof by play: spin the finished corner any way you like. It still sends the light home. */
    stages.m3w = {
      enter() { hint('Drag to spin the corner. It still sends the light home.'); },
      update(dt) {
        const v = view3(); camTo(v[0], v[1], 48, 1.6);
        S.spinA += S.ddx * 0.2 * DEG + (keys.right - keys.left) * 30 * DEG * dt; S.spinB += S.ddy * 0.2 * DEG + (keys.down - keys.up) * 30 * DEG * dt;
        const m = Math.hypot(S.spinA, S.spinB), lim = 12 * DEG; if (m > lim) { S.spinA *= lim / m; S.spinB *= lim / m; }
        if (S.t > 1.2) tip('Spin the corner. It never misses!');
        if (S.t > 3 && !S.act) act('Next', () => go('reveal'));
      }
    };
    /* The real thing: Apollo 15's panel is 300 little corners like this one. */
    stages.reveal = {
      enter() { act(null); padEl.hidden = true; S.carded = false; tip('Apollo 15 left 300 of these corners on the Moon.'); line('array'); tween('spinA', 0, 0.5); tween('spinB', 0, 0.5); tween('rigScale', 0.1, 1.3, ease, 0.4); tween('trayPop', 1, 0.8, outBack, 0.5);
        S.ampElGoal = 3 * DEG; S.ampAzGoal = 3.5 * DEG; Sfx.whoosh(); },
      update() {
        const v = view3(); camTo(v[0].addScaledVector(c3, 1.7), v[1], 48, 1.4);
        if (S.t > 1.75 && !S.trayMode) { S.trayMode = true; rig.visible = false; Sfx.lock(); }
        if (S.t > 4.6 && !S.carded) { S.carded = true; card(B.cards[1], () => { flash(500); go('back'); }); }
      }
    };
    /* 4. The echo flies home: another 1.3 seconds, 2.56 in all. */
    stages.back = {
      enter() { showOnly(gS); lights('space'); wide(DM / 2, DM / 2 + 5, true); S.px = X1; S.trailA = X1; S.trailB = undefined; moonS.position.x = DM; S.hit = false; pulse.visible = pulseCore.visible = false; padEl.hidden = true; tip('Here comes the echo.'); hint(''); line('echo'); clock2(T1.toFixed(2) + ' s', 'on the way home'); },
      update() {
        wide(DM / 2, DM / 2 + 5); const tt = S.t - 1, f = c01(tt / T1); S.px = lerp(X1, X0, f); pulse.visible = pulseCore.visible = tt > 0; clock2((T1 + f * T1).toFixed(2) + ' s', f >= 1 ? 'there and back' : 'and counting…', f >= 1);
        if (tt >= T1 && !S.hit) { S.hit = true; Sfx.ping(); flash(260); tip('Caught it! 2.56 seconds, there and back.'); }
        if (tt > T1 + 1.9) go('far');
      }
    };
    /* 5. The puzzle scientists solve: put the Moon where the echo takes exactly that long. */
    const ECHO = 2 * MOON_KM / CKM;
    stages.far = {
      enter() { showOnly(gS); lights('space'); stepNow('far'); S.hit = false; S.km = MOON_KM; S.farDone = false; S.lockT = 0; S.t0 = clock; S.carded = false; tween('km', 250000, 0.9, ease, 0.2); padEl.hidden = false; tip('Slide the Moon until the echo takes 2.56 seconds.'); hint('Drag the Moon nearer or farther, or use the arrow keys.'); line('slide'); },
      update(dt) {
        wide(39, 44);
        if (!S.farDone && S.t > 1.2) {
          t1.set(S.km / KM, 0, 0).project(cam); t2.set(S.km / KM + 1, 0, 0).project(cam);
          const tx = (t2.x - t1.x) * R.width / 2, ty = -(t2.y - t1.y) * R.height / 2, m2 = tx * tx + ty * ty || 1, m = Math.sqrt(m2), ux = tx / m, uy = -ty / m;
          const kd = clamp((Math.abs(ux) > 0.25 ? (keys.right - keys.left) * Math.sign(ux) : 0) + (Math.abs(uy) > 0.25 ? (keys.up - keys.down) * Math.sign(uy) : 0), -1, 1);
          S.km = clamp(S.km + ((S.ddx * tx + S.ddy * ty) / m2 + kd * 11 * dt) * KM, 200000, 480000);
          const off = Math.abs(2 * S.km / CKM - ECHO); S.lockT = off < 0.035 ? S.lockT + dt : 0;
          if (S.lockT > 0.35 || (S.released && off < 0.08)) { S.farDone = true; S.lockAt = S.t; tween('km', MOON_KM, 0.35, outBack); Sfx.lock(); Sfx.win(); stepDone('far'); answer(true); tip('The Moon is 384,400 km away.'); line('measure'); }
        }
        moonS.position.x = S.km / KM; const echo = 2 * S.km / CKM, xb = moonS.position.x - MR, ph = ((clock - S.t0) % echo) / echo;
        S.px = ph < 0.5 ? lerp(X0, xb, ph * 2) : lerp(xb, X0, ph * 2 - 1); pulse.visible = pulseCore.visible = true; S.trailA = X0; S.trailB = xb;       /* the light keeps bouncing there and back: a longer trip means a longer echo */
        clock2('Echo: ' + echo.toFixed(2) + ' s', S.farDone ? 'The Moon is ' + km(MOON_KM) + ' away' : 'Real echo: ' + ECHO.toFixed(2) + ' s', S.farDone);
        lab('dist', km(Math.round(S.km / 100) * 100), moonS.position, 'under'); lab('m', 'Moon', moonS.position, S.farDone ? 'pin' : 'handle');
        if (S.farDone && S.t > S.lockAt + 2 && !S.carded) { S.carded = true; card(B.cards[2], () => quiz(0, 0)); }
      }
    };

    /* ---------- what moves every frame in each place ---------- */
    function updateA(dt) {
      tube.lookAt(aimP); tubeIn.position.z = S.kick || 0;
      const want = Math.atan2(aimP.z - obs.position.z, -(aimP.x - obs.position.x)); let dA = want - domeG.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); domeG.rotation.y += dA * Math.min(1, dt * 3);   /* the dome turns a beat behind the telescope: overlapping action */
      tube.updateMatrixWorld(true); tubeIn.localToWorld(muzzle.set(0, 0, 1.5));
      beamA.put(muzzle, aimP, S.boost ? 0.1 : 0.022, S.boost ? 0.012 : 0.0035, S.boost ? 1.3 : 0.55);
      mark.scale.setScalar(S.name === 'fire' ? 1 + Math.sin(c01(S.t / 0.7) * Math.PI) * 1.4 : 1 + Math.sin(clock * 5) * 0.14);
      lamp.visible = (clock % 1.4) < 0.3;
      if (S.dust >= 0) { const k = S.dust / 0.9; dustS.visible = dustR.visible = true; dustS.scale.setScalar(8 + k * 10); dustS.material.opacity = 1 - k; dustR.scale.setScalar(1.5 + easeOut(k) * 10); dustR.material.opacity = 0.95 * (1 - k); } else dustS.visible = dustR.visible = false;
      if (!reticle.hidden) { lp.copy(aimP).project(cam); reticle.style.transform = 'translate(' + ((lp.x + 1) / 2 * R.width + R.left).toFixed(1) + 'px,' + ((1 - lp.y) / 2 * R.height + R.top).toFixed(1) + 'px)'; reticle.classList.toggle('lock', !!S.locked); }
      if (S.name === 'zoom') { mark.getWorldPosition(markW); lab('mk', 'The mirror', markW, S.locked ? 'ok' : ''); }
    }
    function updateS(dt) {
      earthS.rotation.y += dt * 0.02; sat.rotation.y += dt * 0.3;
      pulse.position.set(S.px, 0, 0); pulseCore.position.copy(pulse.position); pulse.scale.setScalar((S.hit && S.name !== 'far' ? 0.03 : 0.055) * (1 + Math.sin(clock * 30) * 0.12));
      const pa = trail.geometry.attributes.position; pa.setXYZ(0, S.trailA, 0, 0); pa.setXYZ(1, S.trailB === undefined ? S.px : S.trailB, 0, 0); pa.needsUpdate = true;
      if (S.name !== 'ride') { lab('e', 'Earth', earthS.position, 'pin'); if (S.name !== 'far') lab('m', 'Moon', moonS.position, 'pin'); }
    }
    const mE = m0.clone(), aimL = V(0, L / 2, 0), Qw = V(), dIn = V(), toE = V(), endP = V(), farP = V(), camRt = V(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
    const Q2 = V(-0.30, 0.318, 0.955), Q3 = V(0.15, -0.318, 0.742), RING = 2 * Math.PI * 46;       /* where the light is aimed inside the two-mirror and three-mirror corners */
    const fx = [bIn, bOut, bFar, landS, splash, earthHit].concat(bSeg, hitS, beads), NEAR = 110;
    function poseRig() {
      rig.quaternion.copy(rigBase); rig.rotateY(S.rho);
      if (S.spinA || S.spinB) { camRt.set(1, 0, 0).applyQuaternion(cam.quaternion); qA.setFromAxisAngle(UP, S.spinA); qB.setFromAxisAngle(camRt, S.spinB); rig.quaternion.premultiply(qB).premultiply(qA); }
      pivA.rotation.x = S.w; pivB.rotation.x = Math.PI / 4 + S.phi; pivC.rotation.y = Math.PI - S.gam;
      pB.visible = hingeB.visible = S.n >= 2; pC.visible = hingeC.visible = S.n >= 3; pB.scale.setScalar(Math.max(0.001, S.popB)); pC.scale.setScalar(Math.max(0.001, S.popC));     /* new mirrors pop in with a little overshoot: squash and stretch */
      rig.scale.setScalar(S.rigScale); rig.position.lerpVectors(trayCell, ORG, c01((S.rigScale - 0.1) / 0.9)); rig.updateMatrixWorld(true);
    }
    function envUpdate() {                           /* refresh what the mirrors reflect: the sky, the ground and Earth */
      const rv = rig.visible, fv = fx.map(o => o.visible); rig.visible = false; fx.forEach(o => { o.visible = false; }); stars.forEach(p => { p.visible = false; }); spot.visible = false;
      renderer.autoClear = true; cubeCam.update(renderer, scene); renderer.autoClear = false;
      rig.visible = rv; fx.forEach((o, i) => { o.visible = fv[i]; }); stars.forEach(p => { p.visible = true; }); spot.visible = true;
    }
    function updateM(dt) {
      /* the Moon wobbles, so from the mirror's point of view Earth slides around in the sky */
      S.ampEl += (S.ampElGoal - S.ampEl) * Math.min(1, dt * 1.4); S.ampAz += (S.ampAzGoal - S.ampAz) * Math.min(1, dt * 1.4); if (S.ampEl + S.ampAz > 0.002) S.wt += dt;
      mE.copy(m0).addScaledVector(Xr, S.ampAz * Math.sin(S.wt * 1.12 + 0.6)).addScaledVector(Yr, S.ampEl * Math.sin(S.wt * 1.5)).normalize();
      earthM.position.copy(ORG).addScaledVector(mE, ED); earthM.rotation.y += dt * 0.03; earthM.visible = S.name !== 'descend';      /* Earth is so far away it only makes sense seen from the ground */
      poseRig();
      tray.scale.setScalar(Math.max(0.001, S.trayPop)); tray.visible = S.trayPop > 0.01;
      if (S.trayMode) { T.n = 1; T.pts[1].copy(ORG).addScaledVector(m0, 0.03); Qw.copy(T.pts[1]); dIn.copy(Qw).sub(earthM.position).normalize(); T.dir.copy(dIn).negate(); }
      else {
        if (S.n === 1) aimL.set(0, L / 2 * Math.cos(S.w), L / 2 * Math.sin(S.w)); else aimL.lerp(S.n === 2 ? Q2 : Q3, Math.min(1, dt * 4));
        rig.localToWorld(Qw.copy(aimL)); dIn.copy(Qw).sub(earthM.position).normalize(); trace(earthM.position, dIn);
      }
      farP.copy(Qw).addScaledVector(dIn, -260);
      if (T.n === 0) {                               /* the light missed every mirror and lands in the dust */
        endP.copy(Qw).addScaledVector(dIn, (0.03 - Qw.y) / dIn.y); T.err = 9; T.home = false;
        bIn.put(farP, endP, 0.03, 0, 1); bSeg.forEach(b => { b.visible = false; }); bOut.visible = bFar.visible = false; splash.visible = true; splash.position.copy(endP); landS.visible = earthHit.visible = false;
      } else {
        const last = T.pts[T.n]; bIn.put(farP, T.pts[1], 0.03, 0, 1);
        bSeg.forEach((b, i) => { if (i < T.n - 1) b.put(T.pts[i + 1], T.pts[i + 2], 0.03 * S.rigScale + 0.004, 0, 1); else b.visible = false; });
        toE.copy(earthM.position).sub(last); const dE = toE.length(); toE.divideScalar(dE); T.err = T.dir.angleTo(toE); T.home = T.err < HOME;
        let ground = false;
        if (T.home) endP.copy(last).addScaledVector(T.dir, dE - ER * 0.96);
        else if (T.dir.y < -0.015) { endP.copy(last).addScaledVector(T.dir, (0.03 - last.y) / T.dir.y); ground = true; }
        else endP.copy(last).addScaledVector(T.dir, ED);
        const oLen = last.distanceTo(endP);
        if (oLen <= NEAR) { bOut.put(last, endP, 0.03, 0.006, 1); bFar.visible = false; }
        else { t1.copy(last).addScaledVector(T.dir, NEAR); bOut.put(last, t1, 0.03, 0.006, 1); bFar.put(t1, endP, 0.03 + 0.006 * NEAR, 0.006, 1); }
        splash.visible = ground; if (ground) { splash.position.copy(endP); splash.scale.setScalar(1.1 + Math.sin(clock * 20) * 0.15); }
        landS.visible = !T.home && !ground; if (landS.visible) landS.position.copy(endP);
        earthHit.visible = T.home; if (T.home) earthHit.position.copy(endP);
      }
      path.length = 0; path.push(beadA.copy(T.n ? T.pts[1] : endP).addScaledVector(dIn, -22)); for (let i = 1; i <= T.n; i++) path.push(T.pts[i]);
      path.push(T.n ? beadB.copy(T.pts[T.n]).addScaledVector(T.dir, Math.min(24, T.pts[T.n].distanceTo(endP))) : endP);
      let total = 0; for (let i = 0; i < path.length - 1; i++) { lens[i] = path[i].distanceTo(path[i + 1]); total += lens[i]; }
      beads.forEach((b, i) => { let d = (clock * 15 + i * total / beads.length) % total, k = 0; while (k < path.length - 2 && d > lens[k]) { d -= lens[k]; k++; } b.visible = true; b.position.lerpVectors(path[k], path[k + 1], lens[k] ? Math.min(1, d / lens[k]) : 0); b.scale.setScalar(0.17 * (0.3 + 0.7 * S.rigScale)); });
      if (/^m[123]/.test(S.name) && T.n > 1) for (let i = 0; i < T.n; i++) lab('b' + i, String(i + 1), T.pts[i + 1], 'num');
      hitS.forEach((s, i) => { const on = i < T.n && !S.trayMode; s.visible = on; if (on) { s.position.copy(T.pts[i + 1]); s.scale.setScalar((0.28 + Math.sin(clock * 24 + i * 2) * 0.05) * (0.25 + 0.75 * S.rigScale)); } });
      haloM.material.color.setHex(T.home ? 0x63f08a : 0x6fb4ff); haloM.material.opacity = T.home ? 0.55 + 0.2 * Math.sin(clock * 9) : 0.28;
      if (T.home !== S.wasHome) { S.wasHome = T.home; if (T.home && !S.paused) Sfx.tick(); }
      const close = T.n ? 1 - c01(T.err / (40 * DEG)) : 0; ringEl.style.strokeDashoffset = (RING * (1 - (T.home ? 1 : close * 0.92))).toFixed(1);
      scopeBox.classList.toggle('home', T.home); homeEl.textContent = T.home ? 'Home!' : 'Earth';
      e1.setFromMatrixColumn(scopeCam.matrixWorld, 0); e2.setFromMatrixColumn(scopeCam.matrixWorld, 1); const sx = T.dir.dot(e1), sy = T.dir.dot(e2), off = Math.atan2(Math.hypot(sx, sy), T.dir.dot(m0));
      pipEl.hidden = !(T.n && !T.home && off > 12 * DEG); if (!pipEl.hidden) pipEl.style.transform = 'rotate(' + Math.atan2(sx, sy).toFixed(3) + 'rad)';       /* outside the scope: an arrow on the rim shows which way the light went */
      if (frameN % 12 === 0) envUpdate();
    }
    const HELPED = { aim: 1, zoom: 1, m1: 1, m2: 1, m3: 1, m3w: 1, far: 1 };      /* the steps where the child has to do something, so Hy can step in */
    function tick(dt) {
      clock += dt; frameN++;
      if (!S.paused) { S.t += dt; const st = stages[S.name]; if (st && st.update) st.update(dt); }
      Help.part(S.paused ? (S.quizAt >= 0 ? 'q2:quiz' : null) : HELPED[S.name] ? 'q2:' + S.name : null, dt, S.paused ? S.quizAt : null);
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i]; if (w.delay > 0) { w.delay -= dt; if (w.delay > 0) continue; w.from = S[w.key]; }
        w.t += dt; S[w.key] = lerp(w.from, w.to, w.fn(w.t / w.dur)); if (w.t >= w.dur) { S[w.key] = w.to; tweens.splice(i, 1); }
      }
      if (gA.visible) updateA(dt); if (gS.visible) updateS(dt); if (gM.visible) updateM(dt);
      if (!S.camFree) { const k = 1 - Math.exp(-dt * goal.speed); cam.position.lerp(goal.pos, k); look.lerp(goal.look, k); cam.fov += (goal.fov - cam.fov) * k; }     /* the camera eases toward where it is going: slow in, slow out */
      cam.up.copy(camUp); cam.lookAt(look); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      skyG.position.copy(cam.position); stars.forEach((p, n) => { p.material.opacity = 0.6 + 0.4 * Math.sin(clock * (0.8 + n * 0.55) + n * 2); });
      for (const k in labs) if (labs[k]._t !== labTick) labs[k].hidden = true; labTick++;
      S.ddx = S.ddy = 0; S.released = false;
    }

    /* ---------- input: pointer, keys, on-screen pad ---------- */
    stage.addEventListener('pointerdown', e => {
      if (!active || S.paused) return; drag = { x: e.clientX, y: e.clientY, moved: 0 }; try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      const st = stages[S.name]; if (st && st.move) st.move(e.clientX, e.clientY); e.preventDefault();
    });
    stage.addEventListener('pointermove', e => {
      if (!active || S.paused) return;
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); S.ddx += dx; S.ddy += dy; }
      const st = stages[S.name]; if (st && st.move) st.move(e.clientX, e.clientY);
    });
    stage.addEventListener('pointerup', e => { if (!drag) return; const d = drag; drag = null; if (!active || S.paused) return; S.released = true; const st = stages[S.name]; if (d.moved < 8 && st && st.tap) st.tap(e.clientX, e.clientY); });
    stage.addEventListener('pointercancel', () => { drag = null; });
    stage.addEventListener('contextmenu', e => e.preventDefault());
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
    addEventListener('keydown', e => {
      if (!active || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = 1; e.preventDefault(); return; }
      if (e.code !== 'Space' || e.target.tagName === 'BUTTON') return;          /* Space on a focused button already presses it */
      e.preventDefault(); if (S.paused) return;
      if (S.act) S.act(); else { const st = stages[S.name]; if (st && st.space) st.space(); }
    });
    addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = 0; });
    $$('button', padEl).forEach(b => {
      const k = b.dataset.k, on = v => e => { e.preventDefault(); keys[k] = v; b.classList.toggle('on', !!v); };
      b.addEventListener('pointerdown', on(1)); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, on(0)));
    });
    actBtn.addEventListener('click', () => { actBtn.blur(); if (active && !S.paused && S.act) S.act(); });

    /* ---------- starting, leaving and finishing ---------- */
    const soundBtn = el('button', { class: 'btn ghost', id: 'beam-sound', text: 'Sound: on', onclick: () => { const v = !Music.isOn(); Music.set(v); Sfx.set(v); soundBtn.textContent = 'Sound: ' + (v ? 'on' : 'off'); } });
    box.append(soundBtn);
    function reset() {
      Object.assign(S, { name: '', t: 0, paused: false, act: null, camFree: false, ddx: 0, ddy: 0, released: false, onMoon: false, locked: false, shot: -1, dust: -1, kick: 0, boost: 0, said: {}, px: X0, trailA: X0, trailB: undefined, km: MOON_KM,
        n: 1, w: -24 * DEG, phi: 125 * DEG, gam: 162 * DEG, rho: 0, popB: 0, popC: 0, spinA: 0, spinB: 0, rigScale: 1, trayPop: 0, trayMode: false, ampEl: 0, ampAz: 0, ampElGoal: 0, ampAzGoal: 0, wt: 0, homeT: 0, wasHome: false });
      tweens.length = 0; for (const k in keys) keys[k] = 0; drag = null; foundEl.hidden = true; clockEl.hidden = true; reticle.hidden = true; scopeBox.hidden = true; padEl.hidden = true; actBtn.hidden = true; rig.visible = true; moonS.position.x = DM; buildList();
    }
    function start() {
      reset(); active = true; finished = false; box.hidden = false; document.body.classList.add('questing'); if (Missions.stopAll) Missions.stopAll();
      soundBtn.textContent = 'Sound: ' + (Music.isOn() ? 'on' : 'off'); Sfx.set(Music.isOn()); Music.scene('m-hour-q2'); Help.fresh('q2:'); go('aim');
    }
    function stop() { Music.scene(null); Sfx.set(true); active = false; box.hidden = true; document.body.classList.remove('questing'); for (const k in keys) keys[k] = 0; }
    function leave(to) { stop(); setTimeout(() => { const t = $(to); if (t) t.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 80); }
    function finish() { finished = true; Notebook.badge('laser'); const b = $('#quest2'); if (b) b.textContent = 'Play Quest 2 again'; leave('#mars'); }
    $('#beam-exit').addEventListener('click', () => leave('#mirrors'));
    box.append(skipBtn('Skip quest', () => { Notebook.skip('#mirrors'); leave('#mars'); }, 'btn ghost skipq'));
    const startBtn = $('#quest2'); if (startBtn) startBtn.addEventListener('click', start);
    let lastNow = performance.now();
    views.push({ el: stage, scene, cam, quest: true, update(dt, a, rect) {
      const now = performance.now(), real = Math.min(0.25, (now - lastNow) / 1000); lastNow = now; if (!active) return; R = rect; ASP = a;
      tick(/^(launch|back|far)$/.test(S.name) ? real : dt);          /* the true-speed shots keep real time even on a slow device */
    } });
    views.push({ el: portEl, scene, cam: scopeCam, quest: true, update() {} });
    LBF.beam = { start, stop, go, S, T, tick, isDone: () => finished, at(p) { if (p === 'tip') tipOf(S.n === 1 ? 'A' : S.n === 2 ? 'B' : 'C', S.n === 1 ? S.w : S.n === 2 ? S.phi : S.gam, lp); else lp.copy(p === 'mark' ? markW : p === 'moon' ? MOON_A : p === 'moonS' ? moonS.position : ORG); lp.project(cam); return [(lp.x + 1) / 2 * R.width + R.left, (1 - lp.y) / 2 * R.height + R.top]; } };
  })(); } catch (err) { console.warn('Quest 2 is unavailable:', err); }
  /* ══ Quest 2 end ══ */

  /* ══ Quest 3 begin ══ */
  try { (function () {
    /* Quest 3: bring Mars home. The child is three real robots in turn. As Perseverance they drive to a rock, drill a core
       and seal it in a tube, then try the trip to Earth that nobody has flown yet. As Curiosity they dodge sharp rocks,
       grind a rock to powder, test it in the rover's own lab and radio the answer home. As Ingenuity they spin up in thin
       air, fly, take three photos and pass them along the chain of radios to Earth.
       Three places share one scene: the ground of Mars (gT), Mars seen from space (gS) and the big dish on Earth (gE). */
    const box = $('#rove'), stage = $('#rove-stage'), D = LBF.ROVE; if (!box || !stage || !D) return;
    const tipEl = $('#rove-tip'), actBtn = $('#rove-act'), clockEl = $('#rove-clock'), flashEl = $('#rove-flash'), foundEl = $('#rove-found'), labelsEl = $('#rove-labels'), listEl = $('#rove-list'), subEl = $('#rove-sub'),
      keysEl = $('#rove-keys'), padEl = $('#rove .pad'), tagEl = $('#rove-tag'), metersEl = $('#rove-meters'), m1El = $('#rove-m1'), m2El = $('#rove-m2'), finderEl = $('#rove-finder'), portEl = $('#rove-port'),
      photosEl = $('#rove-photos'), chainEl = $('#rove-chain'), loadEl = $('#rove-load'), teaseEl = $('#st-rover');
    const DEG = Math.PI / 180, V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0), AXX = V(1, 0, 0), AXZ = V(0, 0, 1);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), c01 = t => clamp(t, 0, 1), lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => { t = c01(t); return t * t * (3 - 2 * t); }, easeOut = t => 1 - Math.pow(1 - c01(t), 3), easeIn = t => Math.pow(c01(t), 2.2);   /* slow in and slow out */
    const outBack = t => { t = c01(t); return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); };                               /* overshoot, then settle: follow-through */
    const sstep = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
    const lin = hex => new THREE.Color(hex).convertSRGBToLinear();                 /* colours are written as they should look on screen */
    const M = (color, o) => { o = Object.assign({ roughness: 0.8, metalness: 0.05 }, o || {}); o.color = lin(color); if (o.emissive !== undefined) o.emissive = lin(o.emissive); return new THREE.MeshStandardMaterial(o); };
    const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };
    const canvas2 = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const ACC = 0x58d7e6, qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), t1 = V(), t2 = V(), t3 = V(), t4 = V(), lp = V();
    const small = Math.min(innerWidth, innerHeight) < 700;

    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.1, 4500), viewCam = new THREE.PerspectiveCamera(56, 4 / 3, 0.1, 1500), teaseCam = new THREE.PerspectiveCamera(32, 1, 0.3, 4500);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6), sun = new THREE.DirectionalLight(0xffffff, 1.1), SUN = V(0.52, 0.66, 0.38).normalize(), focus = V();
    sun.castShadow = true; sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035;
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 220 }); sun.shadow.camera.updateProjectionMatrix();
    scene.add(hemi, sun, sun.target);
    const fog = new THREE.Fog(0xffffff, 60, 560);

    /* ---------- the sky: one dome whose colours change with the place, and stars for space and for night on Earth ---------- */
    const skyG = new THREE.Group(); scene.add(skyG);
    const domeU = { cTop: { value: new THREE.Color() }, cHor: { value: new THREE.Color() }, cLow: { value: new THREE.Color() }, sunDir: { value: SUN.clone() }, sunAmt: { value: 1 } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3200, 40, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: domeU,
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 cTop; uniform vec3 cHor; uniform vec3 cLow; uniform vec3 sunDir; uniform float sunAmt; varying vec3 d; void main(){ vec3 n = normalize(d); float h = n.y;' +
        ' vec3 c = mix(cHor, cTop, smoothstep(0.0, 0.62, h)); c = mix(cLow, c, smoothstep(-0.2, 0.01, h)); float s = max(dot(n, sunDir), 0.0);' +
        ' c += sunAmt * (vec3(1.0, 0.97, 0.9) * smoothstep(0.99975, 0.99992, s) + vec3(0.62, 0.7, 0.78) * pow(s, 60.0) * 0.38 + vec3(0.3, 0.26, 0.2) * pow(s, 6.0) * 0.22); gl_FragColor = vec4(c, 1.0); }'
    })); dome.renderOrder = -10; dome.frustumCulled = false; skyG.add(dome);
    const glowTex = (() => { const c = canvas2(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.8)'); gr.addColorStop(0.55, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const glow = (color, size, atten) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: !!atten, fog: false })); s.scale.setScalar(size); return s; };
    const starsG = new THREE.Group(); skyG.add(starsG);
    [[900, 2.2, 0xffffff], [320, 3.6, 0xcfe0ff], [90, 6, 0xfff0d0]].forEach(([N, size, color], n) => {
      const a = new Float32Array(N * 3); let sd = 41 + n * 97; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < N; i++) { const u = rnd() * 2 - 1, t = rnd() * 6.2832, q = Math.sqrt(1 - u * u); a[i * 3] = q * Math.cos(t) * 3000; a[i * 3 + 1] = u * 3000; a[i * 3 + 2] = q * Math.sin(t) * 3000; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: glowTex, sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })); pts.frustumCulled = false; pts.renderOrder = -9; starsG.add(pts);
    });

    /* ---------- the ground of Mars: one square of hills, re-shaped for each landing site ---------- */
    const gT = new THREE.Group(), gS = new THREE.Group(), gE = new THREE.Group(); scene.add(gT, gS, gE);
    const TS = 300, TN = 200, EDGE = -2.5;
    const hash = (i, j, s) => { let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
    const vnoise = (x, z, s) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), u), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), u), v); };
    const fbm = (x, z, s) => vnoise(x, z, s) * 0.53 + vnoise(x * 2.1 + 9, z * 2.1 + 4, s + 7) * 0.27 + vnoise(x * 4.3 + 2, z * 4.3 + 7, s + 13) * 0.13 + vnoise(x * 8.9, z * 8.9, s + 29) * 0.07;
    /* Each site: where the rover starts (x, z, heading), the rock to drill, and the colours of the ground. Jezero is an old river delta; Gale has Mount Sharp. */
    const SITES = {
      jezero: { seed: 11, c1: 0xb97a4f, c2: 0x8f5b3d, c3: 0xd6a273, start: [-6, -34, 0.3], rock: [9, 12], haze: 0xd9b489, chute: [-52, 34], heli: [15, 6] },
      gale: { seed: 37, c1: 0xad6c4c, c2: 0x7c5140, c3: 0xcb946a, start: [-22, -36, 0.55], rock: [13, 18], haze: 0xd4ab82, sharp: [-5, -9, 15] }
    };
    let site = null, pads = [], bigRocks = [], sharpRocks = [];
    const hRaw = (x, z) => (fbm(x / 70, z / 70, site.seed) - 0.5) * 11 + (fbm(x / 17, z / 17, site.seed + 3) - 0.5) * 1.5 + (vnoise(x / 3.3, z / 3.3, site.seed + 5) - 0.5) * 0.14;
    function hAt(x, z) {
      let h = hRaw(x, z); for (const p of pads) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r1) h = lerp(h, p.h, sstep(p.r1, p.r0, d)); }
      const e = Math.max(Math.abs(x), Math.abs(z)); return e > TS / 2 - 40 ? lerp(h, EDGE, sstep(TS / 2 - 40, TS / 2 - 6, e)) : h;
    }
    const grain = (() => {                           /* sand and pebbles, drawn once and tiled */
      const c = canvas2(512, 512), g = c.getContext('2d'); g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, 512, 512); let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const dot = (x, y, r, col) => { for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { if (x + ox < -r || x + ox > 512 + r || y + oy < -r || y + oy > 512 + r) continue; g.fillStyle = col; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 6.2832); g.fill(); } };
      for (let i = 0; i < 5200; i++) { const v = 150 + Math.floor(rnd() * 95); dot(rnd() * 512, rnd() * 512, 0.6 + rnd() * rnd() * 3.2, 'rgba(' + v + ',' + v + ',' + v + ',' + (0.25 + rnd() * 0.5).toFixed(2) + ')'); }
      for (let i = 0; i < 260; i++) { const x = rnd() * 512, y = rnd() * 512, r = 2.5 + rnd() * 5; dot(x + r * 0.35, y + r * 0.35, r, 'rgba(70,70,70,.5)'); const v = 186 + Math.floor(rnd() * 52); dot(x, y, r, 'rgb(' + v + ',' + (v - 5) + ',' + (v - 12) + ')'); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(52, 52); t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
    })();
    const tGeo = new THREE.PlaneGeometry(TS, TS, TN, TN); tGeo.rotateX(-Math.PI / 2);
    const tPos = tGeo.attributes.position, tCol = new THREE.BufferAttribute(new Float32Array(tPos.count * 3), 3); tGeo.setAttribute('color', tCol);
    const ground = mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, bumpMap: grain, bumpScale: 0.03, roughness: 1, metalness: 0 })); ground.receiveShadow = true; gT.add(ground);
    const skirt = mesh(new THREE.RingGeometry(TS / 2 - 8, 3000, 48, 1), M(0xb97a4f, { roughness: 1 }), 0, EDGE - 0.15, 0); skirt.rotation.x = -Math.PI / 2; gT.add(skirt);
    const rockGeo = (() => {                         /* one lumpy boulder shape, stamped many times */
      const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, v = V();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.72 + 0.5 * vnoise(v.x * 1.7 + 5, v.y * 1.7 + v.z * 1.3 + 9, 3); p.setXYZ(i, v.x * k, v.y * k * 0.72, v.z * k); }
      g.computeVertexNormals(); return g;
    })();
    const NR = 240, NP = 520, rockM = M(0xffffff, { roughness: 1, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeo, rockM, NR), pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), rockM, NP);
    rocks.castShadow = rocks.receiveShadow = true; pebbles.receiveShadow = true; rocks.frustumCulled = pebbles.frustumCulled = false; gT.add(rocks, pebbles);
    const sharpG = new THREE.Group(), mtG = new THREE.Group(); gT.add(sharpG, mtG);
    const sharpGeo = (() => { const g = new THREE.ConeGeometry(0.34, 0.62, 5, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) + 0.12); g.computeVertexNormals(); return g; })();   /* wind-carved rocks with a point, like shark teeth */
    const sharpM = M(0x4a3c38, { roughness: 0.85, flatShading: true });
    function buildSite(key) {
      if (site === SITES[key]) return; site = SITES[key]; const st = site, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), col = new THREE.Color();
      pads = [{ x: st.start[0], z: st.start[1], r0: 5, r1: 11 }, { x: st.rock[0], z: st.rock[1], r0: 6, r1: 12 }]; if (st.chute) pads.push({ x: st.chute[0], z: st.chute[1], r0: 8, r1: 15 }, { x: st.heli[0], z: st.heli[1], r0: 3, r1: 7 });
      pads.forEach(p => { p.h = hRaw(p.x, p.z); });
      const c1 = lin(st.c1), c2 = lin(st.c2), c3 = lin(st.c3);
      for (let i = 0; i < tPos.count; i++) {
        const x = tPos.getX(i), z = tPos.getZ(i), y = hAt(x, z); tPos.setY(i, y);
        const a = sstep(0.36, 0.64, fbm(x / 12, z / 12, st.seed + 50)), b = sstep(0.55, 0.8, fbm(x / 31 + 3, z / 31, st.seed + 60)), k = 0.86 + 0.28 * vnoise(x / 2.1, z / 2.1, st.seed + 70);
        col.copy(c1).lerp(c2, a).lerp(c3, b * 0.75).multiplyScalar(k); tCol.setXYZ(i, col.r, col.g, col.b);
      }
      tPos.needsUpdate = true; tCol.needsUpdate = true; tGeo.computeVertexNormals(); tGeo.computeBoundingSphere();
      skirt.material.color.copy(c1).lerp(c2, 0.4);
      let sd = st.seed * 7 + 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; bigRocks = []; sharpRocks = [];
      const clear = (x, z, r) => pads.every(p => Math.hypot(x - p.x, z - p.z) > p.r0 + r + 1.5) && (!st.sharp || Math.hypot(x - st.sharp[0], z - st.sharp[1]) > st.sharp[2] + r);
      for (let i = 0; i < NR; i++) {
        let x, z, s, n = 0; do { const a = rnd() * 6.2832, r = 6 + Math.sqrt(rnd()) * 118; x = Math.cos(a) * r; z = Math.sin(a) * r; s = 0.16 + rnd() * rnd() * rnd() * 2.3; } while (!clear(x, z, s) && ++n < 30);
        if (n >= 30) s = 0.001;
        q.setFromEuler(new THREE.Euler(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5)); sc.set(s * (0.8 + rnd() * 0.6), s * (0.6 + rnd() * 0.5), s * (0.8 + rnd() * 0.6));
        m4.compose(t1.set(x, hAt(x, z) + s * 0.12, z), q, sc); rocks.setMatrixAt(i, m4);
        col.copy(c2).lerp(c1, rnd()).multiplyScalar(0.55 + rnd() * 0.5); rocks.setColorAt(i, col); if (s > 0.62) bigRocks.push({ x, z, r: s * 0.95 });
      }
      for (let i = 0; i < NP; i++) {
        const a = rnd() * 6.2832, r = 2 + Math.sqrt(rnd()) * 90, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.03 + rnd() * rnd() * 0.13;
        q.setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)); m4.compose(t1.set(x, hAt(x, z) + s * 0.3, z), q, sc.set(s, s * 0.7, s)); pebbles.setMatrixAt(i, m4);
        col.copy(c2).lerp(c3, rnd()).multiplyScalar(0.6 + rnd() * 0.5); pebbles.setColorAt(i, col);
      }
      rocks.instanceMatrix.needsUpdate = pebbles.instanceMatrix.needsUpdate = true; rocks.instanceColor.needsUpdate = pebbles.instanceColor.needsUpdate = true;
      sharpG.clear();
      if (st.sharp) for (let i = 0; i < 26; i++) {
        const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * st.sharp[2], x = st.sharp[0] + Math.cos(a) * r, z = st.sharp[1] + Math.sin(a) * r, s = 0.8 + rnd() * 0.9;
        const m = mesh(sharpGeo, sharpM, x, hAt(x, z) + 0.2 * s, z); m.scale.setScalar(s); m.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5); m.castShadow = true; sharpG.add(m); sharpRocks.push({ x, z, r: 0.36 * s, m, hit: 0 });
      }
      mtG.clear(); const hz = new THREE.Color(st.haze), dk = new THREE.Color(0x7a5238), hill = new THREE.SphereGeometry(1, 10, 6), mesa = new THREE.CylinderGeometry(0.82, 1, 1, 9);
      const far = (geo, x, y, z, sx, sy, sz, t) => { const m = mesh(geo, new THREE.MeshBasicMaterial({ color: hz.clone().lerp(dk, t).convertSRGBToLinear(), fog: false }), x, y, z); m.scale.set(sx, sy, sz); mtG.add(m); return m; };
      for (let i = 0; i < 26; i++) { const a = i / 26 * 6.2832 + rnd() * 0.2, r = 900 + rnd() * 500, w = 220 + rnd() * 330; far(hill, Math.cos(a) * r, -30, Math.sin(a) * r, w, 70 + rnd() * 110, w * 0.7, 0.16 + rnd() * 0.12); }   /* the crater rim, pale with distance */
      if (key === 'jezero') for (let i = 0; i < 7; i++) { const a = 2.2 + i * 0.2 + rnd() * 0.08, r = 520 + rnd() * 160, w = 60 + rnd() * 70; far(mesa, Math.cos(a) * r, 8, Math.sin(a) * r, w, 46 + rnd() * 26, w * 0.8, 0.34 + rnd() * 0.1); }   /* the cliffs of the old river delta */
      else { const a = 1.05; [[520, 150, 0.2], [330, 250, 0.26], [170, 340, 0.3]].forEach(([w, h, t]) => far(hill, Math.cos(a) * 1150, -30, Math.sin(a) * 1150, w, h, w * 0.8, t)); }   /* Mount Sharp, 5 km tall, in the middle of Gale Crater */
    }

    /* ---------- NASA's own models, fetched when a chapter needs them ---------- */
    const glb = {}, got = {}, gltf = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
    function loadModel(name) {
      if (!glb[name]) glb[name] = new Promise((res, rej) => {
        if (!gltf) return rej(new Error('no loader'));
        gltf.load('assets/' + name + '.glb', g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); got[name] = g.scene; res(g.scene); }, undefined, rej);
      });
      return glb[name];
    }
    /* How each rover moves. Joint angles are in degrees from the pose the model was saved in; they were solved so the drill
       lands straight down on a rock 30 cm tall at `reach` (metres to the side and ahead of the rover's middle). */
    const ROVERS = {
      percy: { r: 0.2625, wheels: ['wheel_FL', 'wheel_ML', 'wheel_RL', 'wheel_FR', 'wheel_MR', 'wheel_RR'], steerOn: null, steer: [1, 0, -1, 1, 0, -1],
        arm: [['arm003', 'y'], ['arm002', 'z'], ['arm', 'z'], ['arm004', 'z'], ['turret_obj', 'y']], reach: [0.30, 2.15], pan: ['top', -123],
        poses: { stow: [0, 0, 0, 0, 0], ready: [-90, -16.2, -72, 88.2, -81], hover: [-89.44, 32.713, 111.394, -54.105, 90], touch: [-89.44, 23.145, 110.343, -43.487, 90] } },
      curio: { r: 0.243, wheels: ['wheel_01_L', 'wheel_02_L', 'wheel_03_L', 'wheel_01_R', 'wheel_02_R', 'wheel_03_R'], steerOn: ['Cube_01_p', null, 'suspension_steer_B_L', 'Cube_02_p', null, 'suspension_steer_B_R'], steer: [1, 0, -1, 1, 0, -1],
        arm: [['arm_01001', 'y'], ['arm_02001', 'x'], ['arm_03001', 'x'], ['arm_04001', 'x'], ['arm_05_head001', 'y']], reach: [0.45, 2.2], pan: ['mast_02001', 0], view: -Math.PI / 2,   /* its cutaway is seen from the front, so the two posts beside the bit do not hide it */
        poses: { stow: [-90, -15, -70, 85, -32], ready: [0, 0, 0, 0, 0], hover: [0.896, -49.641, -138.235, -82.123, 0], touch: [0.896, -31.723, -143.854, -94.423, 0], lab: [48.453, -122.184, 32.525, -180.341, -90] } }
    };
    const steel = M(0xc9ccd2, { metalness: 0.75, roughness: 0.35 }), darkSteel = M(0x4a4d55, { metalness: 0.7, roughness: 0.45 });
    function makeRig(key, root) {
      const def = ROVERS[key], g = new THREE.Group(), N = n => root.getObjectByName(n); g.add(root);
      const rig = { key, def, g, root, x: 0, z: 0, yaw: 0, pitch: 0, roll: 0, spin: 0, steer: 0, pan: 0, arm: def.poses.stow.slice(), bit: 0, bitSpin: 0 };
      rig.wheels = def.wheels.map(n => { const o = N(n); return { o, q0: o.quaternion.clone() }; });
      rig.steerers = (def.steerOn || def.wheels).map((n, i) => { if (!n || !def.steer[i]) return null; const o = N(n); return { o, q0: o.quaternion.clone(), k: def.steer[i] }; });
      rig.joints = def.arm.map(([n, ax]) => { const o = N(n); return { o, q0: o.quaternion.clone(), ax: ax === 'x' ? AXX : ax === 'y' ? UP : AXZ }; });
      if (key === 'percy') {                         /* raise the mast, and put a hollow coring bit in the drill */
        const mast = N('Cylinder'); mast.quaternion.multiply(qa.setFromAxisAngle(UP, 90 * DEG));
        const chuck = N('corring_drill'); root.updateMatrixWorld(true); const ws = chuck.getWorldScale(V()).x || 1;
        rig.bitG = new THREE.Group(); rig.bitG.scale.setScalar(1 / ws); chuck.add(rig.bitG);
        const tube = mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.06, 20, 1, true), M(0xd4d7dc, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), 0, 0, 0.04); tube.rotation.x = Math.PI / 2; tube.castShadow = true;
        const collar = mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.03, 20), darkSteel, 0, 0, 0.022); collar.rotation.x = Math.PI / 2; rig.bitG.add(tube, collar); rig.bitP = rig.bitG.position.clone();
      } else {                                       /* Curiosity's drill bit is its own part of the model: it slides and spins */
        rig.bitG = N('bit_01001'); rig.bitP = rig.bitG.position.clone(); rig.bitQ = rig.bitG.quaternion.clone();
        rig.covers = ['cover_01', 'cover_02', 'cover_03'].map((n, i) => { const o = N(n); return { o, q0: o.quaternion.clone(), ax: i < 2 ? AXZ : AXX, a: i === 1 ? -90 : 90 }; });
      }
      const pn = N(def.pan[0]); rig.panJ = { o: pn, q0: pn.quaternion.clone().multiply(qa.setFromAxisAngle(UP, def.pan[1] * DEG)) };
      rig.open = 1;                                  /* the lids over the lab's funnels (Curiosity only) */
      rig.pose = function () {
        this.wheels.forEach((w, i) => { const st = this.steerers[i]; w.o.quaternion.copy(w.q0); if (st && st.o === w.o) w.o.quaternion.multiply(qb.setFromAxisAngle(UP, this.steer * st.k)); w.o.quaternion.multiply(qa.setFromAxisAngle(AXX, this.spin)); });
        this.steerers.forEach((st, i) => { if (st && st.o !== this.wheels[i].o) st.o.quaternion.copy(st.q0).multiply(qb.setFromAxisAngle(UP, this.steer * st.k)); });
        this.joints.forEach((j, i) => { j.o.quaternion.copy(j.q0).multiply(qa.setFromAxisAngle(j.ax, this.arm[i] * DEG)); });
        this.panJ.o.quaternion.copy(this.panJ.q0).multiply(qa.setFromAxisAngle(UP, this.pan));
        if (this.key === 'percy') { this.bitG.position.set(this.bitP.x, this.bitP.y, this.bitP.z); this.bitG.rotation.z = this.bitSpin; }
        else { this.bitG.position.set(this.bitP.x, this.bitP.y, this.bitP.z + Math.min(this.bit, 0.045)); this.bitG.quaternion.copy(this.bitQ).multiply(qa.setFromAxisAngle(AXZ, this.bitSpin)); this.covers.forEach(c => c.o.quaternion.copy(c.q0).multiply(qa.setFromAxisAngle(c.ax, c.a * (1 - this.open) * DEG))); }
        this.g.position.set(this.x, this.y, this.z); this.g.rotation.set(-this.pitch, this.yaw, this.roll, 'YXZ');
      };
      /* stand on the ground at (x, z): the nose rises and the body leans with the slope under the wheels */
      rig.sit = function (dt) {
        const s = Math.sin(this.yaw), c = Math.cos(this.yaw), hF = hAt(this.x + s * 1.1, this.z + c * 1.1), hB = hAt(this.x - s * 1.1, this.z - c * 1.1), hL = hAt(this.x + c * 1.1, this.z - s * 1.1), hR = hAt(this.x - c * 1.1, this.z + s * 1.1);
        const k = dt === undefined ? 1 : 1 - Math.exp(-dt * 7), y = (hF + hB + hL + hR) / 4;
        this.y = this.y === undefined || k === 1 ? y : this.y + (y - this.y) * k; this.pitch += (Math.atan2(hF - hB, 2.2) - this.pitch) * k; this.roll += (Math.atan2(hL - hR, 2.2) - this.roll) * k;
      };
      rig.at = function (x, y, z, out) { return (out || V()).set(x, y, z).applyEuler(this.g.rotation).add(this.g.position); };   /* a point given in the rover's own frame, in the world */
      gT.add(g); return rig;
    }
    const rigs = {}; let rover = null;
    function useRover(key) { for (const k in rigs) rigs[k].g.visible = k === key; rover = rigs[key] || null; return rover; }
    function getRig(key) { return loadModel(key).then(root => rigs[key] || (rigs[key] = makeRig(key, root))); }

    /* ---------- wheel tracks: two ribbons laid on the ground behind the rover ---------- */
    const TRK = 900, trkTex = { plain: null, jpl: null };
    ['plain', 'jpl'].forEach(k => {
      const c = canvas2(64, 256), g = c.getContext('2d'); g.clearRect(0, 0, 64, 256); g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 5; g.lineJoin = 'round';
      for (let y = 6; y < 256; y += 16) { g.beginPath(); g.moveTo(6, y + 6); g.lineTo(22, y); g.lineTo(42, y + 6); g.lineTo(58, y); g.stroke(); }      /* the zigzag grip of the wheel */
      if (k === 'jpl') { g.fillStyle = 'rgba(0,0,0,1)'; let y = 14; '.--- .--. .-..'.split('').forEach(ch => { if (ch === ' ') { y += 10; return; } const w = ch === '.' ? 9 : 22; g.clearRect(8, y - 2, 48, 13); g.fillRect(32 - w / 2, y, w, 9); y += 15; }); }   /* dots and dashes: J, P, L */
      const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; trkTex[k] = t;
    });
    const trkMat = new THREE.MeshBasicMaterial({ map: trkTex.plain, color: lin(0x3a2418), transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const trk = [0, 1].map(() => {
      const g = new THREE.BufferGeometry(), idx = []; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRK * 6), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(TRK * 4), 2));
      for (let i = 0; i < TRK - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); g.setIndex(idx); g.setDrawRange(0, 0);
      const m = new THREE.Mesh(g, trkMat); m.frustumCulled = false; m.renderOrder = 2; gT.add(m); return g;
    });
    const trkS = { n: 0, x: 0, z: 0, d: 0 };
    function trackReset(kind) { trkS.n = 0; trkS.d = 0; trkMat.map = trkTex[kind || 'plain']; trk.forEach(g => g.setDrawRange(0, 0)); }
    function trackAdd(x, z, yaw, force) {
      if (trkS.n && !force && Math.hypot(x - trkS.x, z - trkS.z) < 0.3) return;
      if (trkS.n) trkS.d += Math.hypot(x - trkS.x, z - trkS.z); trkS.x = x; trkS.z = z;
      if (trkS.n >= TRK) { trk.forEach(g => { g.attributes.position.array.copyWithin(0, TRK * 3); g.attributes.uv.array.copyWithin(0, TRK * 2); }); trkS.n = TRK / 2; }
      const c = Math.cos(yaw), s = Math.sin(yaw), n = trkS.n;
      trk.forEach((g, side) => {
        const cx = x + c * (side ? -1.1 : 1.1), cz = z - s * (side ? -1.1 : 1.1), P = g.attributes.position, U = g.attributes.uv;
        for (let e = 0; e < 2; e++) { const px = cx + c * (e ? 0.2 : -0.2), pz = cz - s * (e ? 0.2 : -0.2); P.setXYZ(n * 2 + e, px, hAt(px, pz) + 0.03, pz); U.setXY(n * 2 + e, e, trkS.d / 1.55); }
        P.needsUpdate = true; U.needsUpdate = true; g.setDrawRange(0, Math.max(0, n) * 6);
      });
      trkS.n++;
    }

    /* ---------- a beam of light that marks where to go ---------- */
    const beacon = new THREE.Group(); gT.add(beacon);
    (function () {
      const col = new THREE.MeshBasicMaterial({ color: lin(0x19c3dc), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const beam = mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 20, 1, true), col, 0, 30, 0); beacon.add(beam);
      beacon.ring = mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0, 0.08, 0); beacon.ring.rotation.x = -Math.PI / 2; beacon.add(beacon.ring);
      beacon.visible = false;
    })();
    function beaconAt(x, z, r, flat) { beacon.visible = true; beacon.position.set(x, hAt(x, z), z); beacon.userData.r = r || 2.4; beacon.children[0].visible = !flat; }

    /* ---------- dust: kicked up by wheels, and blown out by the helicopter's rotors ---------- */
    const dustS = Array.from({ length: 40 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lin(0xd2a47c), transparent: true, opacity: 0, depthWrite: false })); s.visible = false; gT.add(s); return { s, life: 0, max: 1, vx: 0, vy: 0, vz: 0 }; });
    let dustI = 0;
    function dust(x, y, z, spread, up) { const d = dustS[dustI++ % dustS.length]; d.life = d.max = 0.8 + Math.random() * 0.8; d.s.position.set(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread); d.vx = (Math.random() - 0.5) * spread; d.vz = (Math.random() - 0.5) * spread; d.vy = up * (0.4 + Math.random() * 0.6); d.s.visible = true; }
    function dustTick(dt) { for (const d of dustS) { if (d.life <= 0) continue; d.life -= dt; if (d.life <= 0) { d.s.visible = false; continue; } const f = d.life / d.max; d.s.position.x += d.vx * dt; d.s.position.y += d.vy * dt; d.s.position.z += d.vz * dt; d.s.scale.setScalar(0.5 + (1 - f) * 1.7); d.s.material.opacity = 0.3 * f * Math.min(1, (1 - f) * 6); } }

    /* ---------- state, HUD and small helpers ---------- */
    const S = {}, keys = { left: 0, right: 0, up: 0, down: 0 }, tweens = [], stages = {}, rows = {}, labs = {};
    let active = false, clock = 0, R = { left: 0, top: 0, width: 1, height: 1 }, ASP = 1.6, labTick = 0, drag = null, finished = false, held = 0, tapped = 0;
    const goal = { pos: V(), look: V(), fov: 50, speed: 3 }, look = V(), camUp = V(0, 1, 0);
    function camTo(pos, at, fov, speed) { goal.pos.copy(pos); goal.look.copy(at); if (fov) goal.fov = fov; goal.speed = speed || 3; }
    function camSet(pos, at, fov) { camTo(pos, at, fov); cam.position.copy(pos); look.copy(at); cam.fov = goal.fov; }
    /* ease a number (or a list of numbers, such as the arm's joint angles) on any object toward a new value */
    function anim(obj, key, to, dur, fn, delay) { tweens.push({ obj, key, from: null, to, t: 0, dur, fn: fn || ease, delay: delay || 0 }); }
    const tween = (key, to, dur, fn, delay) => anim(S, key, to, dur, fn, delay);
    const tip = t => { if (tipEl.textContent !== t) tipEl.textContent = t; };
    const hint = t => { keysEl.textContent = t; };
    const line = k => { if (D.say[k]) say(D.say[k], true); };
    const once = k => { if (S.said[k]) return false; S.said[k] = 1; line(k); return true; };
    function act(label, fn, mode) {                  /* the big button: a tap, or (mode 'hold') something to keep pressed */
      actBtn.classList.remove('hold', 'on', 'tapbeat'); held = 0;
      if (!label) { actBtn.hidden = true; S.act = null; S.actMode = ''; return; }
      actBtn.textContent = label; actBtn.hidden = false; S.act = fn || null; S.actMode = mode || ''; if (mode) actBtn.classList.add(mode);
    }
    function flash(ms, op) { flashEl.style.transition = 'none'; flashEl.style.opacity = op || 0.85; void flashEl.offsetWidth; flashEl.style.transition = 'opacity ' + ms + 'ms ease-out'; flashEl.style.opacity = 0; }
    function clock2(big, smallText, ok) { clockEl.hidden = false; clockEl.firstElementChild.textContent = big; clockEl.lastElementChild.textContent = smallText; clockEl.classList.toggle('ok', !!ok); }
    function lab(id, text, p, cls) {                 /* a word that floats next to a thing in the 3D scene */
      let s = labs[id]; if (!s) { s = labs[id] = el('span', { class: 'lab3d' }); labelsEl.append(s); }
      if (s.textContent !== text) s.textContent = text; s.className = 'lab3d ' + (cls || ''); s._t = labTick;
      lp.copy(p).project(cam); const ok = lp.z < 1 && Math.abs(lp.x) < 1.02 && Math.abs(lp.y) < 1.02; s.hidden = !ok;
      if (ok) s.style.transform = 'translate(' + ((lp.x + 1) / 2 * R.width + R.left).toFixed(1) + 'px,' + ((1 - lp.y) / 2 * R.height + R.top).toFixed(1) + 'px)';
    }
    /* a meter: a needle on a track (with a green zone), or a bar that fills */
    function meter(elm, label, value, text, zone, mark) {
      elm.hidden = false; elm.querySelector('.mlab').textContent = label; elm.querySelector('.mval').textContent = text;
      const nd = elm.querySelector('.mneedle'), fl = elm.querySelector('.mfill'), zn = elm.querySelector('.mzone'), mk = elm.querySelector('.mmark');
      if (zone) { zn.hidden = false; zn.style.left = zone[0] * 100 + '%'; zn.style.width = (zone[1] - zone[0]) * 100 + '%'; nd.hidden = false; nd.style.left = c01(value) * 100 + '%'; if (fl) fl.style.width = '0'; }
      else { if (zn) zn.hidden = true; if (nd) nd.hidden = true; fl.style.width = c01(value) * 100 + '%'; }
      if (mk) { mk.hidden = mark === undefined; if (mark !== undefined) mk.style.left = mark * 100 + '%'; }
    }
    const svg = d => '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const ICON = {
      p: svg('<path d="M4 13h13l2-3h-6V7"/><path d="M13 7h3"/><circle cx="6" cy="17" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M4 13v2M20 13v2"/><rect x="8.2" y="3" width="2.6" height="6.5" rx="1.3"/>'),
      c: svg('<path d="M4 13h13l2-3h-6V7"/><path d="M13 7h3"/><circle cx="6" cy="17" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M4 13v2M20 13v2"/><path d="M8 3h3M8.7 3v2.6L7 9.5h5l-1.7-3.9V3"/>'),
      i: svg('<path d="M2 6h9M13 6h9M5 9h6M13 9h6"/><path d="M12 4v7"/><rect x="9.5" y="11" width="5" height="4.5" rx="1"/><path d="M10 15.5l-3 5M14 15.5l3 5M6 20.5h2M16 20.5h2"/>'),
      shadow: svg('<ellipse cx="12" cy="17" rx="8" ry="2.6" fill="currentColor" stroke="none" opacity=".75"/><path d="M5 7h14M12 5v4"/><rect x="10" y="9" width="4" height="3" rx=".8"/>'),
      chute: svg('<path d="M3 11a9 9 0 0118 0c-1.6-1.4-2.9-1.4-4.5 0-1.6-1.4-2.9-1.4-4.5 0-1.6-1.4-2.9-1.4-4.5 0-1.6-1.4-2.9-1.4-4.5 0z"/><path d="M3 11l9 10 9-10M7.5 11L12 21l4.5-10"/>'),
      rover: svg('<path d="M4 13h13l2-3h-6V6"/><rect x="11" y="3" width="5" height="3" rx=".8"/><circle cx="6" cy="17" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="18" cy="17" r="2"/>'),
      orbiter: svg('<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 12H2M15 12h7M3 9.5v5M6 9.5v5M18 9.5v5M21 9.5v5"/><path d="M10 9a2.5 2.5 0 014 0"/><path d="M12 6.5V4"/>'),
      earth: svg('<circle cx="12" cy="12" r="9"/><path d="M7 5.5c2 1 2.5 3 1.5 4.500S6 13 7.500 15s3.500 1.500 3.500 4.500"/><path d="M14 3.500c-1 2 0 3.500 2 4s3 2 2.500 4.500"/>')
    };
    const STEPS = [['p', 'Perseverance'], ['c', 'Curiosity'], ['i', 'Ingenuity']];
    function buildList() {
      listEl.replaceChildren();
      STEPS.forEach(([k, label]) => { const ic = el('span', { class: 'icon' }); ic.innerHTML = ICON[k]; const li = el('li', {}, ic, el('span', { text: label }), el('span', { class: 'arrow', text: '' })); rows[k] = li; listEl.append(li); });
    }
    const stepNow = k => { for (const id in rows) rows[id].classList.toggle('now', id === k); };
    const stepDone = k => { rows[k].classList.add('done'); rows[k].classList.remove('now'); const a = rows[k].querySelector('.arrow'); a.textContent = '✓'; a.style.transform = 'none'; };
    function sub(names, n) { subEl.replaceChildren(); names.forEach((t, i) => subEl.append(el('li', { class: i < n ? 'done' : i === n ? 'now' : '', text: t }))); }
    function pointer(k, x, z) {                      /* the little arrow in the list turns toward the target, as seen on screen */
      const a = rows[k].querySelector('.arrow'); if (a.textContent !== '➤') a.textContent = '➤';
      t1.set(x - cam.position.x, 0, z - cam.position.z); t2.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize(); t3.set(1, 0, 0).applyQuaternion(cam.quaternion).setY(0).normalize();
      a.style.transform = 'rotate(' + (Math.atan2(t1.dot(t3), t1.dot(t2)) - Math.PI / 2).toFixed(2) + 'rad)';
    }
    function noPointer(k) { const a = rows[k].querySelector('.arrow'); if (a.textContent === '➤') a.textContent = ''; }
    function card(c, fn) {                           /* a short fact to remember, with the key words highlighted */
      S.paused = true; const p = el('p', { class: 'fact' }); c[1].split('*').forEach((t, n) => p.append(n % 2 ? el('mark', { text: t }) : t));
      foundEl.replaceChildren(el('h3', { text: c[0] }), p, el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: c[2], onclick: () => { foundEl.hidden = true; S.paused = false; fn && fn(); } })));
      foundEl.hidden = false; Sfx.yes();
    }
    function panel(title, kids, btn, fn) {           /* a paper card with anything on it: lab results, or the photos that reached Earth */
      S.paused = true; foundEl.replaceChildren(el('h3', { text: title }), ...kids, el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: btn, onclick: () => { foundEl.hidden = true; S.paused = false; fn && fn(); } })));
      foundEl.hidden = false;
    }
    function quiz(i, misses) {                       /* before the quest ends, Hy checks what stuck */
      S.paused = true; foundEl.hidden = false; S.quizAt = i >= D.quiz.length ? -1 : i;
      if (i >= D.quiz.length) {
        foundEl.replaceChildren(el('h3', { text: 'Quest complete!' }), el('p', { class: 'fact', text: 'You were three robots on Mars.' }), el('div', { class: 'row' }, el('button', { class: 'btn onpaper', text: 'Go to Stop 4', onclick: finish })));
        Sfx.win(); say(misses ? 'Case closed. You earned your badge, partner.' : 'A perfect score. You could run this agency, kid.', true); return;
      }
      const q = D.quiz[i], note = el('p', { text: (i + 1) + ' of ' + D.quiz.length }), list = el('div', { class: 'opts' });
      shuffle(q[1].map((t, n) => ({ t, ok: n === 0 }))).forEach(o => list.append(el('button', { text: o.t, onclick: e => {
        answer(o.ok);
        if (o.ok) { e.currentTarget.classList.add('yes'); $$('button', list).forEach(b => b.disabled = true); note.textContent = 'Yes!'; setTimeout(() => { if (active) quiz(i + 1, misses); }, 1400); }
        else { e.currentTarget.classList.add('no'); e.currentTarget.disabled = true; misses++; note.textContent = 'Try again.'; }
      } })));
      foundEl.replaceChildren(el('h3', { text: q[0] }), note, list);
    }
    function go(name) { const prev = stages[S.name]; if (prev && prev.exit) prev.exit(); S.name = name; S.t = 0; S.ddx = S.ddy = 0; const st = stages[name]; if (st.enter) st.enter(); }
    function hideAll() { beacon.visible = false; padEl.hidden = true; metersEl.hidden = true; finderEl.hidden = true; photosEl.hidden = true; chainEl.hidden = true; tagEl.hidden = true; clockEl.hidden = true; act(null); hint(''); }
    /* where we are: on Mars, in space near Mars, or beside the big dish on Earth. Sky, light and haze change with the place. */
    const PAL = {
      mars: { top: 0x9d7a5b, hor: 0xddb98e, low: 0xc9a074, sun: 1, sky: 0xf2d6b0, gnd: 0x8c5b3c, hI: 0.62, sI: 1.2, sC: 0xfff1de, fog: 1 },
      space: { top: 0x03040a, hor: 0x05060e, low: 0x03040a, sun: 0, sky: 0x8fa0c8, gnd: 0x20222a, hI: 0.3, sI: 1.35, sC: 0xffffff, fog: 0 },
      earth: { top: 0x070b26, hor: 0x41386e, low: 0x10122a, sun: 0, sky: 0x9aa2e0, gnd: 0x2a2c3c, hI: 0.6, sI: 0.55, sC: 0xd4dcff, fog: 0 }
    };
    function place(k) {
      S.place = k; const p = PAL[k]; gT.visible = k === 'mars'; gS.visible = k === 'space'; gE.visible = k === 'earth'; starsG.visible = k !== 'mars';
      domeU.cTop.value.setHex(p.top); domeU.cHor.value.setHex(p.hor); domeU.cLow.value.setHex(p.low); domeU.sunAmt.value = p.sun;
      hemi.color.copy(lin(p.sky)); hemi.groundColor.copy(lin(p.gnd)); hemi.intensity = p.hI; sun.color.copy(lin(p.sC)); sun.intensity = p.sI;
      scene.fog = p.fog ? fog : null; if (p.fog && site) fog.color.copy(lin(site.haze));
      if (site && k === 'mars') { domeU.cHor.value.setHex(site.haze); domeU.cLow.value.setHex(site.haze); }
      camUp.set(0, 1, 0); cam.near = k === 'mars' ? 0.08 : 0.2; cam.far = 4500;
    }

    /* ---------- driving: arrows or W A S D. Up is forward, left and right steer, and the camera stays behind the rover ---------- */
    function drive(dt, top) {
      const r = rover, f = keys.up - keys.down, tr = keys.left - keys.right, want = f > 0 ? top : f < 0 ? -top * 0.5 : 0;
      S.spd += (want - S.spd) * (1 - Math.exp(-dt * (f ? 2.0 : 3.6)));                                   /* slow in, slow out: a one-ton rover does not jump */
      r.yaw += tr * 0.95 * (0.3 + 0.7 * Math.min(1, Math.abs(S.spd) / 1.2)) * dt * (S.spd < -0.1 ? -1 : 1);
      r.steer += (tr * 0.42 - r.steer) * (1 - Math.exp(-dt * 6));
      let nx = r.x + Math.sin(r.yaw) * S.spd * dt, nz = r.z + Math.cos(r.yaw) * S.spd * dt;
      for (const b of bigRocks) { const dx = nx - b.x, dz = nz - b.z, d = Math.hypot(dx, dz) || 1, m = b.r + 1.3; if (d < m) { nx = b.x + dx / d * m; nz = b.z + dz / d * m; S.spd *= 0.92; } }   /* boulders do not move */
      const d0 = Math.hypot(nx, nz); if (d0 > 108) { nx *= 108 / d0; nz *= 108 / d0; }
      r.spin += S.spd * dt / r.def.r; r.x = nx; r.z = nz; r.sit(dt); if (Math.abs(S.spd) > 0.04) trackAdd(r.x, r.z, r.yaw);
      Sfx.loop('motor', Math.abs(S.spd) > 0.1 ? 46 + Math.abs(S.spd) * 9 : 0, 0.022);
      if (Math.abs(S.spd) > 0.8 && Math.random() < dt * 9) { const sd = Math.random() < 0.5 ? 1.1 : -1.1; r.at(sd, 0.12, S.spd > 0 ? -1.3 : 1.3, t1); dust(t1.x, t1.y, t1.z, 0.5, 0.5); }   /* secondary action: a little dust behind the wheels */
    }
    /* the camera follows from behind and above. Dragging looks around; driving swings the view back behind. */
    function chase(dt, x, y, z, yaw, back, up, snap, ahead) {
      S.orbY -= S.ddx * 0.006; S.orbP = clamp(S.orbP + S.ddy * 0.004, -0.2, 0.85);
      if (keys.up || keys.down || keys.left || keys.right) { S.orbY *= Math.exp(-dt * 1.8); S.orbP *= Math.exp(-dt * 1.8); }
      const yw = yaw + S.orbY, port = ASP < 0.9, b = back * (port ? 1.3 : 1), cp = Math.cos(S.orbP);
      t1.set(x - Math.sin(yw) * b * cp, y + up + b * Math.sin(S.orbP), z - Math.cos(yw) * b * cp); t1.y = Math.max(t1.y, hAt(t1.x, t1.z) + 0.6);
      const la = (ahead || 1.6) * Math.max(0, Math.cos(S.orbY)); t2.set(x + Math.sin(yaw) * la, y + up * 0.36, z + Math.cos(yaw) * la);
      (snap ? camSet : camTo)(t1, t2, port ? 64 : 50, 4.2);
    }

    /* ---------- the rock to drill, and a cutaway view of what the drill does inside it ---------- */
    const RK = { H: 0.30, RX: 0.56, RZ: 0.5 }, tgt = new THREE.Group(); gT.add(tgt);
    const rockY = (x, z) => { const rr = Math.hypot(x / RK.RX, z / RK.RZ); return rr >= 1 ? -0.09 : RK.H * (1 - Math.pow(rr, 4)) * (1 + 0.08 * (vnoise(x * 6 + 3, z * 6 + 8, 19) - 0.5) * Math.min(1, rr * 2.4)); };
    function slab(half) {
      const rings = 16, segs = half ? 30 : 60, a0 = half ? Math.PI / 2 : 0, span = half ? Math.PI : Math.PI * 2, pos = [], uv = [], idx = [], g = new THREE.BufferGeometry();
      for (let r = 0; r <= rings; r++) for (let s = 0; s <= segs; s++) { const rr = r / rings * 1.05, a = a0 + span * s / segs, x = Math.cos(a) * rr * RK.RX, z = Math.sin(a) * rr * RK.RZ, y = rockY(x, z); pos.push(x, y, z); uv.push(s / segs * (half ? 2 : 4), y / RK.H); }
      for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    const skinTex = kind => {                        /* the outside of the rock: striped mud rock for Perseverance, dusty red for Curiosity */
      const c = canvas2(256, 128), g = c.getContext('2d'); let sd = kind === 'core' ? 5 : 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      g.fillStyle = kind === 'core' ? '#c39b6e' : '#a96a4c'; g.fillRect(0, 0, 256, 128);
      if (kind === 'core') for (let y = 0; y < 128; y += 5 + rnd() * 9) { g.fillStyle = ['#a67c52', '#8d6642', '#d3ad80', '#b58a5d'][Math.floor(rnd() * 4)]; g.fillRect(0, y, 256, 2 + rnd() * 5); }
      for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '60,40,28' : '235,205,170') + ',' + (0.08 + rnd() * 0.2).toFixed(2) + ')'; g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 0.6 + rnd() * 2.4, 0, 6.3); g.fill(); }
      const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
    };
    const skins = { core: skinTex('core'), powder: skinTex('powder') }, slabM = M(0xffffff, { roughness: 0.95, map: skins.core, side: THREE.DoubleSide });
    const slabFull = mesh(slab(false), slabM), slabHalf = mesh(slab(true), slabM); slabFull.castShadow = slabFull.receiveShadow = slabHalf.castShadow = slabHalf.receiveShadow = true; tgt.add(slabFull, slabHalf);
    const FW = 2048, FH = 1024, CW = 320, CH = 640, faceC = canvas2(FW, FH), colC = canvas2(CW, CH), faceG = faceC.getContext('2d'), colG = colC.getContext('2d');
    const faceT = new THREE.CanvasTexture(faceC), colT = new THREE.CanvasTexture(colC); faceT.encoding = colT.encoding = THREE.sRGBEncoding; faceT.anisotropy = 8;
    const face = mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: faceT, transparent: true, alphaTest: 0.5 }), 0.0008, 0.2, 0); face.rotation.y = Math.PI / 2;
    const col = mesh(new THREE.PlaneGeometry(0.12, 0.24), new THREE.MeshBasicMaterial({ map: colT, transparent: true, depthWrite: false }), 0.0022, RK.H - 0.02, 0); col.rotation.y = Math.PI / 2; col.renderOrder = 3; tgt.add(face, col);
    const fX = z => (0.6 - z) / 1.2 * FW, fY = y => (0.5 - y) / 0.6 * FH, cX = z => (0.06 - z) / 0.12 * CW, cY = y => (RK.H + 0.1 - y) / 0.24 * CH, PXM = CW / 0.12;    /* metres to pixels on the two drawings */
    function paintFace(kind) {
      const g = faceG; g.clearRect(0, 0, FW, FH); let sd = kind === 'core' ? 13 : 23; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const edge = () => { g.beginPath(); g.moveTo(fX(-RK.RZ * 1.04), fY(-0.1)); for (let i = 0; i <= 160; i++) { const z = -RK.RZ * 1.04 + i / 160 * RK.RZ * 2.08; g.lineTo(fX(z), fY(Math.max(rockY(0, z), -0.1))); } g.lineTo(fX(RK.RZ * 1.04), fY(-0.1)); g.closePath(); };
      g.save(); edge(); g.clip();
      const wavy = (y, th, color) => { g.fillStyle = color; g.beginPath(); const ph = rnd() * 9, am = 3 + rnd() * 7; g.moveTo(0, y); for (let x = 0; x <= FW; x += 40) g.lineTo(x, y + Math.sin(x / 190 + ph) * am); for (let x = FW; x >= 0; x -= 40) g.lineTo(x, y + th + Math.sin(x / 170 + ph * 1.3) * am); g.closePath(); g.fill(); };
      if (kind === 'core') {                         /* mud laid down in a lake, layer on layer, with dark specks */
        g.fillStyle = '#b98f63'; g.fillRect(0, 0, FW, FH);
        for (let y = fY(0.33); y < FH; y += 14 + rnd() * 30) wavy(y, 8 + rnd() * 22, ['#a67c52', '#8f6946', '#cfa97c', '#b3875a', '#9b7550', '#c59b6d'][Math.floor(rnd() * 6)]);
        for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(40,28,22,' + (0.35 + rnd() * 0.45).toFixed(2) + ')'; g.beginPath(); g.arc(rnd() * FW, fY(0.33) + rnd() * 700, 1 + rnd() * 2.6, 0, 6.3); g.fill(); }
        for (let i = 0; i < 46; i++) { const x = rnd() * FW, y = fY(0.31) + rnd() * 620, r = 5 + rnd() * 9; g.strokeStyle = 'rgba(48,34,28,.8)'; g.lineWidth = 2.5; g.fillStyle = 'rgba(226,203,170,.85)'; g.beginPath(); g.ellipse(x, y, r * 1.3, r, rnd() * 3, 0, 6.3); g.fill(); g.stroke(); }
      } else {                                       /* grey mud rock with white veins, under a thin red skin */
        g.fillStyle = '#8b9299'; g.fillRect(0, 0, FW, FH);
        for (let y = fY(0.33); y < FH; y += 18 + rnd() * 34) wavy(y, 6 + rnd() * 16, ['#80878e', '#969da4', '#878e96', '#a0a6ab'][Math.floor(rnd() * 4)]);
        g.strokeStyle = 'rgba(236,233,224,.9)'; g.lineCap = 'round';
        for (let i = 0; i < 9; i++) { g.lineWidth = 2 + rnd() * 4; g.beginPath(); let x = rnd() * FW, y = fY(0.3) + rnd() * 500; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 240; y += (rnd() - 0.3) * 90; g.lineTo(x, y); } g.stroke(); }
        for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(60,66,72,' + (0.2 + rnd() * 0.3).toFixed(2) + ')'; g.beginPath(); g.arc(rnd() * FW, fY(0.33) + rnd() * 700, 0.8 + rnd() * 2, 0, 6.3); g.fill(); }
        g.restore(); g.save(); edge(); g.clip(); g.strokeStyle = '#a2573c'; g.lineWidth = 26; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= 160; i++) { const z = -RK.RZ * 1.04 + i / 160 * RK.RZ * 2.08; g.lineTo(fX(z), fY(rockY(0, z))); } g.stroke();
      }
      g.restore(); g.strokeStyle = 'rgba(30,20,14,.55)'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 160; i++) { const z = -RK.RZ * 1.04 + i / 160 * RK.RZ * 2.08; g.lineTo(fX(z), fY(rockY(0, z))); } g.stroke();
      faceT.needsUpdate = true;
    }
    const puffs = [];                                /* crumbs thrown out of the hole, in metres from the top of the hole */
    function puff(n, grey) { for (let i = 0; i < n; i++) puffs.push({ z: (Math.random() - 0.5) * 0.02, y: 0.002, vz: (Math.random() - 0.5) * 0.22, vy: 0.12 + Math.random() * 0.22, life: 0.5 + Math.random() * 0.4, grey }); }
    /* The moving part of the cutaway: the bit inside the rock, the hole it leaves, the core or the powder, and a ruler in centimetres.
       S.depth is how deep the hole is and S.tipD how deep the tip of the bit is right now (both in metres). */
    function paintCol(dt) {
      const g = colG, top = cY(RK.H), mid = cX(0), d = S.depth * PXM, tp = S.tipD * PXM, core = S.kind === 'core', hw = (core ? 0.0135 : 0.008) * PXM;
      g.clearRect(0, 0, CW, CH);
      if (core) {
        const iw = 0.0065 * PXM;
        if (S.snapped) {                             /* the core has broken off and rides up inside the bit; the hole is empty */
          g.fillStyle = '#17110e'; g.fillRect(mid - hw, top, hw * 2, d);
          g.drawImage(faceC, fX(S.axZ + 0.0065), fY(RK.H), 0.013 / 1.2 * FW, S.depth / 0.6 * FH, mid - iw, top + tp - d, iw * 2, d);
        }
        const wall = x => { const gr = g.createLinearGradient(x, 0, x + hw - iw, 0); gr.addColorStop(0, '#9da1a8'); gr.addColorStop(0.5, '#eef0f3'); gr.addColorStop(1, '#8a8e96'); g.fillStyle = gr; g.fillRect(x, top - 60, hw - iw, tp + 60); g.fillStyle = '#5d6168'; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x + k * (hw - iw) / 2, top + tp); g.lineTo(x + (k + 0.5) * (hw - iw) / 2, top + tp + 7); g.lineTo(x + (k + 1) * (hw - iw) / 2, top + tp); g.fill(); } };
        if (tp > -60) { wall(mid - hw); wall(mid + iw); }
      } else {
        g.fillStyle = '#15171a'; g.beginPath(); g.moveTo(mid - hw, top); g.lineTo(mid - hw, top + d); g.lineTo(mid, top + d + (d > 2 ? 12 : 0)); g.lineTo(mid + hw, top + d); g.lineTo(mid + hw, top); g.closePath(); g.fill();
        if (tp > -40) {                              /* the bit: a steel screw. Its grooves carry the powder up and out. */
          const gr = g.createLinearGradient(mid - hw, 0, mid + hw, 0); gr.addColorStop(0, '#70747c'); gr.addColorStop(0.45, '#e9ebef'); gr.addColorStop(1, '#6a6e76'); g.fillStyle = gr;
          g.beginPath(); g.moveTo(mid - hw + 1, top - 40); g.lineTo(mid - hw + 1, top + tp); g.lineTo(mid, top + tp + 12); g.lineTo(mid + hw - 1, top + tp); g.lineTo(mid + hw - 1, top - 40); g.closePath(); g.fill();
          g.save(); g.clip(); g.strokeStyle = 'rgba(40,44,52,.75)'; g.lineWidth = 5; const off = (S.bitTurn * 9) % 26; for (let y = top - 70 + off; y < top + tp + 20; y += 26) { g.beginPath(); g.moveTo(mid - hw, y + 16); g.lineTo(mid + hw, y); g.stroke(); } g.restore();
        }
        const pile = Math.min(1, S.depth / 0.064); g.fillStyle = '#9fa5ab';      /* grey powder heaps up around the hole */
        for (const sgn of [-1, 1]) { g.beginPath(); g.ellipse(mid + sgn * (hw + 34 * pile + 4), top + 1, 40 * pile + 2, 24 * pile + 1, 0, Math.PI, 2 * Math.PI); g.fill(); g.fillStyle = '#b9bec3'; g.beginPath(); g.ellipse(mid + sgn * (hw + 30 * pile + 4), top - 5 * pile, 22 * pile + 1, 12 * pile + 1, 0, Math.PI, 2 * Math.PI); g.fill(); g.fillStyle = '#9fa5ab'; }
      }
      for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.life -= dt; if (p.life <= 0) { puffs.splice(i, 1); continue; } p.vy -= 0.9 * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt); g.fillStyle = p.grey ? 'rgba(170,176,182,' + Math.min(1, p.life * 2).toFixed(2) + ')' : 'rgba(214,176,134,' + Math.min(1, p.life * 2).toFixed(2) + ')'; g.beginPath(); g.arc(cX(p.z), top - p.y * PXM, 3.2, 0, 6.3); g.fill(); }
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 2.5; g.font = '700 22px sans-serif'; g.textBaseline = 'middle'; const rx = cX(-0.036);          /* the ruler */
      g.beginPath(); g.moveTo(rx, top); g.lineTo(rx, top + 0.07 * PXM); for (let c = 0; c <= 7; c++) { const y = top + c * 0.01 * PXM; g.moveTo(rx, y); g.lineTo(rx + (c % 2 ? 9 : 16), y); } g.stroke();
      [2, 4, 6].forEach(c => g.fillText(String(c), rx + 21, top + c * 0.01 * PXM)); g.font = '700 17px sans-serif'; g.fillText('cm', rx + 20, top + 7.3 * 0.01 * PXM + 6);
      colT.needsUpdate = true;
    }
    /* cutaway on: the near half of the rock is taken away so the inside shows. Off: a plain rock again. */
    function cutaway(on) { slabFull.visible = !on; slabHalf.visible = on; face.visible = on; col.visible = on; }
    function setRock(kind, x, z, yaw) {
      S.kind = kind; slabM.map = skins[kind]; slabM.needsUpdate = true; paintFace(kind); tgt.position.set(x, hAt(x, z), z); tgt.rotation.y = yaw; tgt.updateMatrixWorld(true); tgt.visible = true; cutaway(false);
      S.depth = 0; S.tipD = -0.03; S.snapped = false; S.bitTurn = 0; S.axZ = 0; S.axSet = false; col.position.z = 0; puffs.length = 0; paintCol(0);
    }
    /* line the drawing up with the real drill: measure where the bit's axis meets the rock, to the millimetre */
    function alignCol() { if (S.axSet) return; S.axSet = true; rover.g.updateMatrixWorld(true); new THREE.Box3().setFromObject(rover.bitG).getCenter(t1); tgt.worldToLocal(t1); S.axZ = clamp(t1.z, -0.03, 0.03); col.position.z = S.axZ; }
    /* where the rover must stand so that its drill comes down on the middle of the rock */
    function parkSpot(def) { const st = site, yaw = Math.atan2(st.rock[0] - st.start[0], st.rock[1] - st.start[1]), c = Math.cos(yaw), s = Math.sin(yaw), lx = def.reach[0], lz = def.reach[1]; return { yaw, x: st.rock[0] - lx * c - lz * s, z: st.rock[1] + lx * s - lz * c }; }

    /* ---------- a sample tube: white metal, 15 cm long, with a dark seal pressed into one end ---------- */
    const tubeG = new THREE.Group(); gT.add(tubeG); tubeG.visible = false;
    (function () {
      const body = mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.145, 20), M(0xf2f2ee, { metalness: 0.35, roughness: 0.35 })), tipC = mesh(new THREE.SphereGeometry(0.0115, 16, 8, 0, 6.3, 0, Math.PI / 2), M(0xf2f2ee, { metalness: 0.35, roughness: 0.35 }), 0, -0.0725, 0); tipC.rotation.x = Math.PI;
      tubeG.cap = mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.02, 20), M(0x2c2e33, { metalness: 0.7, roughness: 0.4 }), 0, 0.11, 0);
      const band = mesh(new THREE.CylinderGeometry(0.0122, 0.0122, 0.012, 20), M(0xc9a23c, { metalness: 0.8, roughness: 0.3 }), 0, 0.05, 0);
      [body, tipC, tubeG.cap, band].forEach(m => { m.castShadow = true; tubeG.add(m); });
    })();

    /* ════════ place S: Mars seen from space (Mars is 10 units across its radius; distances beyond it are squeezed) ════════ */
    const RMARS = 10, marsS = mesh(new THREE.SphereGeometry(RMARS, 120, 72), globeMat(marsTex)); gS.add(marsS);
    marsS.add(mesh(new THREE.SphereGeometry(RMARS * 1.022, 120, 60), new THREE.MeshBasicMaterial({ color: 0xe6a070, transparent: true, opacity: 0.2, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    const EARTH = V(260, 40, -60), earthS = mesh(new THREE.SphereGeometry(9, 48, 32), globeMat(tex('earth.jpg'))); earthS.position.copy(EARTH); earthS.rotation.y = 2.2; gS.add(earthS);
    earthS.add(mesh(new THREE.SphereGeometry(9.4, 40, 28), new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.3, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    const siteDot = glow(ACC, 1.1, true); siteDot.position.set(0, RMARS + 0.05, 0); gS.add(siteDot);
    function turnMars(id, lat, lon) { const c = byId[id] || { lat, lon }; marsS.quaternion.setFromUnitVectors(ll(c.lat, c.lon, 1).normalize(), UP); }   /* put a landing site at the top of the globe */
    const lineOf = (pts, color, op, dashed) => { const g = new THREE.BufferGeometry().setFromPoints(pts), m = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: op, dashSize: dashed, gapSize: dashed, fog: false }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, fog: false }); const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); l.frustumCulled = false; return l; };
    /* a small spacecraft made of plain shapes: the one that would catch the samples has not been built, so it gets no real model */
    function craftOf(body, panel) {
      const g = new THREE.Group(), pm = M(panel, { metalness: 0.4, roughness: 0.4, emissive: 0x101c4a });
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), M(body, { metalness: 0.7, roughness: 0.35, emissive: 0x3a2a08 })), mesh(new THREE.BoxGeometry(1.1, 0.03, 0.5), pm, 0.85, 0, 0), mesh(new THREE.BoxGeometry(1.1, 0.03, 0.5), pm, -0.85, 0, 0));
      const dish = mesh(new THREE.ConeGeometry(0.28, 0.16, 18, 1, true), M(0xf4f4f4, { side: THREE.DoubleSide, emissive: 0x44444a }), 0, 0.36, 0); g.add(dish); return g;
    }
    const RO = 13.6, GATE = 38 * DEG, TA = 3.0, OMEGA = 26 * DEG, orbP = (th, r, out) => (out || V()).set(Math.sin(th) * r, Math.cos(th) * r, 0);
    const planG = new THREE.Group(), relayG = new THREE.Group(); gS.add(planG, relayG);
    const catcher = craftOf(0xe0b04a, 0x2f56c8), ghost = mesh(new THREE.RingGeometry(0.5, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
    const gate = mesh(new THREE.RingGeometry(0.78, 0.98, 40), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false })); orbP(GATE, RO, gate.position);
    const rocket = new THREE.Group(), flame = glow(0xffb060, 1.4, true);
    (function () {
      const pts = []; for (let i = 0; i <= 96; i++) pts.push(orbP(i / 96 * Math.PI * 2, RO)); planG.add(lineOf(pts, 0xffffff, 0.28));
      rocket.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 12), M(0xf2f2f2, { emissive: 0x555555 })), mesh(new THREE.ConeGeometry(0.11, 0.26, 12), M(0xd84a3a, { emissive: 0x5a1a12 }), 0, 0.44, 0)); flame.position.y = -0.5; rocket.add(flame);
      planG.add(catcher, ghost, gate, rocket);
    })();
    const P0 = V(0, RMARS, 0), PC = V(0.3, RO + 0.4, 0), P1 = orbP(GATE, RO);
    const pathAt = (t, out) => out.set(0, 0, 0).addScaledVector(P0, (1 - t) * (1 - t)).addScaledVector(PC, 2 * (1 - t) * t).addScaledVector(P1, t * t);     /* straight up, then tip over toward the meeting point */
    planG.add(lineOf(Array.from({ length: 41 }, (_, i) => pathAt(i / 40, V())), ACC, 0.7, 0.22));
    /* the relay: Mars Reconnaissance Orbiter passes over the rover, hears it, and passes the message on to Earth */
    const RO2 = RMARS + 2.6, mroG = new THREE.Group(), cone = mesh(new THREE.ConeGeometry(2.0, 2.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), 0, RMARS + 1.3, 0);
    cone.rotation.x = Math.PI; relayG.add(mroG, cone); const mroStand = craftOf(0xd8a040, 0x3a3f8a); mroG.add(mroStand);
    let relayAsked = false; function relayModels() { if (relayAsked) return; relayAsked = true;          /* the orbiter and the dish are fetched when the first radio chapter starts */
    loadModel('mro').then(m => { const b = new THREE.Box3().setFromObject(m), s = b.getSize(V()), k = 2.6 / Math.max(s.x, s.y, s.z), c = b.getCenter(V()); m.position.copy(c).multiplyScalar(-k); m.scale.setScalar(k); const w = new THREE.Group(); w.add(m); w.rotation.set(0.3, 0.8, 1.2); mroG.remove(mroStand); mroG.add(w); }).catch(() => {}); if (S.mountDish) S.mountDish(); }
    const packets = Array.from({ length: 6 }, () => { const s = glow(0x9df0ff, 0.5, true); s.visible = false; gS.add(s); return s; });
    const tripLine = lineOf([V(), V()], 0x9df0ff, 0.5); gS.add(tripLine); tripLine.visible = false;

    /* ════════ place E: a 70-metre dish of the Deep Space Network on Earth, at dusk ════════ */
    const DISH = V(0, 7.6, 0), MARSDOT = V(8, 52, -60), marsDot = glow(0xff9a6a, 5, true); marsDot.position.copy(MARSDOT); gE.add(marsDot);
    (function () {
      const gnd = mesh(new THREE.CircleGeometry(700, 40), M(0x151a2c, { roughness: 1 })); gnd.rotation.x = -Math.PI / 2; gE.add(gnd);
      let sd = 77; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, hill = new THREE.MeshBasicMaterial({ color: 0x0c0b24 });
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832, r = 200 + rnd() * 120, s = 30 + rnd() * 40, h = mesh(new THREE.SphereGeometry(1, 14, 8), hill, Math.cos(a) * r, -4, Math.sin(a) * r); h.scale.set(s * 2.3, s * 0.4, s); gE.add(h); }
      const hut = mesh(new THREE.BoxGeometry(3.2, 1.6, 2.2), M(0xd8dbe4, { roughness: 0.7 }), 8.5, 0.8, 3), win = mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd98a }), 8.5, 0.95, 4.11); gE.add(hut, win);
      const stand = new THREE.Group(); stand.add(mesh(new THREE.CylinderGeometry(1.4, 1.9, 4.2, 16), M(0xe6e8ee), 0, 2.1, 0), mesh(new THREE.SphereGeometry(4.6, 32, 12, 0, 6.3, 0, 0.95), M(0xf4f5f8, { side: THREE.DoubleSide }), 0, 9.6, 0)); stand.children[1].rotation.x = Math.PI; gE.add(stand);
      S.mountDish = () => loadModel('dsn').then(m => { const b = new THREE.Box3().setFromObject(m), k = 9 / (b.max.y - b.min.y); m.scale.setScalar(k); m.position.y = -b.min.y * k; m.traverse(o => { if (o.isMesh) o.castShadow = false; }); gE.remove(stand); gE.add(m); }).catch(() => {});
    })();
    const pulses = Array.from({ length: 4 }, () => { const s = glow(0xffc49a, 1.3, true); s.visible = false; gE.add(s); return s; });

    /* ════════ the story, one stage at a time ════════ */
    const seg = (t, a, b) => c01((t - a) / (b - a));
    function loadThen(names, fn) {                   /* show "waking" while the models arrive, then carry on */
      hideAll(); loadEl.textContent = 'Waking the robot…'; loadEl.hidden = false; S.paused = true;
      Promise.all(names.map(n => ROVERS[n] ? getRig(n) : loadModel(n))).then(() => { loadEl.hidden = true; S.paused = false; if (active) fn(); })
        .catch(() => { loadEl.textContent = 'The robot would not load. Check the internet, then press Leave and try again.'; });
    }
    function startRover(key, kind) {                 /* put a rover at its starting place on its landing site, arm folded, wheels straight */
      const r = useRover(key), st = site.start; r.x = st[0]; r.z = st[1]; r.yaw = st[2]; r.y = undefined; r.pitch = r.roll = 0; r.sit(); r.arm = r.def.poses.stow.slice(); r.steer = 0; r.pan = 0; r.bit = 0; r.open = 1; r.pose();
      S.spd = 0; S.orbY = 0.9; S.orbP = 0.12; S.park = parkSpot(r.def); setRock(kind, site.rock[0], site.rock[1], S.park.yaw + (r.def.view || 0)); trackReset(key === 'curio' ? 'jpl' : 'plain'); trackAdd(r.x, r.z, r.yaw, true);
      heliG.visible = false; chuteG.visible = false; tubeG.visible = false; S.flying = false; return r;
    }
    function headLook(r, x, z, dt) { const want = clamp(wrapPi(Math.atan2(x - r.x, z - r.z) - r.yaw), -1.2, 1.2); r.pan += (want - r.pan) * (1 - Math.exp(-dt * 3)); }   /* the cameras on the mast turn toward what matters */
    function driveTo(dt, k, top) {                   /* shared by both rovers: drive, follow, point the way, and say when the rock is close */
      const r = rover, rx = site.rock[0], rz = site.rock[1]; drive(dt, top); headLook(r, rx, rz, dt); chase(dt, r.x, r.y, r.z, r.yaw, 7.6, 3.2, false);
      beaconAt(rx, rz); pointer(k, rx, rz); lab('rk', 'Drill here', t1.set(rx, tgt.position.y + 1.5, rz), 'ok');
      if (S.t > 9 && trkS.d < 1) tip('Press the arrow keys, or the buttons, to drive.');
      return Math.hypot(r.x - rx, r.z - rz);
    }
    function parkStage(k, next) {                    /* roll up to the rock by itself, then reach out with the arm */
      return {
        enter() { const r = rover; S.px0 = r.x; S.pz0 = r.z; S.yaw0 = r.yaw; S.dyaw = wrapPi(S.park.yaw - r.yaw); S.u = 0; tween('u', 1, 2.2); S.spd = 0; S.armed = false; padEl.hidden = true; beacon.visible = false; noPointer(k); Sfx.loop('motor', 52, 0.02); tip('Parking by the rock.'); hint(''); },
        update(dt) {
          const r = rover, pk = S.park, ox = r.x, oz = r.z;
          if (!S.armed) {
            r.x = lerp(S.px0, pk.x, S.u); r.z = lerp(S.pz0, pk.z, S.u); r.yaw = S.yaw0 + S.dyaw * S.u; r.steer = clamp(S.dyaw * (1 - S.u), -0.45, 0.45); r.spin += Math.hypot(r.x - ox, r.z - oz) / r.def.r; r.sit(dt); trackAdd(r.x, r.z, r.yaw); headLook(r, site.rock[0], site.rock[1], dt);
            chase(dt, r.x, r.y, r.z, r.yaw, 7.6, 3.2, false);
            if (S.u >= 1) { S.armed = true; S.tArm = S.t; r.x = pk.x; r.z = pk.z; r.yaw = pk.yaw; r.steer = 0; r.sit(); Sfx.loop('motor', 0); Sfx.whoosh(); tip('Reaching out with the arm.'); anim(r, 'arm', r.def.poses.ready, 1.2); anim(r, 'arm', r.def.poses.hover, 1.4, ease, 1.25); anim(r, 'pan', 0.5, 1.2); }
          } else {
            camTo(r.at(ASP < 0.9 ? 3.4 : 4.4, 2.3, 5.4, t1), r.at(0.2, 0.8, 1.6, t2), ASP < 0.9 ? 58 : 44, 1.8);
            if (S.t > S.tArm + 2.9) go(next);
          }
        }
      };
    }
    function drillCam(snap, wide) {                /* close on the drill, side on, so the cut face of the rock fills the view */
      const p = ASP < 0.9; if (wide) { if (p) { t1.set(2.0, 1.0, 0.02); t2.set(0.35, 0.1, 0.03); } else { t1.set(1.55, 0.46, 0.02); t2.set(0.2, 0.17, 0.03); } } else { t1.set(0.86, 0.325, 0); t2.set(0, p ? 0.262 : 0.268, 0); }
      tgt.localToWorld(t1); tgt.localToWorld(t2); (snap ? camSet : camTo)(t1, t2, wide ? (p ? 50 : 36) : (p ? 30 : 21), 2.4);
    }
    const holeTop = out => tgt.localToWorld(out.set(0.01, RK.H, 0));

    /* ──────── 1. Perseverance: drive, core a rock, seal the tube, then try the trip home ──────── */
    stages.p_load = { enter() { stepNow('p'); sub(['Drive', 'Drill', 'Send home'], 0); tip('Jezero Crater, Mars.'); loadThen(['percy'], () => go('p_drive')); } };
    stages.p_drive = {
      enter() { buildSite('jezero'); place('mars'); const r = startRover('percy', 'core'); padEl.hidden = false; chase(0, r.x, r.y, r.z, r.yaw, 7.6, 3.2, true); t1.copy(cam.position).add(t2.set(0, 9, 0)); cam.position.copy(t1);
        tip('Drive to the glowing rock.'); hint('Arrow keys or W A S D to drive. Drag to look around.'); line('p_go'); },
      update(dt) { if (S.t < 7) lab('delta', 'Cliffs of an old river delta', t1.set(Math.cos(2.8) * 560, 60, Math.sin(2.8) * 560), ''); if (driveTo(dt, 'p', 3.4) < 6.4) go('p_park'); },
      exit() { Sfx.loop('motor', 0); }
    };
    stages.p_park = parkStage('p', 'p_drill');
    /* Coring: push hard enough to cut, not so hard that the rock breaks up. Perseverance's very first core crumbled to bits. */
    stages.p_drill = {
      enter() { const r = rover; sub(['Drive', 'Drill', 'Send home'], 1); cutaway(true); anim(r, 'arm', r.def.poses.touch, 0.8); S.press = 0; S.stress = 0; S.depth = 0; S.tipD = 0; S.snapped = false; S.lowT = 0;
        metersEl.hidden = false; act('Hold to drill', null, 'hold'); hint('Hold the button, or hold Space.'); tip('Hold to drill. Keep the needle in the green.'); line('p_drill'); },
      update(dt) {
        drillCam(); const r = rover, on = held && S.t > 0.9, Z0 = 0.44, Z1 = 0.76; if (S.t > 0.85) alignCol();
        S.press = clamp(S.press + (on ? 0.6 : -0.85) * dt, 0, 1); const inz = S.press >= Z0 && S.press <= Z1;
        if (inz) S.depth += 0.0135 * dt; else if (S.press > 0.15 && S.press < Z0) S.depth += 0.003 * dt;
        S.stress = S.press > Z1 ? S.stress + dt * 1.15 : Math.max(0, S.stress - dt * 0.7);
        if (S.stress > 1) { S.stress = 0; S.press = 0.2; S.depth = Math.max(0, S.depth - 0.012); puff(10, false); Sfx.no(); G.react('no'); metersEl.classList.remove('shake'); void metersEl.offsetWidth; metersEl.classList.add('shake'); tip('Too hard! The rock crumbled. Ease off.'); once('p_hard'); }
        S.depth = Math.min(S.depth, 0.06); S.tipD = S.depth; r.bitSpin += S.press * 42 * dt; if (S.press > 0.2 && Math.random() < dt * 16 * S.press) puff(1, false);
        Sfx.loop('drill', S.press > 0.04 ? 62 + S.press * 105 : 0, 0.028 + S.press * 0.02);
        meter(m1El, 'Push', S.press, S.press > Z1 ? 'Too hard' : inz ? 'Just right' : S.press > 0.08 ? 'Harder' : '', [Z0, Z1]); m1El.classList.toggle('bad', S.press > Z1); m1El.classList.toggle('good', inz);
        meter(m2El, 'Depth', S.depth / 0.06, (S.depth * 100).toFixed(1) + ' cm'); paintCol(dt);
        if (S.depth >= 0.06) go('p_snap');
      },
      exit() { Sfx.loop('drill', 0); act(null); metersEl.hidden = true; hint(''); }
    };
    stages.p_snap = {
      enter() { tip('Snap! The core breaks off inside the bit.'); Sfx.thunk(); },
      update(dt) {
        const r = rover; drillCam();
        if (!S.snapped && S.t > 0.4) { S.snapped = true; puff(9, false); flash(220, 0.3); Sfx.lock(); anim(r, 'arm', r.def.poses.hover, 1.6, ease, 0.3); }
        if (S.snapped) S.tipD = S.depth - 0.2 * ease(seg(S.t, 0.7, 2.3));
        paintCol(dt); if (S.t > 1.2) lab('core', 'A rock core', holeTop(t1), 'ok');
        if (S.t > 2.7) go('p_tube');
      }
    };
    /* The core sits in a tube that was inside the bit all along. Seal it, then leave it on the ground, as Perseverance did with ten tubes. */
    stages.p_tube = {
      enter() { tubeG.visible = true; tubeG.cap.position.y = 0.135; tubeG.scale.setScalar(1); S.sealed = false; S.landed = false; tip('The core is safe inside a tube.'); line('p_core'); },
      update(dt) {
        const r = rover, t = S.t; drillCam(false, t > 3.3);
        const A = r.at(r.def.reach[0], 0.5, r.def.reach[1], t1), port = ASP < 0.9, B = tgt.localToWorld(t2.set(0.36, port ? 0.4 : 0.385, 0.01)), C = tgt.localToWorld(t3.set(port ? 0.72 : 0.62, 0.016, port ? 0.02 : 0.36));
        const out = ease(seg(t, 0, 0.9)), fly = ease(seg(t, 0.9, 1.9)), fall = seg(t, 3.5, 4.1);
        tubeG.position.copy(A); tubeG.position.y -= 0.02 + 0.1 * out; tubeG.position.lerp(B, fly);
        qa.setFromAxisAngle(AXX, Math.PI / 2 * (port ? Math.max(fly * 0.25, fall) : fly) + (S.landed ? 0 : Math.sin(t * 2.2) * 0.05)); tubeG.quaternion.copy(tgt.quaternion).multiply(qa);
        tubeG.cap.position.y = lerp(0.135, 0.0825, easeOut(seg(t, 2.1, 2.7)));
        if (t > 2.7 && !S.sealed) { S.sealed = true; flash(260, 0.45); Sfx.lock(); line('p_seal'); tip('Sealed tight.'); }
        if (S.sealed && t < 3.5) lab('seal', 'Sealed!', tubeG.position, 'ok');
        if (fall > 0) {                              /* it drops, lands, and bounces twice: squash and stretch */
          const b = t - 4.1, hop = b > 0 ? Math.abs(Math.sin(b * 9)) * 0.06 * Math.exp(-b * 4.5) : 0, k = fall * fall;
          tubeG.position.lerpVectors(B, C, fall); tubeG.position.y = lerp(B.y, C.y, k) + hop; const sq = b > 0 && b < 0.5 ? 1 - 0.25 * Math.exp(-b * 9) * Math.cos(b * 22) : 1; tubeG.scale.set(1 / Math.sqrt(sq), 1 / Math.sqrt(sq), sq);
          if (b > 0 && !S.landed) { S.landed = true; Sfx.thunk(); tip('It waits on the ground. Someone must come and get it.'); act('Plan the trip home', () => go('p_plan')); }
          if (S.landed) lab('wait', 'Tube 1 of 43', t1.copy(tubeG.position).setY(tubeG.position.y + 0.03), '');
        }
      },
      exit() { act(null); }
    };
    /* The trip home, as NASA and Europe once drew it up: a small rocket lifts the tubes off Mars, a spacecraft in orbit catches
       them and carries them to Earth. It was never built, so here it is a puzzle: launch so that rocket and orbiter meet. */
    const orbTh = t => -80 * DEG + ((t * OMEGA) % (190 * DEG));
    stages.p_plan = {
      enter() { hideAll(); place('space'); planG.visible = true; relayG.visible = false; earthS.visible = false; turnMars('perseverance', 18.44, 77.45); sub(['Drive', 'Drill', 'Send home'], 2); tagEl.hidden = false; rover.arm = rover.def.poses.stow.slice(); cutaway(false);
        S.launch = -1; S.tries = 0; S.caught = false; rocket.visible = false; ghost.visible = true; act('Launch', () => stages.p_plan.space()); tip('Launch so the rocket meets the orbiter.'); hint('Press Launch when the two rings meet.'); line('p_plan');
        const p = ASP < 0.9; camSet(t1.set(p ? 1.5 : 4, 9.5, p ? 57 : 31), t2.set(p ? 1.5 : 4, 10.2, 0), p ? 52 : 38); },
      update(dt) {
        const th = orbTh(S.t), gth = orbTh(S.t + TA), tol = (S.tries > 3 ? 28 : S.tries > 1 ? 18 : 11) * DEG, due = Math.abs(wrapPi(gth - GATE)) < tol;
        orbP(th, RO, catcher.position); catcher.rotation.z = -th; orbP(gth, RO, ghost.position); ghost.visible = S.launch < 0; gate.scale.setScalar(due && S.launch < 0 ? 1.25 + 0.1 * Math.sin(clock * 20) : 1); gate.material.opacity = due ? 1 : 0.6;
        lab('gate', 'Meet here', gate.position, 'under'); lab('orb', 'Orbiter', catcher.position, ''); if (S.launch < 0) lab('gh', due ? 'Now!' : 'It will be here', ghost.position, due ? 'ok' : '');
        lab('site', 'Tubes', P0, 'under');
        if (S.launch >= 0 && !S.caught) {
          S.launch += dt; const f = c01(S.launch / TA), u = Math.pow(f, 1.7); rocket.visible = true; pathAt(u, rocket.position); pathAt(Math.min(1, u + 0.02), t1); rocket.quaternion.setFromUnitVectors(UP, t1.sub(rocket.position).normalize());
          if (S.launch < 0.25) { const q = S.launch / 0.25; rocket.scale.set(1 + 0.25 * (1 - q), 1 - 0.3 * (1 - q) * Math.sin(q * 3.14), 1 + 0.25 * (1 - q)); } else rocket.scale.setScalar(1);     /* anticipation: it squats, then goes */
          flame.scale.setScalar(1.2 + 0.5 * Math.sin(clock * 50));
          if (f >= 1 && !S.caught) {
            const off = wrapPi(orbTh(S.t) - GATE);
            if (Math.abs(off) < tol + 2 * DEG) { S.caught = true; S.tCatch = S.t; rocket.visible = false; flash(300, 0.5); Sfx.lock(); Sfx.yes(); G.react('yes'); tip('Caught! Now the long trip to Earth.'); act(null); }
            else { S.launch = -1; S.tries++; rocket.visible = false; Sfx.no(); G.react('no'); tip(off > 0 ? 'Too late. The orbiter had passed. Launch sooner.' : 'Too early. The orbiter was not there yet.'); once('p_miss'); act('Launch', () => stages.p_plan.space()); hint('Press Launch when the two rings meet.'); }
          }
        }
        if (S.caught && S.t > S.tCatch + 1.3) go('p_cruise');
      },
      space() { if (S.launch < 0 && !S.caught) { S.launch = 0; Sfx.rumble(); tip('Lift-off!'); act(null); hint(''); } },   /* the button steps aside while the rocket flies, and comes back after a miss */
      exit() { act(null); }
    };
    stages.p_cruise = {
      enter() { hint(''); ghost.visible = false; earthS.visible = true; S.from = catcher.position.clone(); S.home = false; tripLine.visible = false; },
      update() {
        const t = S.t, f = ease(seg(t, 0.3, 4.6)), port = ASP < 0.9; t3.copy(EARTH).sub(S.from).normalize();
        catcher.position.copy(S.from).lerp(t1.copy(EARTH).addScaledVector(t3, -10.5), f); catcher.rotation.z += 0.004;
        t1.copy(catcher.position).add(t2.set(port ? -3 : -7, 4 + 5 * Math.sin(f * Math.PI), (port ? 26 : 15) + 9 * Math.sin(f * Math.PI))); camTo(t1, t2.copy(catcher.position).lerp(EARTH, f * 0.6), port ? 56 : 42, 2.2);
        lab('orb', 'Carrying the tubes', catcher.position, ''); if (f > 0.35) lab('earth', 'Earth', EARTH, 'big'); if (f < 0.6) lab('mars', 'Mars', t1.set(0, 0, 0), 'big');
        if (f < 0.9) tip('A long trip. Many months.');
        if (f >= 1 && !S.home) { S.home = true; flash(500, 0.7); Sfx.win(); tip('Home! Scientists could open the tubes at last.'); }
        if (S.home && t > 6.3 && !S.said.p_home) { once('p_home'); tip('That is the plan. The real tubes are still on Mars.'); }
        if (t > 9.4) { stepDone('p'); keep(1); card(D.cards[0], () => chapter(1)); }
      },
      exit() { tagEl.hidden = true; }
    };

    /* ──────── radio: shared by Curiosity and Ingenuity. Up to the orbiter, across space, down to the big dish ──────── */
    const passTh = t => lerp(-0.62, 0.62, (t * 0.2) % 1);
    function relayView(snap) { const p = ASP < 0.9; (snap ? camSet : camTo)(t1.set(0, RMARS + 1.2, p ? 13.5 : 9), t2.set(0, RMARS + 1.9, 0), p ? 62 : 50, 2.5); }
    function relayOpen(id, lat, lon) { hideAll(); place('space'); planG.visible = false; relayG.visible = true; earthS.visible = false; cone.visible = true; turnMars(id, lat, lon); relayView(true); S.sent = -1; S.fail = -1; packets.forEach(p => { p.visible = false; p.material.opacity = 1; p.scale.setScalar(0.5); }); }
    function relayTick(dt, label, next, auto) {        /* the orbiter crosses the sky; a message only gets through while it is inside the cone above the rover */
      relayView(); const th = auto ? 0.09 * Math.sin(clock * 0.6) : passTh(S.t), inC = Math.abs(th) < 0.17; orbP(th, RO2, mroG.position); mroG.rotation.z = -th;
      cone.material.opacity = inC ? 0.3 + 0.1 * Math.sin(clock * 14) : 0.14;
      lab('mro', 'Orbiter', mroG.position, ''); lab('rv', label, P0, 'under'); if (inC && S.sent < 0 && !auto) lab('now', 'Now!', t1.copy(mroG.position).setY(mroG.position.y + 1), 'ok');
      if (S.sent >= 0) { S.sent += dt; packets.forEach((p, i) => { const u = seg(S.sent, i * 0.12, 0.6 + i * 0.12); p.visible = u > 0 && u < 1; if (p.visible) p.position.copy(P0).lerp(mroG.position, u); }); if (S.sent > 1.5) { packets.forEach(p => { p.visible = false; }); if (next) go(next); return true; } }
      if (S.fail >= 0) { S.fail += dt; packets.forEach((p, i) => { const u = seg(S.fail, i * 0.1, 0.7 + i * 0.1); p.visible = u > 0 && u < 1; if (p.visible) { p.position.set(0, RMARS + u * 4.5, 0); p.material.opacity = 1 - u; } }); if (S.fail > 1.4) { S.fail = -1; packets.forEach(p => { p.visible = false; p.material.opacity = 1; }); } }
      return false;
    }
    function relaySend() {
      if (S.sent >= 0 || S.fail >= 0) return;
      if (Math.abs(passTh(S.t)) < 0.2) { S.sent = 0; Sfx.beep(); Sfx.yes(); G.react('yes'); tip('The orbiter heard you!'); act(null); hint(''); }
      else { S.fail = 0; Sfx.no(); tip('Nobody was overhead. Wait for the orbiter.'); }
    }
    function tripStage(next, sayKey) {               /* the signal crosses to Earth at the speed of light, and still takes minutes */
      return {
        enter() { hideAll(); relayG.visible = true; cone.visible = false; earthS.visible = true; S.from = mroG.position.clone(); S.arr = false; tripLine.visible = true; tip('Radio moves at light speed. Earth is still minutes away.'); if (sayKey) line(sayKey);
          const p = ASP < 0.9; if (p) camUp.set(1, 0, 0); camSet(t1.set(p ? 172 : 130, 26, p ? 525 : 335), t2.set(p ? 172 : 130, 18, -30), p ? 50 : 42); },
        update() {
          const f = c01(S.t / 4.8), pk = packets[0]; pk.visible = true; pk.material.opacity = 1; pk.scale.setScalar(7); pk.position.copy(S.from).lerp(EARTH, f); tripLine.geometry.setFromPoints([S.from, pk.position]);
          clock2(Math.max(1, Math.round(f * 12)) + ' min', 'It takes 3 to 22 minutes', f >= 1); lab('m', 'Mars', t1.set(0, 0, 0), 'big'); lab('e', 'Earth', EARTH, 'big');
          if (f >= 1 && !S.arr) { S.arr = true; Sfx.ping(); flash(260, 0.4); }
          if (S.t > 5.8) go(next);
        },
        exit() { tripLine.visible = false; packets[0].visible = false; packets[0].scale.setScalar(0.5); cone.visible = true; clockEl.hidden = true; camUp.set(0, 1, 0); }
      };
    }
    function dishStage(done) {                       /* Earth: the 70-metre dish catches what is left of the signal */
      return {
        enter() { hideAll(); place('earth'); const p = ASP < 0.9; camSet(t1.set(p ? -4 : -13, 2.6, p ? 34 : 23), t2.set(p ? 0 : -5, p ? 10.5 : 9, 0), p ? 60 : 46); S.got = false; S.after = null; tip('On Earth, a giant dish is listening.'); },
        update() {
          const t = S.t, p = ASP < 0.9; pulses.forEach((s, i) => { const u = seg(t, 0.7 + i * 0.4, 2.0 + i * 0.4); s.visible = u > 0 && u < 1; if (s.visible) { s.position.copy(MARSDOT).lerp(DISH, u); s.scale.setScalar(2.2 - u); } });
          camTo(t1.set((p ? -4 : -13) + t * 0.25, 2.6, p ? 34 : 23), t2.set(p ? 0 : -5, p ? 10.5 : 9, 0), p ? 60 : 46, 2);
          lab('md', 'Mars', MARSDOT, ''); lab('dish', 'Deep Space Network dish, 70 m wide', t1.set(0, 0.6, 0), 'under');
          if (t > 3.5 && !S.got) { S.got = true; flash(300, 0.45); Sfx.win(); G.react('yes'); done(); }
          if (S.got && S.after && t > 7.4) { const fn = S.after; S.after = null; fn(); }
        }
      };
    }

    /* ──────── 2. Curiosity: dodge the sharp rocks, drill to powder, test it in the lab inside, radio the answer home ──────── */
    const grains = Array.from({ length: 9 }, () => { const m = mesh(new THREE.SphereGeometry(0.011, 8, 6), M(0x9ea4aa, { roughness: 1 })); m.visible = false; gT.add(m); return m; });
    stages.c_load = { enter() { stepNow('c'); sub(['Drive', 'Drill', 'Send home'], 0); tip('Gale Crater, Mars.'); relayModels(); loadThen(['curio'], () => go('c_drive')); } };
    stages.c_drive = {
      enter() { buildSite('gale'); place('mars'); const r = startRover('curio', 'powder'); padEl.hidden = false; chase(0, r.x, r.y, r.z, r.yaw, 7.6, 3.2, true); cam.position.y += 9; S.holes = 0; S.ouchT = -9;
        tip('Drive to the glowing rock. Steer around the sharp ones.'); hint('Arrow keys or W A S D to drive. Drag to look around.'); line('c_go'); },
      update(dt) {
        const d = driveTo(dt, 'c', 3.4), r = rover, sh = site.sharp;
        if (S.t < 7) lab('sharpmt', 'Mount Sharp', t1.set(Math.cos(1.05) * 1150, 330, Math.sin(1.05) * 1150), '');
        for (const s of sharpRocks) { const dx = r.x - s.x, dz = r.z - s.z; if (dx * dx + dz * dz < (s.r + 1.2) * (s.r + 1.2) && clock - s.hit > 3) { s.hit = clock; S.holes++; S.spd *= 0.25; S.ouchT = S.t; flash(170, 0.3); Sfx.no(); G.react('no'); tip('Ouch! A sharp rock poked a hole in a wheel.'); once('c_ouch'); } }
        if (S.t < S.ouchT + 2.6) lab('ouch', S.holes + (S.holes > 1 ? ' holes' : ' hole') + ' in the wheels', r.at(0, 2.6, 0, t1), 'warn');
        else if (Math.hypot(r.x - sh[0], r.z - sh[1]) < sh[2] + 22) lab('sharp', 'Sharp rocks', t1.set(sh[0], hAt(sh[0], sh[1]) + 2.2, sh[1]), 'warn');
        if (trkS.d > 9 && trkS.d < 34 && S.t > S.ouchT + 2.6) lab('jpl', 'Its tracks spell J-P-L in dots and dashes', r.at(0, 0.2, -3.2, t1), 'under');
        if (d < 6.4) go('c_park');
      },
      exit() { Sfx.loop('motor', 0); }
    };
    stages.c_park = parkStage('c', 'c_drill');
    /* Curiosity's drill spins and hammers at once. Each hit on the beat drives the bit 8 mm deeper, to 6.4 cm, as in its first hole. */
    const BEAT = 0.72, beatAt = t => ((t - 1) / BEAT) % 1;
    stages.c_drill = {
      enter() { const r = rover; sub(['Drive', 'Drill', 'Send home'], 1); cutaway(true); anim(r, 'arm', r.def.poses.touch, 0.8); S.depth = 0; S.tipD = -0.045; r.bit = 0; S.lastHit = -9; S.lastBeat = -1;
        metersEl.hidden = false; act('Tap!', () => stages.c_drill.space(), 'tapbeat'); hint('Tap, or press Space, when the needle is green.'); tip('The drill spins and hammers. Tap on the beat.'); line('c_drill'); },
      update(dt) {
        drillCam(); const r = rover, ph = S.t > 1 ? beatAt(S.t) : 0, want = S.t > 0.9 ? 0.045 + S.depth : 0; if (S.t > 0.85) alignCol();
        r.bit += (want - r.bit) * (1 - Math.exp(-dt * 16)); S.tipD = r.bit - 0.045; r.bitSpin += 30 * dt; S.bitTurn += dt * 8; Sfx.loop('drill', 90, 0.02);
        meter(m1El, 'Beat', ph, ph > 0.76 ? 'Now!' : '', [0.76, 1]); m1El.classList.toggle('good', ph > 0.76); m1El.classList.remove('bad'); actBtn.style.setProperty('--ring', (ph > 0.76 ? 1 : ph * 0.5).toFixed(2));
        meter(m2El, 'Depth', S.depth / 0.064, (S.depth * 100).toFixed(1) + ' cm'); paintCol(dt);
        if (S.depth >= 0.0639 && S.t > S.lastHit + 0.6) go('c_scoop');
      },
      space() {
        if (S.t < 1 || S.depth >= 0.0639) return; const ph = beatAt(S.t), n = Math.floor((S.t - 1) / BEAT + 0.3);
        if ((ph > 0.72 || ph < 0.1) && n !== S.lastBeat) { S.lastBeat = n; S.lastHit = S.t; S.depth = Math.min(0.064, S.depth + 0.008); puff(8, true); Sfx.thunk(); tip(S.depth >= 0.0639 ? 'Deep enough!' : 'Hit! Keep the beat.'); }
        else { Sfx.tick(); tip('Not yet. Tap when the needle is in the green.'); }
      },
      exit() { Sfx.loop('drill', 0); act(null); metersEl.hidden = true; hint(''); actBtn.style.removeProperty('--ring'); }
    };
    stages.c_scoop = {
      enter() { tip('Grey powder! Mars is only red on the outside.'); line('c_grey'); S.up = false; },
      update(dt) {
        drillCam(); const r = rover; r.bit += (0 - r.bit) * (1 - Math.exp(-dt * 2.6)); S.tipD = r.bit - 0.045; r.bitSpin += 10 * dt; paintCol(dt); lab('pw', 'Grey powder', holeTop(t1), 'ok');
        if (S.t > 1.7 && !S.up) { S.up = true; anim(r, 'arm', r.def.poses.hover, 1.2); }
        if (S.t > 3.8) go('c_lab');
      }
    };
    stages.c_lab = {
      enter() { const r = rover; cutaway(false); r.open = 0; anim(r, 'arm', r.def.poses.ready, 1.1); anim(r, 'arm', r.def.poses.lab, 1.7, ease, 1.15); anim(r, 'open', 1, 0.7, ease, 1.9); S.poured = false; tip('No tubes here. The powder goes to a lab inside the rover.'); line('c_lab'); },
      update() {
        const r = rover, t = S.t, p = ASP < 0.9, inlet = r.at(-0.168, 1.13, 0.653, t3), from = r.at(-0.168, 1.34, 0.653, t2);
        camTo(r.at(p ? 2.0 : 2.4, 4.3, 2.5, t1), r.at(-0.1, 1.1, 0.75, t4), p ? 50 : 36, 1.8);
        grains.forEach((g, i) => { const u = seg(t, 3.1 + i * 0.13, 3.55 + i * 0.13); g.visible = u > 0 && u < 1; if (g.visible) g.position.copy(from).lerp(inlet, u * u); });
        if (t > 3.1 && !S.poured) { S.poured = true; Sfx.tick(); } if (t > 2.6) lab('lab', 'The lab is in here', inlet, 'ok');
        if (t > 5.2) {
          const chips = el('div', { class: 'elems' }), why = el('p', { class: 'fact' }); D.lab.forEach((n, i) => { const s = el('span', { text: n }); chips.append(s); setTimeout(() => { s.classList.add('on'); if (active) Sfx.tick(); }, 400 + i * 330); });
          why.append('All six are things ', el('mark', { text: 'life needs' }), '. Long ago, a ', el('mark', { text: 'lake' }), ' filled this crater.');
          grains.forEach(g => { g.visible = false; }); panel('Lab results', [el('p', { text: 'The lab baked the powder and sniffed the gas. It found:' }), chips, why], 'Send the answer home', () => go('c_send'));
        }
      }
    };
    stages.c_send = {
      enter() { relayOpen('curiosity', -4.59, 137.44); sub(['Drive', 'Drill', 'Send home'], 2); act('Send', relaySend); tip('The rock stays on Mars. Send the answer when the orbiter is overhead.'); hint('Press Send while the orbiter is inside the blue cone.'); line('c_send'); },
      update(dt) { relayTick(dt, 'Curiosity', 'c_trip'); },
      exit() { act(null); hint(''); }
    };
    stages.c_trip = tripStage('c_dish', 'c_wait');
    stages.c_dish = dishStage(() => { tip('Earth heard you: an old lake was here.'); line('c_got'); S.after = () => { stepDone('c'); keep(2); card(D.cards[1], () => chapter(2)); }; });

    /* ──────── 3. Ingenuity: spin up in thin air, fly, photograph three things, pass the photos along to Earth ──────── */
    const heliG = new THREE.Group(), chuteG = new THREE.Group(); gT.add(heliG, chuteG); heliG.visible = chuteG.visible = false;
    let heli = null;
    function mountHeli(root) {
      if (heli) return; heliG.position.set(0, 0, 0); heliG.rotation.set(0, 0, 0); heliG.add(root); heliG.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(root); root.position.y -= b.min.y; heliG.updateMatrixWorld(true);
      const axOf = o => UP.clone().applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize(), r1 = root.getObjectByName('rotors_01'), r2 = root.getObjectByName('rotors_02');
      const disc = o => { const d = mesh(new THREE.CircleGeometry(0.6, 40), new THREE.MeshBasicMaterial({ color: 0x15171a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); d.rotation.x = -Math.PI / 2; d.position.y = new THREE.Box3().setFromObject(o).getCenter(V()).y; heliG.add(d); return d; };
      heli = { r1, r2, a1: axOf(r1), a2: axOf(r2), q1: r1.quaternion.clone(), q2: r2.quaternion.clone(), d1: disc(r1), d2: disc(r2), ang: 0 };
    }
    function heliPose(dt) {                          /* where the helicopter is, how it leans, and how its two rotors turn against each other */
      if (!heli) return; S.gy += (hAt(S.hx, S.hz) - S.gy) * (1 - Math.exp(-dt * 3)); heliG.position.set(S.hx, S.gy + S.alt, S.hz); heliG.rotation.set(S.tiltP, S.hyaw, S.tiltR, 'YXZ');
      heli.ang += S.rpm * 70 * dt; heli.r1.quaternion.copy(heli.q1).multiply(qa.setFromAxisAngle(heli.a1, heli.ang)); heli.r2.quaternion.copy(heli.q2).multiply(qa.setFromAxisAngle(heli.a2, -heli.ang));
      const blur = clamp((S.rpm - 0.3) * 0.5, 0, 0.3); heli.d1.material.opacity = heli.d2.material.opacity = blur; heli.d1.castShadow = heli.d2.castShadow = S.rpm > 0.5;
      Sfx.loop('rotor', S.rpm > 0.03 ? 38 + S.rpm * 120 : 0, 0.012 + S.rpm * 0.02);
      if (S.rpm > 0.45 && S.alt < 2.2 && Math.random() < dt * 22 * S.rpm) { const a = Math.random() * 6.2832, rr = 0.7 + Math.random() * 0.9; dust(S.hx + Math.cos(a) * rr, S.gy + 0.1, S.hz + Math.sin(a) * rr, 1.6, 0.35); }     /* the rotors blow dust outward near the ground */
    }
    (function () {                                   /* the parachute and the backshell that carried Perseverance down, lying where they fell */
      const c = canvas2(512, 512), g = c.getContext('2d'); let sd = 21; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      g.fillStyle = '#f1ede3'; g.fillRect(0, 0, 512, 512);
      [[250, 176], [176, 100], [100, 34]].forEach(([r1, r0]) => { for (let i = 0; i < 20; i++) { if (rnd() < 0.5) continue; g.fillStyle = '#e2601c'; g.beginPath(); g.arc(256, 256, r1, i / 20 * 6.2832, (i + 1) / 20 * 6.2832); g.arc(256, 256, r0, (i + 1) / 20 * 6.2832, i / 20 * 6.2832, true); g.closePath(); g.fill(); } });
      g.strokeStyle = 'rgba(60,40,30,.35)'; g.lineWidth = 2; for (let i = 0; i < 20; i++) { g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(i / 20 * 6.2832) * 252, 256 + Math.sin(i / 20 * 6.2832) * 252); g.stroke(); }
      const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4;
      const geo = new THREE.CircleGeometry(6.2, 56, 0, 6.2832), p = geo.attributes.position; geo.rotateX(-Math.PI / 2);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) / 6.2, a = Math.atan2(z, x); p.setXYZ(i, x * (1 - 0.16 * r * Math.abs(Math.sin(a * 2.5 + 1))), 0.07 + 0.42 * r * Math.abs(Math.sin(a * 10)) * (0.4 + 0.6 * vnoise(x * 0.5 + 9, z * 0.5, 4)) + 0.5 * (1 - r) * vnoise(x * 0.7, z * 0.7 + 5, 8), z * 0.72); }
      geo.computeVertexNormals(); const chute = mesh(geo, M(0xffffff, { map: tx, roughness: 0.85, side: THREE.DoubleSide })); chute.castShadow = chute.receiveShadow = true; chuteG.add(chute);
      const shell = mesh(new THREE.ConeGeometry(2.2, 1.5, 28, 1, true), M(0xe9e4d8, { roughness: 0.7, side: THREE.DoubleSide }), 9.5, 0.95, 2.5); shell.rotation.set(0.25, 0.4, 1.95); shell.castShadow = true; chuteG.add(shell);
      const lines = []; for (let i = 0; i < 12; i++) { const a = -0.9 + i * 0.16; lines.push(V(8.3, 0.7, 2.4), V(Math.cos(a) * 5.6, 0.3, Math.sin(a) * 4)); }
      chuteG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: lin(0xe8e2d2), transparent: true, opacity: 0.8 })));
      for (let i = 0; i < 7; i++) { const m = mesh(new THREE.BoxGeometry(0.3 + rnd() * 0.5, 0.05, 0.2 + rnd() * 0.4), M(0xdcd6c8, { roughness: 0.6 }), 8 + rnd() * 5, 0.05, rnd() * 6 - 1); m.rotation.y = rnd() * 6; m.castShadow = true; chuteG.add(m); }
    })();
    const SHOTS = [['shadow', 'My shadow'], ['chute', 'Parachute'], ['rover', 'The rover']];
    const shotRT = new THREE.WebGLRenderTarget(400, 300), shotBuf = new Uint8Array(400 * 300 * 4), shotC = canvas2(400, 300); shotRT.texture.encoding = THREE.sRGBEncoding;
    function takePhoto() {                           /* a real picture: the scene as the helicopter's camera sees it */
      const ac = renderer.autoClear; renderer.autoClear = true; renderer.shadowMap.autoUpdate = true; renderer.setRenderTarget(shotRT); renderer.render(scene, viewCam); renderer.setRenderTarget(null); renderer.autoClear = ac;
      renderer.readRenderTargetPixels(shotRT, 0, 0, 400, 300, shotBuf); const g = shotC.getContext('2d'), im = g.createImageData(400, 300);
      for (let y = 0; y < 300; y++) im.data.set(shotBuf.subarray((299 - y) * 1600, (300 - y) * 1600), y * 1600); g.putImageData(im, 0, 0); return shotC.toDataURL('image/jpeg', 0.86);
    }
    function photoStrip() { photosEl.replaceChildren(); SHOTS.forEach(([k, label]) => { const li = el('li', { title: label }); const ph = S.photos.find(p => p.k === k); if (ph) { li.className = 'got'; li.append(el('img', { src: ph.src, alt: label })); } else li.innerHTML = ICON[k]; photosEl.append(li); }); }
    const shadowAt = out => { out.copy(heliG.position); for (let i = 0; i < 3; i++) { const k = (heliG.position.y - hAt(out.x, out.z)) / SUN.y; out.copy(heliG.position).addScaledVector(SUN, -k); } out.y = hAt(out.x, out.z); return out; };
    const targetAt = (k, out) => k === 'shadow' ? shadowAt(out) : k === 'chute' ? out.set(site.chute[0] + 2, hAt(site.chute[0], site.chute[1]) + 0.4, site.chute[1]) : out.copy(rigs.percy.g.position).setY(rigs.percy.g.position.y + 1);
    const framed = k => { targetAt(k, t4); const d = t4.distanceTo(viewCam.position); lp.copy(t4).project(viewCam); return lp.z < 1 && Math.abs(lp.x) < 0.66 && Math.abs(lp.y) < 0.66 && d < (k === 'shadow' ? 30 : 44); };
    function fly(dt, canMove) {
      const f = canMove ? keys.up - keys.down : 0, tr = canMove ? keys.left - keys.right : 0, sp0 = S.hspd;
      S.hspd += ((f > 0 ? 6.5 : f < 0 ? -3 : 0) - S.hspd) * (1 - Math.exp(-dt * 1.7)); S.hyaw += tr * 1.25 * dt;
      S.hx += Math.sin(S.hyaw) * S.hspd * dt; S.hz += Math.cos(S.hyaw) * S.hspd * dt; const d0 = Math.hypot(S.hx, S.hz); if (d0 > 112) { S.hx *= 112 / d0; S.hz *= 112 / d0; }
      const k = 1 - Math.exp(-dt * 4); S.tiltP += (S.hspd / 6.5 * 0.2 + (S.hspd - sp0) / Math.max(dt, 0.001) * 0.035 - S.tiltP) * k; S.tiltR += (-tr * 0.26 * Math.min(1, Math.abs(S.hspd) / 3 + 0.3) - S.tiltR) * k;   /* it leans into every move */
    }
    function finderCam() { viewCam.position.copy(heliG.position); viewCam.position.y -= 0.15; viewCam.rotation.set(-0.92, S.hyaw + Math.PI, 0, 'YXZ'); viewCam.updateMatrixWorld(); }
    stages.i_load = { enter() { stepNow('i'); sub(['Fly', 'Snap', 'Send home'], 0); tip('Jezero Crater, Mars.'); relayModels(); loadThen(['heli', 'percy'], () => { mountHeli(got.heli); go('i_spin'); }); } };
    stages.i_spin = {
      enter() {
        buildSite('jezero'); place('mars'); const r = startRover('percy', 'core'), pk = S.park, st = site.start; trackReset('plain');
        for (let i = 0; i <= 60; i++) trackAdd(lerp(st[0], pk.x, i / 60), lerp(st[1], pk.z, i / 60), pk.yaw, true);            /* the rover's tracks, from where it started to where it drilled */
        r.x = pk.x; r.z = pk.z; r.yaw = pk.yaw; r.y = undefined; r.sit(); r.arm = r.def.poses.ready.slice(); r.pan = -0.9; r.pose();
        tubeG.visible = true; tubeG.scale.setScalar(1); tubeG.cap.position.y = 0.0825; tgt.localToWorld(tubeG.position.set(0.62, 0.016, 0.36)); tubeG.quaternion.copy(tgt.quaternion).multiply(qa.setFromAxisAngle(AXX, Math.PI / 2));
        chuteG.visible = true; chuteG.position.set(site.chute[0], hAt(site.chute[0], site.chute[1]), site.chute[1]); heliG.visible = true; S.flying = true; S.photos = []; photoStrip();
        Object.assign(S, { hx: site.heli[0], hz: site.heli[1], hyaw: -2.2, hspd: 0, alt: 0, rpm: 0, tiltP: 0, tiltR: 0, gy: hAt(site.heli[0], site.heli[1]), orbY: 2.4, orbP: 0.1 }); heliPose(0);
        chase(0, S.hx, S.gy, S.hz, S.hyaw, 3.4, 1.0, true, 0.5); metersEl.hidden = false; act('Hold to spin', null, 'hold'); hint('Hold the button, or hold Space.'); tip('Mars air is very thin. Hold to spin the blades fast.'); line('i_go');
      },
      update(dt) {
        S.rpm = clamp(S.rpm + (held ? 0.36 : -0.5) * dt, 0, 1); const sh = S.rpm > 0.6 ? (Math.random() - 0.5) * 0.012 * S.rpm : 0; S.tiltR = sh; S.tiltP = -sh;
        meter(m1El, 'Blades', S.rpm, Math.round(S.rpm * 2537).toLocaleString('en-US') + ' rpm', [0.93, 1]); m1El.classList.toggle('good', S.rpm > 0.93); m1El.classList.remove('bad'); meter(m2El, 'On Earth', 0.19, 'far slower');
        heliPose(dt); chase(dt, S.hx, S.gy, S.hz, S.hyaw, 3.4, 1.0, false, 0.5); lab('me', 'You', t1.copy(heliG.position).setY(heliG.position.y + 0.9), '');
        if (S.rpm >= 0.985) go('i_fly');
      },
      exit() { act(null); metersEl.hidden = true; hint(''); }
    };
    stages.i_fly = {
      enter() { sub(['Fly', 'Snap', 'Send home'], 1); padEl.hidden = false; finderEl.hidden = false; photosEl.hidden = false; S.rpm = 1; S.shot = false; S.doneT = 0; act('Snap', () => { S.shot = true; });
        tip('Lift-off! Take three pictures.'); hint('Fly over a target. Snap when the camera box turns blue.'); line('i_up'); Sfx.whoosh(); anim(S, 'orbY', 0, 1.8); anim(S, 'orbP', 0, 1.8); },
      update(dt) {
        const up = ease(seg(S.t, 0.25, 2.4)); S.alt = S.t < 0.25 ? -0.03 * Math.sin(S.t / 0.25 * Math.PI) : 7 * up + 0.14 * Math.sin(clock * 1.7) * up;       /* a small dip first, then up: anticipation */
        fly(dt, S.t > 1.2 && !S.doneT); heliPose(dt); finderCam(); chase(dt, S.hx, heliG.position.y, S.hz, S.hyaw, 3.9, 1.5, false, 2.6);
        let hit = null, near = null, nd = 1e9;
        SHOTS.forEach(([k, label]) => { if (S.photos.find(p => p.k === k)) return; targetAt(k, t3); const d = Math.hypot(t3.x - S.hx, t3.z - S.hz); if (k !== 'shadow' && d < nd) { nd = d; near = t3.clone(); } if (!hit && framed(k)) hit = k; lab('t_' + k, k === 'shadow' ? 'Your shadow' : label, t3.setY(t3.y + (k === 'shadow' ? 0.3 : 3)), k === 'shadow' ? 'under' : 'ok'); });
        finderEl.classList.toggle('ok', !!hit); if (near) pointer('i', near.x, near.z); else noPointer('i');
        if (S.shot) {
          S.shot = false; Sfx.click(); flash(180, hit ? 0.7 : 0.25);
          if (hit) { S.photos.push({ k: hit, src: takePhoto() }); photoStrip(); G.react('yes'); const left = 3 - S.photos.length; tip(left ? 'Got it! ' + left + ' more to go.' : 'All three!'); if (!left) S.doneT = S.t; }
          else tip('Nothing to snap there. Fly until the camera box turns blue.');
        }
        if (S.doneT && S.t > S.doneT + 1.3) go('i_land');
      },
      exit() { finderEl.hidden = true; finderEl.classList.remove('ok'); act(null); }
    };
    stages.i_land = {
      enter() { sub(['Fly', 'Snap', 'Send home'], 2); S.down = 0; tip('Now land in the ring, next to the rover.'); hint('Fly into the blue ring.'); line('i_land'); },
      update(dt) {
        const lx = site.heli[0], lz = site.heli[1], d = Math.hypot(S.hx - lx, S.hz - lz); beaconAt(lx, lz, 3, true); if (!S.down) { pointer('i', lx, lz); lab('pad', 'Land here', t1.set(lx, hAt(lx, lz) + 1.2, lz), 'ok'); }
        if (!S.down && d < 3) { S.down = 0.001; S.hspd = 0; padEl.hidden = true; noPointer('i'); beacon.visible = false; hint(''); tip('Landing.'); }
        if (S.down) { S.down += dt; const u = ease(seg(S.down, 0, 2.6)); S.alt = 7 * (1 - u); S.hx += (lx - S.hx) * (1 - Math.exp(-dt * 2)); S.hz += (lz - S.hz) * (1 - Math.exp(-dt * 2)); S.rpm = S.down > 2.6 ? Math.max(0, 1 - (S.down - 2.6) / 1.4) : 1; fly(dt, false); if (S.down > 4.2) go('i_chain'); }
        else { S.alt = 7 + 0.14 * Math.sin(clock * 1.7); fly(dt, true); }
        heliPose(dt); chase(dt, S.hx, heliG.position.y, S.hz, S.hyaw, 3.9, 1.5, false, 2.6);
      },
      exit() { padEl.hidden = true; beacon.visible = false; photosEl.hidden = true; }
    };
    /* The helicopter's radio only reaches the rover. The rover passes the pictures to an orbiter, and the orbiter to Earth. The child builds the chain. */
    const LINKS = [['rover', 'Rover'], ['orbiter', 'Orbiter'], ['earth', 'Earth']];
    const sparks = Array.from({ length: 5 }, () => { const g = glow(0x9df0ff, 0.7, true); g.visible = false; gT.add(g); return g; });
    stages.i_chain = {
      enter() {
        S.link = 0; S.hop = -1; S.rpm = 0; chainEl.hidden = false; chainEl.replaceChildren();
        shuffle(LINKS.slice()).forEach(([k, label]) => { const b = el('button', { onclick: () => stages.i_chain.pick(k, b) }); b.innerHTML = ICON[k] + '<span>' + label + '</span>'; chainEl.append(b); });
        tip('Your radio is tiny. Who can hear you?'); line('i_chain');
      },
      pick(k, b) {
        if (S.paused || S.hop >= 0) return; const want = LINKS[S.link][0];
        if (k === want) { b.classList.add('yes'); b.disabled = true; answer(true); S.hop = 0; if (S.link === 1) { relayOpen('perseverance', 18.44, 77.45); chainEl.hidden = false; } tip(['The rover hears you!', 'Up to the orbiter!', 'And across to Earth!'][S.link]); }
        else { b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 700); answer(false); tip(S.link === 0 ? (k === 'earth' ? 'Too far! Your little radio only reaches the rover.' : 'Too high! Your little radio only reaches the rover.') : S.link === 1 ? 'The rover can whisper to Earth, but an orbiter is much faster.' : 'Not that one.'); }
      },
      update(dt) {
        const pc = rigs.percy;
        if (S.link === 0 || (S.link === 1 && S.hop < 0 && S.place === 'mars')) {
          heliPose(dt); const p = ASP < 0.9; t3.copy(heliG.position).add(pc.g.position).multiplyScalar(0.5); camTo(t1.copy(t3).add(t2.set(p ? 6 : 9, 4.6, p ? -13 : -9)), t3.setY(t3.y + 0.9), p ? 60 : 44, 1.6);
          lab('me', 'You', t1.copy(heliG.position).setY(heliG.position.y + 0.9), ''); lab('rv', 'Perseverance', t1.copy(pc.g.position).setY(pc.g.position.y + 2.6), '');
          if (S.hop >= 0) { S.hop += dt; sparks.forEach((g, i) => { const u = seg(S.hop, i * 0.12, 0.8 + i * 0.12); g.visible = u > 0 && u < 1; if (g.visible) { g.position.copy(heliG.position).lerp(t1.copy(pc.g.position).setY(pc.g.position.y + 1.6), u); g.position.y += Math.sin(u * Math.PI) * 1.4; } }); if (S.hop > 1.8) { sparks.forEach(g => { g.visible = false; }); S.hop = -1; S.link = 1; Sfx.beep(); tip('Next: who hears the rover?'); } }
        } else if (S.link === 1) { if (S.sent < 0) { S.sent = 0; Sfx.beep(); } if (relayTick(dt, 'Perseverance', null, true)) { S.hop = -1; S.link = 2; S.sent = -1; tip('Last one: who hears the orbiter?'); } }
        else { relayTick(dt, 'Perseverance', null, true); if (S.hop >= 0) go('i_trip'); }
      },
      exit() { chainEl.hidden = true; }
    };
    stages.i_trip = tripStage('i_dish', '');
    stages.i_dish = dishStage(() => {
      const shots = el('div', { class: 'shots' }); S.photos.forEach(p => shots.append(el('img', { src: p.src, alt: 'A photo you took as Ingenuity' }))); line('i_got');
      panel('Your pictures reached Earth', [shots, el('p', { text: 'From the helicopter to the rover, to the orbiter, to this dish.' })], 'Next', () => { stepDone('i'); card(D.cards[2], () => quiz(0, 0)); });
    });

    /* ---------- what Hy explains if the child stops getting anywhere: the part they are on, and a number that grows with progress ---------- */
    const HELPED = { p_drive: 1, p_drill: 1, p_tube: 1, p_plan: 1, c_drive: 1, c_drill: 1, c_send: 1, i_spin: 1, i_fly: 1, i_land: 1, i_chain: 1 };
    function helpNow() {
      if (S.paused) return S.quizAt >= 0 ? ['q3:quiz', S.quizAt] : null;
      const n = S.name; if (!HELPED[n] || (n === 'p_tube' && !S.landed)) return null;
      let p = null;
      if (n === 'p_drive' || n === 'c_drive') p = -Math.round(Math.hypot(rover.x - site.rock[0], rover.z - site.rock[1]) / 1.5);
      else if (n === 'p_drill' || n === 'c_drill') p = Math.round(S.depth * 400);
      else if (n === 'i_spin') p = Math.round(S.rpm * 10);
      else if (n === 'i_fly') { let nd = 0; SHOTS.forEach(([k]) => { if (k === 'shadow' || S.photos.find(x => x.k === k)) return; targetAt(k, t4); const d = Math.hypot(t4.x - S.hx, t4.z - S.hz); if (!nd || d < nd) nd = d; }); p = S.photos.length * 1000 - Math.round(nd / 4); }
      else if (n === 'i_land') p = S.down ? 1e6 : -Math.round(Math.hypot(S.hx - site.heli[0], S.hz - site.heli[1]) / 3);
      else if (n === 'i_chain') p = S.link * 10 + (S.hop >= 0 ? 1 : 0);
      return ['q3:' + n, p];
    }

    /* ---------- one step of time ---------- */
    function tick(dt) {
      clock += dt;
      if (!S.paused) { S.t += dt; const st = stages[S.name]; if (st && st.update) st.update(dt); }
      { const h = helpNow(); Help.part(h && h[0], dt, h ? h[1] : null); }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i]; if (w.delay > 0) { w.delay -= dt; if (w.delay > 0) continue; }
        if (w.from === null) w.from = Array.isArray(w.to) ? w.obj[w.key].slice() : w.obj[w.key];
        w.t += dt; const f = w.fn(Math.min(1, w.t / w.dur)); w.obj[w.key] = Array.isArray(w.to) ? w.to.map((v, n) => lerp(w.from[n], v, f)) : lerp(w.from, w.to, f);
        if (w.t >= w.dur) { w.obj[w.key] = Array.isArray(w.to) ? w.to.slice() : w.to; tweens.splice(i, 1); }
      }
      world(dt, cam);
      if (!S.camFree) { const k = 1 - Math.exp(-dt * goal.speed); cam.position.lerp(goal.pos, k); look.lerp(goal.look, k); cam.fov += (goal.fov - cam.fov) * k; }     /* the camera eases toward where it is going: slow in, slow out */
      cam.up.copy(camUp); cam.lookAt(look); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); skyG.position.copy(cam.position);
      for (const k in labs) if (labs[k]._t !== labTick) labs[k].hidden = true; labTick++;
      S.ddx = S.ddy = 0;
    }
    /* things that move whatever the stage: wheels and arms, the beacon, the light that follows the action */
    function world(dt, c) {
      for (const k in rigs) if (rigs[k].g.visible) rigs[k].pose(); dustTick(dt);
      if (beacon.visible) { const s = (beacon.userData.r || 2.4) * (1 + 0.12 * Math.sin(clock * 4)); beacon.ring.scale.setScalar(s); beacon.children[0].material.opacity = 0.26 + 0.1 * Math.sin(clock * 4); }
      if (S.place === 'mars') { if (heliG.visible && S.flying) focus.copy(heliG.position); else if (rover) focus.copy(rover.g.position); sun.position.copy(focus).addScaledVector(SUN, 100); sun.target.position.copy(focus); }
      else { sun.position.copy(c.position).add(t1.set(-60, 50, 40)); sun.target.position.copy(c.position).add(t1.set(0, 0, -60)); }
    }

    /* ---------- input: pointer, keys, on-screen pad, and the big button ---------- */
    function press() { if (!active || S.paused) return; if (S.act) S.act(); else { const st = stages[S.name]; if (st && st.space) st.space(); } }
    stage.addEventListener('pointerdown', e => { if (!active || S.paused) return; drag = { x: e.clientX, y: e.clientY, moved: 0 }; try { stage.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    stage.addEventListener('pointermove', e => { if (!active || S.paused || !drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); S.ddx += dx; S.ddy += dy; });
    stage.addEventListener('pointerup', e => { if (!drag) return; const d = drag; drag = null; if (!active || S.paused) return; const st = stages[S.name]; if (d.moved < 8 && st && st.tap) st.tap(e.clientX, e.clientY); });
    stage.addEventListener('pointercancel', () => { drag = null; });
    stage.addEventListener('contextmenu', e => e.preventDefault());
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
    addEventListener('keydown', e => {
      if (!active || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = 1; e.preventDefault(); return; }
      if (e.code !== 'Space') return;
      if (e.target.tagName === 'BUTTON' && e.target !== actBtn) return;          /* Space on another focused button already presses it */
      e.preventDefault(); if (S.paused || e.repeat) return;
      if (S.actMode === 'hold') { held = 1; actBtn.classList.add('on'); } else press();
    });
    addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = 0; if (e.code === 'Space') { held = 0; actBtn.classList.remove('on'); } });
    $$('button', padEl).forEach(b => {
      const k = b.dataset.k, on = v => e => { e.preventDefault(); keys[k] = v; b.classList.toggle('on', !!v); };
      b.addEventListener('pointerdown', on(1)); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, on(0)));
    });
    actBtn.addEventListener('pointerdown', e => { if (S.actMode !== 'hold' || !active || S.paused) return; held = 1; actBtn.classList.add('on'); e.preventDefault(); try { actBtn.setPointerCapture(e.pointerId); } catch (_) {} });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => actBtn.addEventListener(t, () => { if (S.actMode === 'hold') { held = 0; actBtn.classList.remove('on'); } }));
    actBtn.addEventListener('click', e => { actBtn.blur(); if (S.actMode === 'hold') return; if (e.detail === 0) return; press(); });   /* keyboard presses arrive through the Space handler above */
    addEventListener('blur', () => { held = 0; for (const k in keys) keys[k] = 0; });

    /* ---------- starting, leaving and finishing ---------- */
    const soundBtn = el('button', { class: 'btn ghost', id: 'rove-sound', text: 'Sound: on', onclick: () => { const v = !Music.isOn(); Music.set(v); Sfx.set(v); soundBtn.textContent = 'Sound: ' + (v ? 'on' : 'off'); } });
    box.append(soundBtn);
    function reset() {
      Object.assign(S, { name: '', t: 0, paused: false, act: null, actMode: '', camFree: false, ddx: 0, ddy: 0, said: {}, spd: 0, orbY: 0, orbP: 0, ch: 0, flying: false, depth: 0, tipD: -0.03, snapped: false, bitTurn: 0, axZ: 0, axSet: false, kind: 'core', photos: [], quizAt: -1 });
      tweens.length = 0; for (const k in keys) keys[k] = 0; drag = null; held = 0; foundEl.hidden = true; loadEl.hidden = true; hideAll(); buildList();
    }
    const CHAPS = ['p_load', 'c_load', 'i_load'];
    let resume = 0;                                   /* the chapter to come back to after leaving; forgotten when the page is closed */
    function keep(n) { resume = n; }                  /* a finished chapter stays finished, even if the child leaves at its fact card */
    function chapter(n) { S.ch = n; keep(n); for (let i = 0; i < n; i++) stepDone(STEPS[i][0]); go(CHAPS[n]); }
    function start() {
      reset(); active = true; finished = false; box.hidden = false; document.body.classList.add('questing'); if (Missions.stopAll) Missions.stopAll();
      soundBtn.textContent = 'Sound: ' + (Music.isOn() ? 'on' : 'off'); Sfx.set(Music.isOn()); Music.scene('m-hour-q3'); Help.fresh('q3:');
      const n = clamp(resume, 0, 2);
      chapter(n);
    }
    function stop() { renderer.shadowMap.autoUpdate = true; Music.scene(null); ['motor', 'drill', 'rotor'].forEach(k => Sfx.loop(k, 0)); Sfx.set(true); active = false; box.hidden = true; document.body.classList.remove('questing'); for (const k in keys) keys[k] = 0; held = 0; idle(); }
    function leave(to) { stop(); setTimeout(() => { const t = $(to); if (t) t.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 80); }
    function finish() { finished = true; resume = 0; Notebook.badge('rover'); const b = $('#quest3'); if (b) b.textContent = 'Play Quest 3 again'; leave('#models'); }
    $('#rove-exit').addEventListener('click', () => leave('#mars'));
    box.append(skipBtn('Skip quest', () => { resume = 0; Notebook.skip('#mars'); leave('#models'); }, 'btn ghost skipq'));
    const startBtn = $('#quest3'); if (startBtn) startBtn.addEventListener('click', start);

    /* ---------- the page's own view of this world: Perseverance parked in Jezero, with the camera circling ---------- */
    let teaseT = 0, teaseAsked = false;
    function idle() {
      S.place = ''; buildSite('jezero'); place('mars'); tgt.visible = false; beacon.visible = false; tubeG.visible = false; heliG.visible = false; chuteG.visible = false; trackReset('plain'); S.flying = false;
      const r = rigs.percy; if (r) { useRover('percy'); const st = site.start; r.x = st[0]; r.z = st[1]; r.yaw = st[2] + 0.5; r.y = undefined; r.pitch = r.roll = 0; r.sit(); r.arm = r.def.poses.ready.slice(); r.steer = 0.25; r.pan = 0.4; r.pose(); }
    }
    function teaser(dt, a) {
      if (active) return; teaseT += dt;
      if (!teaseAsked) { teaseAsked = true; idle(); getRig('percy').then(() => { if (!active) idle(); }).catch(() => {}); }
      const st = site.start, y = hAt(st[0], st[1]), ang = 2.3 + (RM ? 0 : teaseT * 0.07), d = a < 1 ? 11 : 8.4;
      teaseCam.fov = a < 1 ? 40 : 30; teaseCam.position.set(st[0] + Math.sin(ang) * d, y + 2.1, st[1] + Math.cos(ang) * d); teaseCam.lookAt(st[0], y + 1.0, st[1]); skyG.position.copy(teaseCam.position);
      if (rigs.percy) rigs.percy.pan = 0.4 + 0.5 * Math.sin(teaseT * 0.5);
      world(dt, teaseCam);
    }
    /* the main view draws the shadows; the small camera view right after it reuses them instead of drawing them again */
    views.push({ el: stage, scene, cam, quest: true, update(dt, a, rect) { renderer.shadowMap.autoUpdate = true; if (!active) return; R = rect; ASP = a; tick(dt); } });
    views.push({ el: portEl, scene, cam: viewCam, quest: true, update() { renderer.shadowMap.autoUpdate = false; } });
    if (teaseEl) views.push({ el: teaseEl, scene, cam: teaseCam, update(dt, a) { renderer.shadowMap.autoUpdate = true; teaser(dt, a); } });
    reset();
    LBF.rove = { start, stop, go, S, tick, chapter, resumeAt(n) { resume = n; }, isDone: () => finished, rigs, keys, hold(v) { held = v ? 1 : 0; }, press, site: () => site, at(p) { lp.copy(p).project(cam); return [(lp.x + 1) / 2 * R.width + R.left, (1 - lp.y) / 2 * R.height + R.top]; } };
  })(); } catch (err) { console.warn('Quest 3 is unavailable:', err); }
  /* ══ Quest 3 end ══ */
  /* ══ Finale begin ══ */
  /* The backdrop of the ending: Mars, then the long flight to Earth, then Earth falling away again. */
  (function () {
    const stage = $('#fin-stage'); if (!stage) return;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
    const mars = new THREE.Mesh(new THREE.SphereGeometry(2, 96, 64), globeMat(marsTex, 0xffe9dc)), earth = new THREE.Mesh(new THREE.SphereGeometry(2.3, 96, 64), globeMat(tex('earth.jpg')));
    const E = new THREE.Vector3(0, 0, -150); earth.position.copy(E); earth.rotation.set(0.35, 3.6, 0); mars.rotation.set(0.3, 2.4, 0);
    const sun = new THREE.DirectionalLight(0xfff4e6, 1.9); sun.position.set(-4, 2, 3);
    scene.add(mars, earth, sun, new THREE.AmbientLight(0xffffff, 0.07));
    const look = new THREE.Vector3(), ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); let t = 0, on = false, flyT = -1, outT = -1, last = 0;
    views.push({ el: stage, scene, cam, quest: true, update(dt, a) {
      if (!on) return;
      const now = performance.now(); dt = Math.max(dt, Math.min(0.25, (now - last) / 1000)); last = now;      /* real seconds, so a slow device keeps pace with Hy and the captions */
      t += dt; if (flyT >= 0) flyT += dt; if (outT >= 0) outT += dt;
      const wide = a > 1, side = wide ? 2.6 : 0.6, low = wide ? 1.1 : 2.6;          /* Mars sits low and to the left of Hy; Earth arrives dead ahead */
      if (!RM) { mars.rotation.y += dt * 0.04; earth.rotation.y += dt * 0.03; }
      const u = ease(flyT / 7.2), dive = ease((flyT - 7.2) / 1.6), back = outT < 0 ? 0 : outT * outT * 9;
      /* before the flight: close to Mars. During it: an arc past Mars and across to Earth. Then a dive at the night side, and at the end a long pull back. */
      cam.position.set(side * (1 - u) + Math.sin(u * Math.PI) * 5, low * (1 - u) + Math.sin(t * 0.3) * 0.08, 7.5 - u * (7.5 + 150 - 8.5) - dive * 5 + back);
      look.set(0, 0, 0).lerp(E, ease(u * 2.2)); cam.lookAt(look);
      cam.fov = 38 + Math.sin(u * Math.PI) * 16; cam.updateProjectionMatrix();          /* the view widens at full speed, so the stars seem to rush */
      skyAdd.y = u * 1.4 + t * 0.004; skyAdd.x = Math.sin(u * Math.PI) * 0.25 - back * 0.004;
    } });
    LBF.finale3d = { start() { t = 0; flyT = outT = -1; on = true; }, fly() { flyT = 0; }, out() { if (flyT < 0) flyT = 99; if (outT < 0) outT = 0; }, stop() { on = false; skyAdd.x = skyAdd.y = 0; } };
  })();
  /* ══ Finale end ══ */
  /* render loop: one canvas, one viewport per stage */
  let last = performance.now(), W = 0, H = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== W || h !== H) { W = w; H = h; renderer.setSize(w, h, false); skyCam.aspect = w / h; skyCam.updateProjectionMatrix(); }
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear();
    const sc = window.scrollY || 0;
    skyCam.rotation.set(-sc * 0.00012 + skyAdd.x, sc * 0.00006 + (RM ? 0 : now * 0.000004) + skyAdd.y, 0);
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
  const BADGES = { first: 'Rookie detective', moon: 'Moon expert', walker: 'Moon walker', laser: 'Laser ranger', rover: 'Mars robot driver', shadow: 'Shadow spotter', mystery: 'Mystery cracked', interview: 'Interviewer', tour: 'Rode along', talk: 'Talked to Hy', quiz: 'Quiz badge', medal: 'Space Detective medal' };
  /* the six quests in page order: where each one lives, and the badge (any one of them) that proves it is done */
  const QUESTS = [['#moon', ['walker']], ['#mirrors', ['laser']], ['#mars', ['rover']], ['#models', ['shadow']], ['#ask', ['mystery', 'interview', 'tour', 'talk']], ['#quiz', ['quiz']]];
  const FILES = C.filter(c => c.world === 'moon');           /* only the Moon has files to open; Mars is a quest */
  /* Every visit starts fresh: nothing is saved between visits, and what earlier versions saved is cleared. */
  const st = { files: [], badges: [], skipped: [] };
  try { ['lbf-notebook', 'lbf-finale'].forEach(k => localStorage.removeItem(k)); ['lbf-q1', 'lbf-q3', 'lbf-intro'].forEach(k => sessionStorage.removeItem(k)); } catch (_) {}
  const save = () => {};
  const done = i => st.skipped.includes(i) || QUESTS[i][1].some(b => st.badges.includes(b));
  const left = () => QUESTS.map((q, i) => i).filter(i => !done(i));
  let toastT = null, onAll = null, srcOpen = false;
  function toast(text) {
    let t = $('#toast');
    if (!t) { t = el('div', { id: 'toast', role: 'status', style: 'position:fixed;left:14px;bottom:14px;z-index:50;background:#ff9a3d;color:#17171a;font-family:var(--display);padding:10px 14px 8px;border-radius:3px;box-shadow:0 10px 40px rgba(0,0,0,.7);max-width:calc(100vw - 28px)' }); document.body.append(t); }
    t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function render() {
    $('#nb-count').textContent = st.files.length + ' of ' + FILES.length + ' Moon files opened. ' + st.badges.length + ' of ' + Object.keys(BADGES).length + ' badges earned.';
    $('#nb-stamps').replaceChildren(...FILES.map(c => el('i', { class: 's-' + c.status + (st.files.includes(c.id) ? ' got' : ''), title: c.name })));
    $('#nb-badges').replaceChildren(...Object.keys(BADGES).map(k => el('li', { class: st.badges.includes(k) ? 'got' : '', text: BADGES[k] })));
    $$('.bar nav a').forEach(a => { const i = QUESTS.findIndex(q => q[0] === a.getAttribute('href')); if (i >= 0) a.classList.toggle('done', done(i)); });
    /* the gate: the page ends at the first quest that is not done yet, so nobody scrolls past a puzzle */
    const first = left().length ? left()[0] : 6;
    QUESTS.forEach((q, i) => { const sec = $(q[0]); sec.classList.add('questsec'); sec.classList.toggle('gated', i > first); sec.classList.toggle('cleared', done(i)); });
    $$('.bar nav a').forEach(a => { const i = QUESTS.findIndex(q => q[0] === a.getAttribute('href')); if (i >= 0) a.classList.toggle('shut', i > first); });
    [$('#sources'), $('footer')].forEach(e => e && e.classList.toggle('gated', first < 6 && !srcOpen));
    const n = left().length, note = $('#fin-left'), open = $('#fin-open');
    if (note) note.textContent = n ? (6 - n) + ' of 6 quests done. Finish all six to see the ending.' : 'All six quests done.';
    if (open) open.hidden = n > 0;
  }
  function badge(k) {
    if (!BADGES[k] || st.badges.includes(k)) return;
    const was = left().length;
    st.badges.push(k); save(); render(); toast('New badge for your notebook: ' + BADGES[k]);
    if (was > 0 && !left().length && onAll) onAll();             /* that was the sixth quest: roll the ending */
  }
  /* a skipped quest earns no badge, but it is ticked off, and it counts toward the ending */
  function skip(where) {
    const i = QUESTS.findIndex(q => q[0] === where); if (i < 0 || done(i)) return;
    const was = left().length; st.skipped.push(i); render();
    if (was > 0 && !left().length && onAll) onAll();
  }
  function file(id) {
    if (!byId[id] || byId[id].world !== 'moon' || st.files.includes(id)) return;
    st.files.push(id); save(); render();
    if (st.files.length >= 3) badge('first');
    if (FILES.every(c => st.files.includes(c.id))) badge('moon');
  }
  render();
  return { badge, file, skip, left, where: i => QUESTS[i][0], whenAll(fn) { onAll = fn; }, showSources() { srcOpen = true; render(); } };
})();

/* ───────────────────────── Missions: mystery machine and the ride-along tour, both on the Moon ───────────────────────── */
const Missions = (function () {
  let mystery = null, tour = null;
  const MYST = { start: "I'm thinking of one machine on the Moon. Read the clue, then click its light on the globe.", next: 'Here is another clue.', same: 'Not that one. Ours arrived in the same year. Try another light.', earlier: 'Not that one. Ours arrived earlier. Try another light.', later: 'Not that one. Ours arrived later. Try another light.', won: 'You cracked it! Fine detective work, partner.', lost: 'A tough one. Read the file, then try another.' };
  const tourLine = (c, i) => (i === 0 ? 'Buckle up. First stop: ' : 'Next stop: ') + c.name + '. ' + c.story + ' ' + c.clue;
  const ban = w => $('#mis-' + w);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reveal = w => $('#' + w).scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  function banner(w, title, text, buttons) {
    const b = ban(w);
    b.replaceChildren(el('strong', { text: title }), el('span', { text }),
      el('div', { class: 'row' }, ...buttons.filter(Boolean).map(([label, fn, ghost]) => el('button', { class: 'btn onpaper' + (ghost ? ' ghost' : ''), text: label, onclick: fn }))));
    b.classList.add('on');
  }
  function clear() { ban('moon').classList.remove('on'); ban('moon').replaceChildren(); }

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
      mystery.clue < 2 ? ['Next clue', () => { mystery.clue++; mystery.hint = ''; showClue(); say(MYST.next, true); }] : null,
      ['Ask Hy yes or no', () => startMode({ type: 'mystery', id: c.id }), true],
      ['Give up', () => endMystery(false), true]
    ]);
  }
  function startMystery() {
    stopAll(); Help.fresh('mystery');
    const pool = C.filter(c => c.world === 'moon' && c.status !== 'lost'), c = pool[Math.floor(Math.random() * pool.length)];
    mystery = { id: c.id, clue: 0, tries: 0, hint: '', clues: clues(c) };
    reveal(c.world); showClue();
    say(MYST.start, true);
  }
  function guess(c) {
    const t = byId[mystery.id];
    if (c.id === t.id) return endMystery(true);
    mystery.tries++;
    mystery.hint = 'Not ' + c.name + '. Our machine arrived ' + (c.year === t.year ? 'in the same year' : t.year < c.year ? 'earlier than that' : 'later than that') + '.';
    if (mystery.tries >= 6) return endMystery(false);
    if (mystery.tries % 2 === 0 && mystery.clue < 2) mystery.clue++;
    showClue(); say(c.year === t.year ? MYST.same : t.year < c.year ? MYST.earlier : MYST.later, true);
  }
  function endMystery(won) {
    const c = byId[mystery.id]; mystery = null;
    if (chatMode && chatMode.type === 'mystery') endMode();
    openCase(c.id, { quiet: true });
    banner(c.world, won ? 'Case cracked' : 'Case file revealed', (won ? 'You found it: ' : 'It was ') + c.name + '. Its file is open.', [['Play again', startMystery], ['Close', clear, true]]);
    if (won) Notebook.badge('mystery');
    say(won ? MYST.won : MYST.lost, true);
  }

  /* --- ride-along tour --- */
  const TOURS = { moon: ['surveyor1', 'surveyor3', 'apollo11', 'apollo15', 'prospector', 'lcross', 'blueghost'] };
  async function startTour(w) {
    w = 'moon'; stopAll();
    const run = tour = { stop: false, skip: null }, stops = TOURS[w];
    reveal(w); Notebook.badge('tour');
    for (let i = 0; i < stops.length && !run.stop; i++) {
      const c = byId[stops[i]];
      openCase(c.id, { quiet: true });
      banner(w, 'Ride along: stop ' + (i + 1) + ' of ' + stops.length, c.name + ', ' + c.year + '. ' + c.site + '.', [['Next stop', () => run.skip && run.skip()], ['End the tour', stopTour, true]]);
      const line = tourLine(c, i);
      const told = Voice.isOn() ? Promise.race([say(line, true).then(() => wait(900)), wait(5000 + line.length * 95)]) : (say(line, true), wait(2600 + line.length * 55));
      await Promise.race([told, new Promise(r => { run.skip = r; })]);
      Voice.stop();
    }
    if (run.stop) return;
    tour = null;
    banner(w, 'End of the line', 'That was the Moon tour.', [['Play mystery machine', startMystery], ['Close', clear, true]]);
    say("That's the tour. Now go poke around yourself. Every light has a story.", true);
  }
  function stopTour() { if (tour) { tour.stop = true; if (tour.skip) tour.skip(); tour = null; Voice.stop(); } clear(); }
  function stopAll() { stopTour(); mystery = null; clear(); }
  /* Hy watches the mystery too: stuck on one clue for ten seconds, and he explains what to do */
  PARTS.push(() => mystery && !chatMode && inView($('#st-moon')) ? ['mystery', mystery.clue * 10 + mystery.tries] : null);
  return {
    startMystery, startTour, stopAll, lines: () => Object.values(MYST).concat(TOURS.moon.map((id, i) => tourLine(byId[id], i)), ["That's the tour. Now go poke around yourself. Every light has a story."]),
    /* a click on a light or a list entry: a guess during a mystery, and it ends a running tour */
    intercept(c) { if (mystery) { guess(c); return true; } if (tour) stopTour(); return false; }
  };
})();
$('#m-mystery').addEventListener('click', Missions.startMystery);
$$('[data-tour]').forEach(b => b.addEventListener('click', () => Missions.startTour(b.dataset.tour)));

/* ───────────────────────── Talking with Hy: the child taps a question. Nobody types. ───────────────────────── */
const chat = $('#chat'), log = $('#log'), modeEl = $('#mode');
const NOW = 'What do I do now?';
const PROMPTS = [NOW, 'Which machines still work?', 'Why did Opportunity stop working?', 'How do the mirrors on the Moon work?', 'Tell me about the Mars helicopter', 'Where are the Mars rock tubes?', 'Did anything find water?', 'Who walked on the Moon first?', 'Why are you a hydrogen atom?'];
const ASK_THEM = ['What was your landing like?', 'What is the coolest thing you found?', 'Are you still working?', 'What did you leave behind?'];
const YESNO = ['Did astronauts go there?', 'Is it a robot lander?', 'Did it arrive before 1980?', 'Is it still working?', 'Did it crash on purpose?'];
const BRIEF = LBF.buildPrompt();
const ENDPOINT = (LBF.AI_ENDPOINT || '').trim();
let sample = null, history = [], busy = false, greeted = false, chatMode = null, lineDown = 0, toldDown = false;

function setMode() {
  const live = !!sample || (!!ENDPOINT && performance.now() >= lineDown);
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

function closeChat() {
  chat.classList.remove('open', 'helping'); guide.classList.remove('chatting');
  if (chat.contains(document.activeElement)) document.activeElement.blur();     /* so Space and the arrow keys go back to the game */
}
function greet() {
  if (greeted) return; greeted = true;
  addMsg('hy', "Pull up a chair, kid. Tap a question and I'll answer. Some answers take you places.");
}
function openChat() {
  chat.classList.add('open'); guide.classList.add('chatting');
  if (!chatMode) greet();
}
function addMsg(who, text) { const m = el('div', { class: 'msg ' + who, text }); log.append(m); log.scrollTop = log.scrollHeight; return m; }
/* the buttons under the conversation: Hy's own follow-ups first (when the live AI wrote some), then the fixed list for this kind of talk */
function setChips(extra) {
  const base = chatMode ? (chatMode.type === 'interview' ? ASK_THEM : YESNO) : PROMPTS, box = $('#chat-qs'); box.replaceChildren();
  (extra || []).filter(q => !base.includes(q)).concat(base).forEach(q => box.append(el('button', { type: 'button', text: q, onclick: () => ask(q) })));
}

/* Interview and mystery modes change who is talking */
function startMode(m) {
  const c = byId[m.id]; if (!c) return;
  chatMode = m; history = []; log.replaceChildren(); chat.classList.add('mode'); chat.classList.remove('helping'); Voice.stop();
  if (m.type === 'interview') {
    $('#chat-title').textContent = 'Interview: ' + c.name;
    const hi = "Hello! I'm " + c.name + '. I reached ' + WORLD_NAME[c.world] + ' in ' + c.year + '. Tap a question for me.';
    addMsg('them', hi); Voice.speak(hi, { pitch: 0.8, rate: 0.98 });
    openCase(c.id, { quiet: true }); Notebook.badge('interview');
  } else {
    $('#chat-title').textContent = 'Mystery: yes or no?';
    addMsg('hy', "Tap a yes-or-no question about the mystery machine. I won't say its name.");
  }
  setChips(); openChat();
}
function endMode() {
  chatMode = null; history = []; log.replaceChildren(); chat.classList.remove('mode'); Voice.stop();
  $('#chat-title').textContent = 'Talk to Hy'; greeted = false; greet(); setChips();
}
$('#chat-back').addEventListener('click', endMode);
(function () {
  const sel = $('#m-who');
  C.filter(c => c.status !== 'lost').forEach(c => sel.append(el('option', { value: c.id, text: c.name + ' (' + (c.world === 'moon' ? 'Moon' : 'Mars') + ', ' + c.year + ')' })));
  sel.value = 'curiosity';
  $('#m-interview').addEventListener('click', () => startMode({ type: 'interview', id: sel.value }));
})();
LBF.interview = id => startMode({ type: 'interview', id });

/* Hy's replies can carry control lines such as [[go:apollo15]]; pull them out and act on them */
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
const goTo = id => () => {                       /* a stop behind the gate sends the child to the quest that opens it */
  let t = $(document.body.classList.contains('locked') ? '#story' : id);
  if (t && t.classList.contains('gated')) t = $(Notebook.where(Notebook.left()[0]));
  if (t) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
};
$$('.bar nav a').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); if (id === '#sources') Notebook.showSources();
  const t = $(id); if (t && t.classList.contains('gated')) { e.preventDefault(); goTo(id)(); }
}));
const DO = {
  laser: ['Try the laser quest', goTo('#mirrors')],
  mystery: ['Play mystery machine', () => Missions.startMystery()],
  'tour-moon': ['Take the Moon tour', () => Missions.startTour('moon')],
  rovers: ['Play the Mars robots quest', goTo('#mars')],
  quiz: ['Play Real or fake', goTo('#quiz')]
};
DO['tour-mars'] = DO.rovers;
function applyReply(bot, r) {
  const acts = el('div', { class: 'acts' }), small = innerWidth < 900;
  const after = fn => () => { fn(); if (small || document.body.classList.contains('questing')) closeChat(); };
  if (!chatMode && r.go && byId[r.go]) {
    const c = byId[r.go];
    if (c.world === 'moon') {
      openCase(c.id, { quiet: true, reveal: !small });          /* the Moon turns while Hy talks */
      acts.append(el('button', { text: 'Open file ' + c.file + ': ' + c.name, onclick: after(() => openCase(c.id, { quiet: true, reveal: true })) }));
    } else { if (!r.model && c.model) r.model = c.model; if (!r.do) r.do = 'rovers'; }      /* Mars has no map: show its model and offer the quest */
  }
  if (!chatMode && r.model && LBF.MODELS[r.model]) {
    acts.append(el('button', { text: 'Spin the ' + LBF.MODELS[r.model].name + ' in 3D', onclick: after(() => { showModel(r.model); goTo('#models')(); }) }));
  }
  if (!chatMode && r.do && DO[r.do]) acts.append(el('button', { text: DO[r.do][0], onclick: after(DO[r.do][1]) }));
  if (r.act) acts.append(el('button', { text: r.act[0], onclick: after(r.act[1]) }));
  if (acts.children.length) bot.append(acts);
}

/* "What do I do now?": inside a puzzle Hy explains this step; anywhere else he points at the next quest */
function whatNow() {
  const k = Help.current(), H = LBF.HELP;
  if (k) return { text: H[k] };
  if (document.body.classList.contains('questing')) return { text: H.watch };
  const L = Notebook.left();
  if (!L.length) return { text: H['next:done'], act: ['Watch the ending', () => Finale.play()] };
  if (document.body.classList.contains('locked')) return { text: H['next:0'], act: ['Take me there', goTo('#story')] };
  return { text: H['next:' + L[0]], act: ['Take me there', goTo(Notebook.where(L[0]))] };
}
/* the mystery game's yes-or-no questions are answered straight from the file, so they always work */
function yesNo(c, q) {
  const A = {
    'Did astronauts go there?': [c.kind === 'crew', 'People walked there.', 'No person has been there.'],
    'Is it a robot lander?': [c.kind === 'lander', 'It landed with nobody on board.', 'Think of people, or of a crash.'],
    'Did it arrive before 1980?': [c.year < 1980, 'It is from the early days.', 'It is newer than that.'],
    'Is it still working?': [c.status === 'active' || c.status === 'mirror', 'One part still does its job.', 'It has gone quiet.'],
    'Did it crash on purpose?': [c.status === 'impact', 'It hit the Moon so scientists could watch.', 'It was meant to land gently.']
  }[q];
  return A ? (A[0] ? 'Yes. ' + A[1] : 'No. ' + A[2]) : 'Tap one of the questions below, partner.';
}
/* a machine answering from its own file, when the live AI is away */
function asMachine(c, q) {
  const i = ASK_THEM.indexOf(q), first = (c.story.match(/^.*?[.!?](?=\s|$)/) || [c.story])[0];
  if (i === 0) return 'I reached ' + WORLD_NAME[c.world] + ' on ' + c.date + ', at ' + c.site + '. My file says: ' + first;
  if (i === 1) return 'Here is what my file says. ' + c.science;
  if (i === 2) return ({ active: 'Yes! I am still working today.', mirror: 'Yes. My mirror needs no power, so lasers still bounce off it.', silent: 'No. I have gone quiet, but I am still here.', impact: 'No. I ended my mission by hitting the ground, on purpose.', lost: 'No. Nobody has heard from me.' })[c.status];
  if (i === 3) return 'Still there today: ' + c.left;
  return 'My radio link is weak right now, so here is what my file says. ' + c.story + ' ' + c.science;
}

async function ask(q) {
  q = (q || '').trim(); openChat(); if (!q || busy) return;
  busy = true; chat.classList.remove('helping'); Voice.stop(); addMsg('me', q);          /* the child is talking now, so the box stays open */
  const mode = chatMode, who = mode && mode.type === 'interview' ? byId[mode.id] : null;
  const bot = addMsg(who ? 'them' : 'hy', who ? 'Thinking…' : 'Checking the files…');
  let r = null, live = false;
  if (!mode && q === NOW) r = whatNow();
  else if (mode && mode.type === 'mystery') r = { text: yesNo(byId[mode.id], q) };
  else {
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
      }
    }
    if (!answer && ENDPOINT && performance.now() >= lineDown) {
      try { answer = (await askServer(turns, modeLine || undefined)).trim() || null; }
      catch (err) {                                   /* the line is down: stop ringing it for five minutes, and say so once */
        lineDown = performance.now() + 300000; setMode();
        if (!toldDown) { toldDown = true; addMsg('note', 'The live AI line is resting. Hy is answering from the case files.'); }
      }
    }
    if (answer) { r = parseReply(answer); live = true; }
    else if (who) r = { text: asMachine(who, q) };
    else { const off = offlineAnswer(q); r = { text: off.text, go: off.id, model: off.model, do: off.do }; }
    guideState.think = false;
  }
  bot.textContent = r.text || 'I lost my train of thought. Tap a question again?';
  applyReply(bot, r);
  setChips(live ? r.next : []);
  history.push({ role: 'user', content: q }, { role: 'assistant', content: r.text });
  log.scrollTop = log.scrollHeight;
  busy = false;
  if (!mode && q !== NOW) Notebook.badge('talk');
  Voice.speak(r.text, who ? { pitch: 0.8, rate: 0.98 } : undefined);
}
LBF.ask = ask;
/* everything Hy can say that is fixed text: used to list the lines that still need a recording */
LBF.script = () => {
  const out = ["Voice on. Now I can talk you through the files, partner.", "Pull up a chair, kid. Tap a question and I'll answer. Some answers take you places.", "Tap a yes-or-no question about the mystery machine. I won't say its name.", 'Good eye, detective.', 'A perfect score. You could run this agency, kid.', 'Case closed. You earned your badge, partner.', 'I lost my train of thought. Tap a question again?', 'Tap one of the questions below, partner.'];
  Object.values(QUIPS).forEach(t => out.push(t));
  Missions.lines().forEach(t => out.push(t));
  PROMPTS.filter(q => q !== NOW).forEach(q => out.push(offlineAnswer(q).text));
  out.push(offlineAnswer('zzz').text);
  C.filter(c => c.world === 'moon' && c.id !== 'mpl').forEach(c => { YESNO.forEach(q => out.push(yesNo(c, q))); out.push(offlineAnswer('Tell me more about ' + c.name + '.').text); });
  return [...new Set(out)].map(t => [t, Voice.has(t)]);
};

/* Answers built from the case files, used when live AI is not available. Every question on Hy's list has one. */
function offlineAnswer(q) {
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ') + ' ';
  const has = (...w) => w.some(x => s.includes(x));
  const ALIAS = { pathfinder: ['sojourner', 'pathfinder'], mpl: ['polar lander', 'deep space 2'], grail: ['grail', ' ebb', ' flow '], odysseus: ['odysseus', 'im 1', 'intuitive machines'], athena: ['athena', 'im 2'], blueghost: ['blue ghost', 'firefly', 'nglr'], prospector: ['prospector'], perseverance: ['perseverance', 'percy', 'moxie', 'jezero'], curiosity: ['curiosity', 'gale', 'mount sharp'], ingenuity: ['ingenuity', 'helicopter', ' fly ', 'flew', 'flight'], insight: ['insight', 'marsquake', 'quake'], opportunity: ['opportunity', 'oppy'], phoenix: ['phoenix'], lcross: ['lcross'], ladee: ['ladee'], viking1: ['viking 1', 'viking'], viking2: ['viking 2'], apollo11: ['apollo 11', 'first people', 'first moon landing', 'walked on the moon', 'armstrong', 'aldrin'] };
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
  if (has('tube', 'sample', 'rock core')) return { model: 'percy', do: 'rovers', text: "Still on Mars, kid. Perseverance drills rock cores and seals each one in a tube. By July 2025 it had filled 33 of them, and ten wait on the ground at a spot called Three Forks. The mission to fetch them was cancelled, so NASA is looking for another way to bring them home." };
  if (best && score >= 4) return { id: best.id, text: 'File ' + best.file + ', ' + best.name + '. ' + best.story + ' ' + best.science + ' ' + best.clue };
  if (has('mirror', 'reflector', 'laser')) return { id: 'apollo15', do: 'laser', text: "Apollo 11, 14 and 15 left trays of glass prisms on the Moon. Each prism sends light straight back where it came from. Scientists fire a laser, time the echo (about 2.5 seconds) and get the distance to about a millimeter. That's how we know the Moon drifts away 3.8 cm a year." };
  if (has('still work', 'still active', 'still alive', 'working', 'still driving', 'active', 'still works')) return { model: 'curio', do: 'rovers', text: 'As of November 2026, two machines are still driving on Mars: Curiosity, since 2012, and Perseverance, since 2021. On the Moon, the Apollo laser mirrors and the new Blue Ghost mirror still work, because a mirror needs no power.' };
  if (has('water', ' ice ')) return { id: 'lcross', text: "Plenty of clues, kid. Lunar Prospector found extra hydrogen at the Moon's poles, and LCROSS confirmed water there in 2009. On Mars, Phoenix dug up water ice, and Spirit, Opportunity, Curiosity and Perseverance all found signs of ancient water." };
  if (has('how many', 'list', 'all the')) { const mo = C.filter(c => c.world === 'moon').length, ma = C.length - mo; return { text: 'My cabinet holds ' + mo + ' Moon files and ' + ma + ' Mars files. They cover every NASA lander, rover and helicopter that reached Mars, the Apollo and Surveyor sites, and the most important crash sites. There is even more out there: spent rocket stages, old orbiters and landing gear.' }; }
  if (has('first') && has('mars')) best = byId.viking1, score = 5;
  else if (has('first') && has('rover')) best = byId.pathfinder, score = 5;
  else if (has('first') && has('moon')) best = byId.surveyor1, score = 5;
  if (has('farthest', 'furthest', 'record', 'longest drive')) best = byId.perseverance, score = 5;
  if (has('lost', 'missing', 'never found', 'disappear')) best = byId.mpl, score = 5;
  if (has('car', 'buggy', 'lunar rover', 'moon rover')) best = byId.apollo15, score = 5;
  if (best && score >= 4) return { id: best.id, text: 'File ' + best.file + ', ' + best.name + '. ' + best.story + ' ' + best.science + ' ' + best.clue };
  return { text: "That one is not in my files, partner. Tap one of the questions below." };
}

PROMPTS.forEach(q => $('#ask-qs').append(el('button', { type: 'button', text: q, onclick: () => ask(q) })));
setChips();
$('#chat-x').addEventListener('click', closeChat);
$('#guide-btn').addEventListener('click', () => { chat.classList.contains('open') ? closeChat() : openChat(); });
$('#bubble-ask').addEventListener('click', openChat);
$$('[data-ask]').forEach(b => b.addEventListener('click', () => ask(b.dataset.ask)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });

/* ───────────────────────── Hy steps in when the child is stuck ───────────────────────── */
/* Every puzzle reports which part the child is on, and a number that grows when they get somewhere.
   Ten seconds on one part with no progress, and Hy's chat opens by itself with what to do. He says it once per part. */
const Help = (function () {
  const LIMIT = 10;
  let key = null, best = null, idle = 0, told = {}, shown = false, gains = 0, last = 0;
  function give(k) {
    const b = document.body.classList;
    if (b.contains('intro-on') || b.contains('finale-on') || chatMode || busy) return false;
    greeted = true; chat.classList.add('open', 'helping'); guide.classList.add('chatting'); shown = true; gains = 0;
    addMsg('hy help', LBF.HELP[k]); setChips(); Sfx.tick(); G.react('yes'); Voice.speak(LBF.HELP[k]);
    return true;
  }
  function part(k, dt, prog) {
    const now = performance.now(); dt = Math.max(dt || 0, Math.min(1, (now - last) / 1000)); last = now;      /* real seconds, even when a slow device draws few frames */
    if (!k || !LBF.HELP[k]) k = null;
    if (k !== key) {
      if (shown && chat.classList.contains('helping')) closeChat();          /* that part is behind them: Hy steps back */
      shown = false; key = k; best = prog == null ? null : prog; idle = 0; return;
    }
    if (!k) return;
    if (prog != null && (best == null || prog > best)) {
      best = prog; idle = 0;
      if (shown && ++gains >= 3 && chat.classList.contains('helping')) { closeChat(); shown = false; }      /* they have got the idea: Hy steps back */
      return;
    }
    idle += dt;
    if (idle >= LIMIT && !told[k]) { if (give(k)) told[k] = 1; else idle = LIMIT - 3; }
  }
  return { part, current: () => key, fresh(prefix) { for (const k in told) if (k.indexOf(prefix) === 0) delete told[k]; } };
})();
/* puzzles that live on the page (not inside a quest) are checked twice a second */
setInterval(() => {
  if (document.hidden || document.body.classList.contains('questing')) return;
  let r = null; for (const f of PARTS) { r = f(); if (r) break; }
  Help.part(r && r[0], 0.5, r ? r[1] : null);
}, 500);

/* ───────────────────────── The ending: a ten-second scene, then the credits ───────────────────────── */
/* It plays once all six quests are done. Hy appears between the Moon and Mars, says well done, hands over a medal,
   wishes the child luck and flies off into the stars. Then the credits roll. */
const Finale = (function () {
  const box = $('#finale'), F = LBF.FINALE; if (!box || !F) return { play() {}, queue() {} };
  const hy = $('#fin-hy'), lineEl = $('#fin-line'), medal = $('#fin-medal'), star = $('#fin-star'), credits = $('#fin-credits'), roll = $('#fin-roll'), endEl = $('#fin-end'), skip = $('#fin-skip'), flashEl = $('#fin-flash'), room = $('#fin-room'), fade = $('#fin-fade');
  const M = window.LBF_MEDIA || {}, vids = {};
  let on = false, timers = [], typing = null, rollAnim = null, ready = null;
  const at = (s, fn) => timers.push(setTimeout(() => { if (on) fn(); }, s * 1000));
  /* Hy's four clips, sharper than the little ones in the corner; each falls back to the small clip if its file is missing */
  function load() {
    if (ready) return ready;
    ready = Promise.all(['appear', 'speaking', 'moving', 'yes', 'disappear'].map(n => new Promise(res => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.preload = 'auto'; v.loop = n === 'speaking' || n === 'moving';
      let tried = false; const ok = () => res();
      v.addEventListener('canplaythrough', ok, { once: true });
      v.addEventListener('error', () => { if (!tried && M[n]) { tried = true; v.src = M[n]; } else ok(); });
      v.src = 'assets/fin-' + n + '.mp4'; hy.firstElementChild.append(v); vids[n] = v; setTimeout(ok, 3500);
    })));
    return ready;
  }
  function show(n, from) {
    const v = vids[n]; if (!v) return;
    try { v.currentTime = from || 0; } catch (_) {}
    const swap = () => { for (const k in vids) { vids[k].classList.toggle('on', vids[k] === v); if (vids[k] !== v) vids[k].pause(); } };
    const p = v.play(); if (p && p.then) p.then(swap).catch(swap); else swap();
  }
  function caption(text) {                          /* typed out like the rest of Hy's lines, and spoken if his voice is on */
    clearInterval(typing); lineEl.classList.remove('out'); Voice.speak(text);
    const t0 = performance.now(); lineEl.textContent = '';                  /* by the clock, so a slow device still finishes the line on time */
    typing = setInterval(() => { const i = Math.floor((performance.now() - t0) / 26) + 1; lineEl.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typing); }, 26);
  }
  function flash() { flashEl.style.transition = 'none'; flashEl.style.opacity = 0.75; void flashEl.offsetWidth; flashEl.style.transition = 'opacity .5s ease-out'; flashEl.style.opacity = 0; }
  function clearAll() { timers.forEach(clearTimeout); timers = []; clearInterval(typing); if (rollAnim) { try { rollAnim.cancel(); } catch (_) {} rollAnim = null; } }
  function resetLook() {
    box.className = ''; hy.className = ''; medal.className = ''; medal.hidden = true; star.className = ''; room.className = ''; fade.className = ''; lineEl.textContent = ''; lineEl.classList.remove('out');
    credits.hidden = true; endEl.hidden = true; skip.hidden = false; roll.style.transform = '';
    for (const k in vids) { vids[k].classList.remove('on'); vids[k].pause(); }
  }
  function buildCredits() {
    roll.replaceChildren(...F.credits.map(([head, names], n) => el('div', { class: 'cr' + (n === 0 ? ' title' : '') }, head ? el('p', { class: 'cr-h', text: head }) : '', ...names.map(t => el('p', { class: 'cr-n', text: t })))));
  }
  function rollCredits() {
    lineEl.classList.add('out'); medal.classList.add('pin'); credits.hidden = false; buildCredits();
    const H = credits.clientHeight, h = roll.scrollHeight, speed = Math.max(70, H * 0.11);          /* pixels a second: a line stays on screen about nine seconds */
    if (!roll.animate) return end();
    rollAnim = roll.animate([{ transform: 'translateY(' + H + 'px)' }, { transform: 'translateY(' + (-h) + 'px)' }], { duration: (H + h) / speed * 1000, easing: 'linear', fill: 'forwards' });
    rollAnim.onfinish = () => { if (on) end(); };
  }
  function end() {                                  /* the last card: thank you, and two buttons */
    clearAll(); box.classList.add('go', 'done'); hy.className = 'gone'; room.className = ''; fade.className = ''; if (LBF.finale3d) LBF.finale3d.out(); medal.hidden = false; medal.classList.add('fly', 'landed', 'pin'); lineEl.textContent = ''; credits.hidden = true; endEl.hidden = false; skip.hidden = true;
    Notebook.badge('medal'); const b = $('#fin-back'); if (b) try { b.focus({ preventScroll: true }); } catch (_) {}
  }
  function still() {                                /* for visitors who asked for less motion: the same words, the medal and the credits, standing still */
    box.classList.add('go', 'still'); medal.hidden = false; medal.classList.add('fly', 'landed'); lineEl.textContent = F.lines.join(' '); buildCredits(); credits.hidden = false; endEl.hidden = false; skip.hidden = true; Notebook.badge('medal');
  }
  /* about 25 seconds: Mars, the flight to Earth, the child's room, the medal, and back out into space */
  function scene() {
    box.classList.add('go');                                            /* the black bars slide in: this is a film now */
    at(0.6, () => { show('appear', 0.3); hy.classList.add('in'); Sfx.whoosh(); });
    at(1.6, () => caption(F.lines[0]));
    at(2.0, () => show('speaking'));
    at(3.9, () => { show('moving'); hy.classList.add('fly'); lineEl.classList.add('out'); if (LBF.finale3d) LBF.finale3d.fly(); Sfx.whoosh(); });      /* off to Earth */
    at(7.0, () => Sfx.whoosh());
    at(11.6, () => { hy.classList.remove('fly'); hy.classList.add('dip'); });                                  /* he dives at one small light on the night side */
    at(12.0, () => { room.classList.add('in'); Sfx.rumble(); });                                               /* and there is a child, on this very website */
    at(13.4, () => { show('appear', 0.3); hy.classList.remove('dip'); Sfx.ping(); });                         /* Hy comes out of the screen */
    at(14.6, () => { caption(F.lines[1]); show('speaking'); });
    at(15.6, () => { show('yes'); medal.hidden = false; medal.classList.add('fly'); Sfx.tick(); });
    at(16.9, () => { medal.classList.add('landed'); flash(); Sfx.win(); });
    at(17.7, () => show('speaking'));
    at(18.2, () => caption(F.lines[2]));
    at(21.0, () => { room.classList.remove('in'); room.classList.add('out'); medal.classList.add('pin'); lineEl.classList.add('out'); if (LBF.finale3d) LBF.finale3d.out(); Sfx.whoosh(); });   /* pull back: the room, the city, the whole Earth */
    at(22.3, () => { show('disappear', 2.0); hy.classList.add('away'); });
    at(23.5, () => { star.classList.add('on'); Sfx.ping(); });
    at(24.0, () => fade.classList.add('on'));
    at(25.0, () => { fade.classList.remove('on'); rollCredits(); });
  }
  function play() {
    if (on) return; on = true; clearAll(); resetLook();
    closeChat(); Missions.stopAll(); Voice.stop();
    document.body.classList.add('questing', 'finale-on'); box.hidden = false;
    Music.scene('m-hour-end'); if (LBF.finale3d) LBF.finale3d.start();
    try { localStorage.setItem('lbf-finale', '1'); } catch (_) {}
    if (RM) return still();
    load().then(() => { if (on) scene(); });
  }
  function close() {
    if (!on) return; on = false; clearAll(); Voice.stop(); Music.scene(null); if (LBF.finale3d) LBF.finale3d.stop();
    box.hidden = true; document.body.classList.remove('questing', 'finale-on'); resetLook();
    say(F.bye, true);
  }
  /* the sixth quest has just been finished: wait until the child is back on the page and not mid-sentence with Hy, then roll */
  function queue() {
    let waited = 0;
    const iv = setInterval(() => {
      waited += 0.5; const b = document.body.classList;
      if (on) return clearInterval(iv);
      if (b.contains('questing') || b.contains('intro-on') || busy) return;
      if (waited >= 2.5 && (!chat.classList.contains('open') || waited >= 14)) { clearInterval(iv); play(); }
    }, 500);
  }
  skip.addEventListener('click', end);
  $('#fin-back').addEventListener('click', close);
  $('#fin-again').addEventListener('click', () => { on = false; clearAll(); if (LBF.finale3d) LBF.finale3d.stop(); play(); });
  const open = $('#fin-open'); if (open) open.addEventListener('click', play);
  document.addEventListener('keydown', e => { if (on && e.key === 'Escape') { if (endEl.hidden) end(); else close(); } });
  Notebook.whenAll(queue);
  return { play, close, queue, isOn: () => on };
})();
LBF.finale = Finale;

/* ───────────────────────── Quest gate: the page opens one stop at a time ───────────────────────── */
(function () {
  const can3d = !document.body.classList.contains('no3d') && LBF.walk;
  document.body.classList.add('locked');                    /* every visit starts at Quest 1 */
  if (!can3d) ['#mirrors', '#mars', '#models'].forEach(Notebook.skip);      /* without 3D graphics those quests cannot be played, so they do not block the ending */
  const go = () => { if (can3d) LBF.walk.start(); else { document.body.classList.remove('locked'); Notebook.skip('#moon'); $('#moon').scrollIntoView(); } };
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
  let idx = -1, running = false, finished = false;
  function finish() { if (finished) return; finished = true; timers.forEach(clearTimeout); if (audio) { try { audio.pause(); } catch (_) {} } $('#intro-go').hidden = false; v.pause(); }
  function schedule(from, lead) {            /* show line `from` now (or after `lead` seconds) and the rest on their cues */
    timers.forEach(clearTimeout); timers = []; const base = CUES[from] - (lead || 0);
    for (let i = from; i < LINES.length; i++) timers.push(setTimeout(() => { if (!over) { idx = i; line.textContent = LINES[i]; } }, (CUES[i] - base) * 1000));
    timers.push(setTimeout(finish, (13 - base) * 1000));
  }
  function run(withSound) {
    meet.hidden = true; running = true;
    v.src = M.appear; v.loop = false; v.play().catch(() => {});
    v.onended = () => { v.onended = null; v.src = M.speaking; v.loop = true; v.play().catch(() => {}); };
    if (withSound) {
      audio = new Audio('audio/intro.mp3'); audio.onended = finish;
      const p = audio.play(); if (p && p.catch) p.catch(() => {});
      schedule(0);
    } else schedule(0, 0.4);
  }
  /* Enter skips the line Hy is on and jumps to the next one; after the last line it opens the site */
  addEventListener('keydown', e => {
    if (e.key !== 'Enter' || over || !running) return; e.preventDefault();
    if (finished) return done();
    const n = idx + 1; if (n >= LINES.length) return finish();
    idx = n; line.textContent = LINES[n]; if (audio) { try { audio.currentTime = CUES[n]; } catch (_) {} } schedule(n);
  });
  function done() {
    if (over) return; over = true; timers.forEach(clearTimeout); if (audio) { try { audio.pause(); } catch (_) {} }
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

/* every quest on the page gets a "Skip quest" button: it ticks the quest and moves on to the next stop */
$$('.game').forEach(g => {
  const sec = g.closest('section'), nx = sec && sec.querySelector('a.next'), to = nx ? nx.getAttribute('href') : '#sources';
  g.append(skipBtn('Skip quest', () => { if (g._skip) g._skip(); Notebook.skip('#' + sec.id); const t = $(to); if (t) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }));
});
(function () {                                   /* Play with Hy has no single puzzle, so its skip button sits under the four games */
  const row = $('#ask-skip'); if (!row) return;
  row.append(skipBtn('Skip quest', () => { Missions.stopAll(); Notebook.skip('#ask'); $('#quiz').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }));
})();
})();
