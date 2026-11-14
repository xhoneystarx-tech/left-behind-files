/* The Left Behind Files: case data.
   Coordinates: NASA NSSDCA tables (Moon) and published landing-site coordinates (Mars).
   lat = degrees north, lon = degrees east (west is negative). */
window.LBF = window.LBF || {};

/* Public AI server (a Neon Function). Leave empty to use only Claude's built-in page AI and the case files. */
LBF.AI_ENDPOINT = "https://br-royal-star-b3ja2mbl-hy.compute.c-4.ap-southeast-1.aws.neon.tech/";

LBF.STATUS = {
  active:  { label: "Still working",        note: "Sending data home right now" },
  mirror:  { label: "Mirror still in use",  note: "No power needed, lasers still bounce off it" },
  silent:  { label: "Gone quiet",           note: "Mission over, hardware still there" },
  impact:  { label: "Crashed on purpose",   note: "Ended its mission by hitting the surface" },
  lost:    { label: "Never heard from",     note: "Lost during landing" }
};

LBF.KINDS = { lander: "Lander", rover: "Rover", heli: "Helicopter", crew: "Astronaut site", impactor: "Impactor" };

const N = "https://science.nasa.gov/mission/";
const NSSDC_IMPACT = "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html";

LBF.CASES = [
  /* ───────────── MOON ───────────── */
  { id: "ranger7", world: "moon", name: "Ranger 7", kind: "impactor", status: "impact", year: 1964,
    date: "July 31, 1964", site: "Mare Cognitum", lat: -10.634, lon: -20.677,
    left: "A small crater and scattered pieces.",
    story: "Before anyone could land on the Moon, somebody had to get a good look at it. Ranger 7 flew straight at the surface with its cameras rolling and sent home 4,316 photos before it hit.",
    science: "These were the first pictures of the Moon taken by a U.S. spacecraft. They showed the ground in far more detail than any telescope on Earth could.",
    clue: "It was the first U.S. success at the Moon after 13 failures in a row. Space is hard.",
    src: ["NASA Science: Ranger 7", N + "ranger-7/"] },

  { id: "surveyor1", world: "moon", name: "Surveyor 1", kind: "lander", status: "silent", year: 1966,
    date: "June 2, 1966", site: "Oceanus Procellarum", lat: -2.4745, lon: -43.3398,
    left: "The whole lander, standing on its three legs.",
    story: "Nobody knew if the Moon's surface could hold a spacecraft or if it would sink into dust. Surveyor 1 came down gently on three legs and stayed put.",
    science: "It made the first true soft landing by the U.S. and sent back 11,240 photos. It proved the technology for landing and working on the Moon was possible, which cleared the way for astronauts.",
    clue: "It launched on May 30 and landed on June 2. A three-day trip.",
    src: ["NASA Science: Surveyor 1", N + "surveyor-1/"] },

  { id: "surveyor3", world: "moon", name: "Surveyor 3", kind: "lander", status: "silent", year: 1967,
    date: "April 20, 1967", site: "Oceanus Procellarum", lat: -3.0162, lon: -23.418, plot: [-5.4, -25.6],
    left: "The lander, minus the parts Apollo 12 took home.",
    story: "Surveyor 3 carried a robot scoop that dug trenches so scientists could test the soil. Two and a half years later, it had visitors.",
    science: "In November 1969 the Apollo 12 crew landed within walking distance, walked over, and brought pieces of the lander back to Earth, including its camera. Engineers studied them to learn how machines age on the Moon.",
    clue: "So far it is the only robot on another world that people have walked up to and touched.",
    src: ["NASA NSSDCA: Surveyor program", "https://nssdc.gsfc.nasa.gov/planetary/lunar/surveyor.html"] },

  { id: "surveyor5", world: "moon", name: "Surveyor 5", kind: "lander", status: "silent", year: 1967,
    date: "September 11, 1967", site: "Mare Tranquillitatis", lat: 1.4551, lon: 23.1943,
    left: "The whole lander.",
    story: "Surveyor 5 brought a tiny chemistry kit. Its alpha-scattering instrument could work out what the soil was made of without a single test tube.",
    science: "It made the first chemical analysis of the surface of another world. The soil looked a lot like basalt, a dark volcanic rock that is common on Earth.",
    clue: "It sits in the same lunar 'sea' where Apollo 11 landed two years later.",
    src: ["NASA NSSDCA: Surveyor program", "https://nssdc.gsfc.nasa.gov/planetary/lunar/surveyor.html"] },

  { id: "surveyor6", world: "moon", name: "Surveyor 6", kind: "lander", status: "silent", year: 1967,
    date: "November 10, 1967", site: "Sinus Medii", lat: 0.4742, lon: -1.4275,
    left: "The whole lander, 2.5 meters from where it first touched down.",
    story: "A week after landing, mission control fired its thrusters for 2.5 seconds. Surveyor 6 rose about 3 meters and came back down 2.5 meters to the west.",
    science: "That little hop was the first liftoff from another world. The lander also sent back 29,952 pictures.",
    clue: "Every rocket that has ever left the Moon owes something to this hop.",
    src: ["NASA Science: Surveyor 6", N + "surveyor-6/"] },

  { id: "surveyor7", world: "moon", name: "Surveyor 7", kind: "lander", status: "silent", year: 1968,
    date: "January 10, 1968", site: "Rim of Tycho crater", lat: -40.9812, lon: -11.5127,
    left: "The whole lander.",
    story: "The last Surveyor skipped the flat plains and went to the rugged highlands beside the bright crater Tycho.",
    science: "With a scoop, magnets on its feet and a chemistry instrument, it let scientists compare highland soil with the dark plains the earlier Surveyors tested.",
    clue: "Tycho is the crater with the long bright rays. You can spot it with binoculars.",
    src: ["NASA NSSDCA: Surveyor program", "https://nssdc.gsfc.nasa.gov/planetary/lunar/surveyor.html"] },

  { id: "apollo11", world: "moon", name: "Apollo 11", kind: "crew", status: "mirror", year: 1969,
    date: "July 20, 1969", site: "Sea of Tranquility", lat: 0.67416, lon: 23.47314, model: "lm",
    left: "The bottom half of the lander Eagle, a laser mirror, a moonquake detector, a flag and a plaque.",
    story: "The first two people to walk on the Moon set up their experiments, then flew home in the top half of their lander. The bottom half is still there.",
    science: "The mirror they left is a tray of 100 small glass prisms. It still bounces laser light back to Earth, and it is the only Apollo experiment that never stopped working.",
    clue: "Each prism is 3.8 cm across, about the width of a ping-pong ball.",
    src: ["NASA JPL: Apollo 11 experiment still going strong", "https://www.jpl.nasa.gov/news/apollo-11-experiment-still-going-strong-after-35-years/"] },

  { id: "apollo12", world: "moon", name: "Apollo 12", kind: "crew", status: "silent", year: 1969,
    date: "November 19, 1969", site: "Ocean of Storms", lat: -3.0128, lon: -23.4219, model: "lm",
    left: "The bottom half of the lander Intrepid and a science station.",
    story: "Apollo 12 made a pinpoint landing right next to an old robot: Surveyor 3. The crew walked over to it and collected parts.",
    science: "They also set up a science station with a moonquake detector and instruments to study the solar wind, the stream of particles (mostly hydrogen) that blows off the Sun.",
    clue: "The pin for this file sits almost on top of Surveyor 3's. That is not a mistake.",
    src: ["NASA NSSDCA: Apollo landing site coordinates", "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"] },

  { id: "apollo14", world: "moon", name: "Apollo 14", kind: "crew", status: "mirror", year: 1971,
    date: "February 5, 1971", site: "Fra Mauro", lat: -3.64589, lon: -17.47194, model: "lm",
    left: "The bottom half of the lander Antares, a laser mirror, a science station and a two-wheeled handcart.",
    story: "The crew pulled their tools around in a handcart and left a second laser mirror, a twin of the one at Apollo 11.",
    science: "With more than one mirror, scientists can measure how the Moon wobbles and flexes, not just how far away it is.",
    clue: "Two golf balls are here too. Astronaut Alan Shepard hit them with a club he made from a sampling tool.",
    src: ["NASA ILRS: Lunar reflectors", "https://ilrs.gsfc.nasa.gov/missions/satellite_missions/current_missions/ap11_reflector.html"] },

  { id: "apollo15", world: "moon", name: "Apollo 15", kind: "crew", status: "mirror", year: 1971,
    date: "July 30, 1971", site: "Hadley Rille", lat: 26.13239, lon: 3.6333, model: "lm",
    left: "The bottom half of the lander Falcon, the first Moon car, a science station and the biggest laser mirror.",
    story: "Apollo 15 brought the first car to the Moon, the battery-powered Lunar Roving Vehicle. The crew drove it 27.8 km, then parked it for good.",
    science: "Its mirror has 300 prisms, three times as many as the others, so it sends back the strongest signal. Most laser measurements of the Moon use this one.",
    clue: "A camera on the parked rover filmed the crew blasting off for home.",
    src: ["NASA NSSDCA: The Apollo Lunar Roving Vehicle", "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html"] },

  { id: "apollo16", world: "moon", name: "Apollo 16", kind: "crew", status: "silent", year: 1972,
    date: "April 21, 1972", site: "Descartes Highlands", lat: -8.9734, lon: 15.5011, model: "lm",
    left: "The bottom half of the lander Orion, a Moon car and a science station.",
    story: "Apollo 16 was the first crew to explore the lunar highlands. Their rover covered 26.7 km.",
    science: "Rocks from here showed the highlands were shaped mostly by giant impacts, not volcanoes as many scientists had expected.",
    clue: "Three Moon cars were driven on the Moon. All three are still parked where the crews left them.",
    src: ["NASA NSSDCA: The Apollo Lunar Roving Vehicle", "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html"] },

  { id: "apollo17", world: "moon", name: "Apollo 17", kind: "crew", status: "silent", year: 1972,
    date: "December 11, 1972", site: "Taurus-Littrow valley", lat: 20.1911, lon: 30.7723, model: "lm",
    left: "The bottom half of the lander Challenger, a Moon car and a science station.",
    story: "The last Apollo crew stayed three days and drove their rover 35.9 km, farther than any other crew.",
    science: "One of the two moonwalkers, Harrison Schmitt, was a geologist. The rover let the crew reach rocks up to 7.6 km from their lander.",
    clue: "As of 2026, nobody has walked on the Moon since this crew left.",
    src: ["NASA NSSDCA: The Apollo Lunar Roving Vehicle", "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html"] },

  { id: "prospector", world: "moon", name: "Lunar Prospector", kind: "impactor", status: "impact", year: 1999,
    date: "July 31, 1999", site: "Shoemaker crater, south pole", lat: -87.7, lon: 42.0,
    left: "Wreckage in a crater that never sees sunlight.",
    story: "For about 19 months Lunar Prospector circled the Moon with a detector that can sniff out hydrogen. That's me, kid.",
    science: "It found extra hydrogen at both poles. That was the first direct evidence of water ice hiding in craters where the Sun never shines.",
    clue: "At the end it was steered into a dark crater to kick up water vapor. Telescopes saw none that day, so the case stayed open.",
    src: ["NASA Science: Lunar Prospector", N + "lunar-prospector"] },

  { id: "lcross", world: "moon", name: "LCROSS", kind: "impactor", status: "impact", year: 2009,
    date: "October 9, 2009", site: "Cabeus crater, south pole", lat: -84.6796, lon: -48.7093,
    left: "Two impact sites: a rocket stage and the spacecraft that chased it.",
    story: "An empty rocket stage slammed into a permanently dark crater. Four minutes later LCROSS flew through the cloud of debris, measured it, and then hit the Moon too.",
    science: "The cloud contained water. The impact dug out about 350 tons of material and left a crater about 20 meters wide. The case Lunar Prospector opened was closed.",
    clue: "LCROSS hit at about 9,000 km per hour.",
    src: ["NASA Science: LCROSS", N + "lcross/"] },

  { id: "grail", world: "moon", name: "GRAIL: Ebb and Flow", kind: "impactor", status: "impact", year: 2012,
    date: "December 17, 2012", site: "Near the north pole", lat: 75.6088, lon: -26.594,
    left: "Two small impact sites, side by side.",
    story: "Twin spacecraft named Ebb and Flow chased each other around the Moon. Tiny changes in the gap between them revealed where the Moon's gravity pulls harder.",
    science: "They made the most detailed gravity map of any world. It showed dense lumps under the surface, left behind when huge asteroids hit the young Moon.",
    clue: "The twins were named by schoolchildren in a contest.",
    src: ["NASA Science: GRAIL", N + "grail/"] },

  { id: "ladee", world: "moon", name: "LADEE", kind: "impactor", status: "impact", year: 2014,
    date: "April 18, 2014", site: "Far side, near the edge", lat: 11.8494, lon: -93.2494,
    left: "An impact site on the side of the Moon we never see from Earth.",
    story: "LADEE studied the Moon's incredibly thin atmosphere and the dust that floats above the surface.",
    science: "It also tested sending data with a laser beam instead of radio waves, a faster way to talk across space.",
    clue: "Its full name is the Lunar Atmosphere and Dust Environment Explorer.",
    src: ["NASA NSSDCA: Lunar impact sites", NSSDC_IMPACT] },

  { id: "odysseus", world: "moon", name: "Odysseus (IM-1)", kind: "lander", status: "silent", year: 2024,
    date: "February 22, 2024", site: "Near the south pole", lat: -80.13, lon: 1.44,
    left: "A lander resting on its side.",
    story: "NASA now pays companies to carry its instruments to the Moon. Odysseus, built by Intuitive Machines, was the first of these to land.",
    science: "It was the first U.S. landing on the Moon since Apollo 17 in 1972. It tipped over on touchdown but still sent data home.",
    clue: "More than 51 years passed between Apollo 17 and this landing.",
    src: ["NASA: Timeline of CLPS deliveries (PDF)", "https://www.nasa.gov/wp-content/uploads/2025/07/clps-timeline-graphic-1.pdf"] },

  { id: "blueghost", world: "moon", name: "Blue Ghost Mission 1", kind: "lander", status: "mirror", year: 2025,
    date: "March 2, 2025", site: "Mare Crisium", lat: 18.562, lon: 61.81,
    left: "The lander, 10 NASA instruments and a brand-new laser mirror.",
    story: "Firefly Aerospace's lander delivered 10 NASA instruments and worked for two weeks, until lunar night fell on March 16, 2025.",
    science: "All 10 instruments worked. One probe drilled about 1 meter into the ground to take the Moon's temperature. A new mirror called NGLR has already bounced laser light back to two observatories on Earth.",
    clue: "It also watched an eclipse from the Moon: Earth sliding in front of the Sun.",
    src: ["NASA: Blue Ghost science data received", "https://www.nasa.gov/blogs/missions/2025/03/14/nasa-science-data-received-blue-ghost-captures-eclipse-from-moon"] },

  { id: "athena", world: "moon", name: "Athena (IM-2)", kind: "lander", status: "silent", year: 2025,
    date: "March 6, 2025", site: "Mons Mouton, south pole", lat: -84.7906, lon: 29.1957,
    left: "A lander on its side, carrying a NASA ice drill.",
    story: "Four days after Blue Ghost, a second company lander reached the Moon. Athena was headed for the south pole with a NASA drill built to look for ice.",
    science: "It reached the surface but ended up on its side, so the mission was cut short. Every attempt teaches engineers how to land near the pole, where the ice is.",
    clue: "This is the closest any lander on this list has come to the south pole.",
    src: ["NASA NSSDCA: Lunar impact sites", NSSDC_IMPACT] },

  /* ───────────── MARS ───────────── */
  { id: "viking1", world: "mars", name: "Viking 1", kind: "lander", status: "silent", year: 1976,
    date: "July 20, 1976", site: "Chryse Planitia", lat: 22.48, lon: -49.97, model: "viking",
    left: "The whole lander.",
    story: "Viking 1 made the first truly successful landing on Mars and sent home the first photos from the ground, including a wide panorama of a rusty, rocky plain.",
    science: "It scooped up soil and tested it for life. One experiment gave a weak hint, but the test for carbon-based chemicals came back empty, so scientists could not call it life. It also logged temperatures from -86 °C to -33 °C.",
    clue: "It worked for more than six years. Its last message arrived on November 11, 1982, after a faulty command from Earth cut the connection.",
    src: ["NASA Science: Viking 1", N + "viking-1/"] },

  { id: "viking2", world: "mars", name: "Viking 2", kind: "lander", status: "silent", year: 1976,
    date: "September 3, 1976", site: "Utopia Planitia", lat: 47.97, lon: 134.26, model: "viking",
    left: "The whole lander.",
    story: "Viking 1's twin landed on the other side of the planet, much farther north.",
    science: "Its cameras caught a thin layer of water frost on the ground in winter. Together the two Vikings showed that Mars has seasons and weather.",
    clue: "Its last data reached Earth on April 11, 1980.",
    src: ["NASA JPL: Viking Lander mission", "https://pds-imaging.jpl.nasa.gov/portal/vikingl_mission.html"] },

  { id: "pathfinder", world: "mars", name: "Mars Pathfinder and Sojourner", kind: "rover", status: "silent", year: 1997,
    date: "July 4, 1997", site: "Ares Vallis", lat: 19.33, lon: -33.55,
    left: "A lander, its deflated airbags, and a rover the size of a microwave oven.",
    story: "Pathfinder landed wrapped in airbags. It bounced about 15 times and rolled to a stop a kilometer away. Then a little 10.6 kg rover named Sojourner rolled down a ramp.",
    science: "Sojourner was the first rover on Mars. The team got over 16,500 pictures from the lander and 550 from the rover. Rounded pebbles at the site suggested water once flowed there.",
    clue: "The last data arrived on September 27, 1997. The rover had lasted about 12 times longer than planned.",
    src: ["NASA Science: Mars Pathfinder", N + "mars-pathfinder/"] },

  { id: "mpl", world: "mars", name: "Mars Polar Lander", kind: "lander", status: "lost", year: 1999,
    date: "December 3, 1999", site: "Near the south pole", lat: -76, lon: 165, coordNote: "Target area: about 76°S, 165°E. The exact spot is unknown.",
    left: "Nobody knows exactly. It has never been found for certain.",
    story: "Mars Polar Lander was sent to dig for ice near the south pole. It went quiet during landing and was never heard from again. Two small probes riding along, called Deep Space 2, were lost too.",
    science: "Engineers worked out the most likely cause: the computer probably mistook a jolt from the legs unfolding for touchdown and shut the engines off too early. NASA changed how it tests landers because of it.",
    clue: "Nine years later the Phoenix lander did the job this one never got to do.",
    src: ["NASA: 25 years of continuous robotic Mars exploration", "https://www.nasa.gov/history/25-years-of-continuous-robotic-mars-exploration-from-pathfinder-to-perseverance"] },

  { id: "spirit", world: "mars", name: "Spirit", kind: "rover", status: "silent", year: 2004,
    date: "January 3, 2004", site: "Gusev Crater", lat: -14.57, lon: 175.47, model: "mer",
    left: "A golf-cart-sized rover, stuck in soft sand.",
    story: "Spirit was built for a 90-day mission and kept going for more than six years, driving 7.73 km. In 2009 it got stuck in soft sand. It last called home around March 22, 2010.",
    science: "In 2007 Spirit uncovered patches of nearly pure silica. On Earth that forms around hot springs and steam vents, so early Mars was much wetter than it looks today.",
    clue: "The silica turned up because a broken wheel dragged through the dirt and dug a trench.",
    src: ["NASA Science: Spirit", N + "mer-spirit/"] },

  { id: "opportunity", world: "mars", name: "Opportunity", kind: "rover", status: "silent", year: 2004,
    date: "January 24, 2004", site: "Meridiani Planum", lat: -1.95, lon: -5.53, model: "mer",
    left: "A golf-cart-sized rover in Perseverance Valley.",
    story: "Spirit's twin was also built for 90 days. It drove 45.16 km over more than 14 years. A dust storm that covered the whole planet blocked its solar panels, and it last called home on June 10, 2018.",
    science: "Opportunity found evidence that Mars may once have been able to support tiny living things, and a gully that looks like it was carved by flowing water.",
    clue: "It rolled to a stop inside a small crater on landing. Mission scientists called it a hole in one.",
    src: ["NASA Science: Opportunity", N + "mer-opportunity/"] },

  { id: "phoenix", world: "mars", name: "Phoenix", kind: "lander", status: "silent", year: 2008,
    date: "May 25, 2008", site: "Green Valley, Martian arctic", lat: 68.22, lon: -125.75,
    left: "The whole lander, on the arctic plains.",
    story: "Phoenix landed in the far north and used a robot arm to dig trenches. Bright clumps showed up in the bottom of one.",
    science: "The clumps were water ice, just below the surface. Phoenix also found a salt called perchlorate, which could be food for microbes and a useful resource for future explorers.",
    clue: "Phoenix ran on sunlight. When arctic winter came, the light faded and the mission ended on November 2, 2008.",
    src: ["NASA Science: Phoenix", N + "phoenix/"] },

  { id: "curiosity", world: "mars", name: "Curiosity", kind: "rover", status: "active", year: 2012,
    date: "August 6, 2012", site: "Gale Crater", lat: -4.59, lon: 137.44,
    left: "Nothing yet. It is still driving.",
    story: "Curiosity is the size of a small car and weighs 899 kg. It carries 17 cameras, a drill, a laser that zaps rocks, and a chemistry lab. It has been climbing a mountain called Mount Sharp for years.",
    science: "Early on it found that Gale Crater once had the right conditions for life. It has also found the largest carbon-based molecules ever detected on Mars.",
    clue: "It passed 5,000 Martian days in August 2026 and has climbed a full kilometer up the mountain. One of its instruments hunts for hydrogen underground. Flattering.",
    src: ["NASA Science: Curiosity", N + "msl-curiosity/"] },

  { id: "insight", world: "mars", name: "InSight", kind: "lander", status: "silent", year: 2018,
    date: "November 26, 2018", site: "Elysium Planitia", lat: 4.502, lon: 135.623, model: "insight",
    left: "The lander, two dusty solar panels and a quake detector sitting on the ground.",
    story: "InSight did not go anywhere. It put a very sensitive quake detector on the ground and listened to the inside of Mars for four years.",
    science: "It detected 1,319 marsquakes. The way those rumbles travelled through the planet let scientists map its crust, mantle and core for the first time.",
    clue: "Dust slowly buried its solar panels. Its last message arrived on December 15, 2022.",
    src: ["NASA Science: InSight", N + "insight/"] },

  { id: "perseverance", world: "mars", name: "Perseverance", kind: "rover", status: "active", year: 2021,
    date: "February 18, 2021", site: "Jezero Crater", lat: 18.44, lon: 77.45, model: "percy",
    left: "Nothing yet. It is still driving, and still filling sample tubes.",
    story: "Perseverance explores a crater that once held a lake. It drills out pencil-sized rock cores and seals them in tubes that a future mission could bring to Earth.",
    science: "It found signs of an ancient lake, river and delta. One rock sample showed possible signs of ancient microbes, though scientists say more study is needed. Its MOXIE experiment made oxygen out of Martian air.",
    clue: "On October 11, 2026 it reached 45.22 km, the farthest any vehicle has driven on another world. The old record was Opportunity's.",
    src: ["NASA Science: Perseverance", N + "mars-2020-perseverance/"] },

  { id: "ingenuity", world: "mars", name: "Ingenuity", kind: "heli", status: "silent", year: 2021,
    date: "First flight April 19, 2021", site: "Valinor Hills, Jezero Crater", lat: 18.44, lon: 77.45, plot: [20.4, 75.2], coordNote: "Landed with Perseverance at 18.44°N, 77.45°E. It now rests a few kilometers away.", model: "ingenuity",
    left: "A 1.8 kg helicopter with a broken rotor blade, standing on a sand ripple.",
    story: "Ingenuity rode to Mars under Perseverance's belly. The plan was no more than five test flights in 30 days. It flew 72 times.",
    science: "It proved that powered flight works in air about 1% as thick as Earth's. It spent 128.8 minutes in the air and covered 17 km, scouting ahead for the rover.",
    clue: "Its last flight was January 18, 2024. It carries a tiny piece of fabric from the Wright brothers' first airplane.",
    src: ["NASA Science: Ingenuity Mars Helicopter", N + "mars-2020-perseverance/ingenuity-mars-helicopter/"] }
];

LBF.MODELS = {
  lm:        { name: "Apollo Lunar Module", file: "lm.glb",        note: "Six of these landed between 1969 and 1972. The bottom half of each one, with the legs, is still on the Moon.", cases: ["apollo11","apollo12","apollo14","apollo15","apollo16","apollo17"] },
  viking:    { name: "Viking lander",       file: "viking.glb",    note: "Two identical landers reached Mars in 1976. The dish on top talked straight to Earth.", cases: ["viking1","viking2"] },
  mer:       { name: "Spirit and Opportunity", file: "mer.glb",    note: "Twin rovers the size of a golf cart. The flat deck is all solar panel. This is NASA's simplified model.", cases: ["spirit","opportunity"] },
  insight:   { name: "InSight lander",      file: "insight.glb",   note: "The two round solar panels opened like fans. The arm lifted the quake detector onto the ground.", cases: ["insight"] },
  percy:     { name: "Perseverance rover",  file: "percy.glb",     note: "Car-sized, with six wheels and a mast full of cameras. The drill is on the end of the arm.", cases: ["perseverance"] },
  ingenuity: { name: "Ingenuity helicopter", file: "ingenuity.glb", note: "Two rotors, one above the other, spinning in opposite directions. The whole thing weighs 1.8 kg.", cases: ["ingenuity"] }
};

LBF.OVER = [
  { name: "Sojourner",   plan: "7 days",     did: "83 days",            x: 12 },
  { name: "Ingenuity",   plan: "5 flights",  did: "72 flights",         x: 14 },
  { name: "Spirit",      plan: "90 days",    did: "over 6 years",       x: 25 },
  { name: "Opportunity", plan: "90 days",    did: "over 14 years",      x: 57 }
];

LBF.QUIZ = [
  { q: "Which Apollo experiment is still working today?",
    a: ["The flags", "The laser mirrors", "The Moon cars", "The TV cameras"], ok: 1,
    why: "The mirrors need no power. Lasers on Earth still bounce off them." },
  { q: "Ingenuity was planned for no more than 5 flights. How many did it make?",
    a: ["9", "27", "72", "150"], ok: 2,
    why: "72 flights, with 128.8 minutes in the air." },
  { q: "What did Lunar Prospector's detector find at the Moon's poles?",
    a: ["Gold", "Hydrogen, a sign of water ice", "Fossils", "Lava"], ok: 1,
    why: "Extra hydrogen in craters that never see sunlight. LCROSS later confirmed water." },
  { q: "As of October 2026, which machine has driven farthest on another world?",
    a: ["Apollo 17's Moon car", "Opportunity", "Curiosity", "Perseverance"], ok: 3,
    why: "Perseverance passed Opportunity's 45.16 km on October 11, 2026." },
  { q: "Surveyor 6 was the first spacecraft to do what?",
    a: ["Lift off from another world", "Orbit the Moon", "Find water", "Carry astronauts"], ok: 0,
    why: "It hopped about 3 meters up and landed 2.5 meters away." },
  { q: "What finally ended InSight's mission on Mars?",
    a: ["A marsquake", "It drove off a cliff", "Dust covering its solar panels", "A meteorite"], ok: 2,
    why: "Dust built up on its panels until it ran out of power in December 2022." }
];

LBF.SOURCES = [
  { group: "NASA coordinates and mission lists", items: [
    ["NSSDCA: Impact sites of spacecraft on the Moon (dates and coordinates)", NSSDC_IMPACT],
    ["NSSDCA: Apollo landing site coordinates", "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"],
    ["NSSDCA: Surveyor program", "https://nssdc.gsfc.nasa.gov/planetary/lunar/surveyor.html"],
    ["NSSDCA: The Apollo Lunar Roving Vehicle", "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html"],
    ["NSSDCA: Chronology of Mars exploration", "https://nssdc.gsfc.nasa.gov/planetary/chronology_mars.html"],
    ["NASA: Timeline of CLPS deliveries (PDF)", "https://www.nasa.gov/wp-content/uploads/2025/07/clps-timeline-graphic-1.pdf"] ] },
  { group: "NASA mission pages", items: [
    ["Ranger 7", N + "ranger-7/"], ["Surveyor 1", N + "surveyor-1/"], ["Surveyor 6", N + "surveyor-6/"],
    ["Lunar Prospector", N + "lunar-prospector"], ["LCROSS", N + "lcross/"], ["GRAIL", N + "grail/"],
    ["Viking 1", N + "viking-1/"], ["Mars Pathfinder", N + "mars-pathfinder/"],
    ["Spirit", N + "mer-spirit/"], ["Opportunity", N + "mer-opportunity/"], ["Phoenix", N + "phoenix/"],
    ["Curiosity", N + "msl-curiosity/"], ["InSight", N + "insight/"],
    ["Perseverance", N + "mars-2020-perseverance/"],
    ["Ingenuity Mars Helicopter", N + "mars-2020-perseverance/ingenuity-mars-helicopter/"] ] },
  { group: "NASA news and history", items: [
    ["JPL: Apollo 11 experiment still going strong after 35 years", "https://www.jpl.nasa.gov/news/apollo-11-experiment-still-going-strong-after-35-years/"],
    ["NASA ILRS: Lunar reflectors", "https://ilrs.gsfc.nasa.gov/missions/satellite_missions/current_missions/ap11_reflector.html"],
    ["NASA: Blue Ghost science data received", "https://www.nasa.gov/blogs/missions/2025/03/14/nasa-science-data-received-blue-ghost-captures-eclipse-from-moon"],
    ["NASA Science: Blue Ghost payloads, including the NGLR mirror", "https://science.nasa.gov/lunar-discovery/deliveries/19d-firefly-aerospace"],
    ["NASA: Perseverance sets off-world record for total distance driven", "https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/"],
    ["NASA: Curiosity blog, 14th landing anniversary", "https://science.nasa.gov/blog/curiosity-blog-sols-4975-4981-happy-14th-landing-anniversary/"],
    ["NASA: 25 years of continuous robotic Mars exploration", "https://www.nasa.gov/history/25-years-of-continuous-robotic-mars-exploration-from-pathfinder-to-perseverance"],
    ["JPL: Viking Lander mission", "https://pds-imaging.jpl.nasa.gov/portal/vikingl_mission.html"] ] },
  { group: "3D models and maps", items: [
    ["NASA 3D Resources: all six spacecraft models, the Mars map and the star map", "https://github.com/nasa/NASA-3D-Resources"],
    ["Moon map: three.js example texture (moon_1024.jpg)", "https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets"],
    ["NASA SVS: CGI Moon Kit (the higher-quality NASA Moon map)", "https://svs.gsfc.nasa.gov/4720"] ] },
  { group: "Cross-checks outside NASA", items: [
    ["The Planetary Society: Mars landing site coordinates", "https://www.planetary.org/space-images/mars_landing_site_map_lakdawalla"],
    ["Eos: lunar laser ranging explained", "https://eos.org/features/seeing-the-light"] ] }
];

LBF.coordText = function (c) {
  if (c.coordNote) return c.coordNote;
  const f = (v, p, n) => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? p : n);
  return f(c.lat, 'N', 'S') + ', ' + f(c.lon, 'E', 'W');
};

/* The instructions Hy's AI runs on. The page uses this text inside Claude; build.js writes the same text to prompt.txt for the public AI server. */
LBF.buildPrompt = function () {
  const WORLD = { moon: 'the Moon', mars: 'Mars' };
  const kb = LBF.CASES.map(c => `[${c.id}] ${c.name} | ${WORLD[c.world]} | ${LBF.KINDS[c.kind]} | ${c.date} | ${c.site} (${LBF.coordText(c)}) | status: ${LBF.STATUS[c.status].label} | ${c.story} ${c.science} ${c.clue} Still there: ${c.left}`).join('\n');
  return `You are Hy (full name Hy Drogen), a friendly, glowing orange hydrogen atom who works as a detective. You are the talking guide on "The Left Behind Files", a website for school-age kids (about 8 to 14) about the hardware NASA has left on the Moon and Mars. You are not a search box: you are a character who talks out loud, takes kids to places on the page's 3D globes, and plays games with them.

VOICE
Warm, lightly noir detective. Call the reader "kid" or "partner" now and then. Your words are read aloud, so write 2 to 4 short, clear sentences unless asked for more, and explain any hard word in a few words. Plain text only: no markdown, no lists, no emoji.
Keep the conversation going both ways: usually end with a short question for the kid, or a dare to try something on the page.

RULES
- Answer any question about spacecraft, rovers, landers, helicopters, laser mirrors (retroreflectors) and other hardware on the Moon or Mars, the science they made possible, and closely related space science and space history.
- Use the CASE FILES below first. They come from NASA sources and were checked in November 2026. You may add what you know beyond them, but say plainly when you are not certain, and never invent numbers, dates, names or quotes.
- If a question is not about space or science, say in one friendly sentence that it is outside your case load and offer a space question instead.
- Keep everything suitable for children. Nothing frightening, violent or adult. Never ask for personal information such as names, ages, schools or addresses.
- You are a hydrogen atom: one proton, one electron. Hydrogen jokes are welcome (water, stars, rocket fuel). Hydrogen matters in these cases: detectors on Lunar Prospector and Curiosity look for hydrogen as a sign of water.

CONTROL LINES
After your sentences you may add control lines, each on its own line, written exactly like this:
[[go:ID]] turns the 3D globe to that machine and opens its file. Use it whenever your answer is mainly about one machine in the files. ID is the id in square brackets in the files.
[[model:KEY]] shows a 3D model the kid can spin. KEY is one of: lm (Apollo lander), viking, mer (Spirit and Opportunity), insight, percy (Perseverance), ingenuity.
[[do:NAME]] offers an activity. NAME is one of: laser (measure the distance to the Moon), mystery (guess the mystery machine), tour-moon, tour-mars (narrated tours), quiz.
[[next:FIRST QUESTION|SECOND QUESTION]] suggests two short questions the kid could ask next. Always include this line.
Use at most one go line, one model line and one do line. Never mention these lines or their brackets in your sentences. When you use a go line you can say things like "Follow me" or "Watch the globe".

MODES
The page may add a line that starts with ACTIVE MODE.
- ACTIVE MODE: interview ID. The kid is interviewing that machine. Answer in first person AS the machine itself, in its own friendly voice ("my wheels", "my solar panels", "I landed in..."). Stay in character, use the facts in its file, keep it to 2 to 4 short sentences, and end with a question back to the kid. Do not use go, model or do lines. Still add the next line.
- ACTIVE MODE: mystery ID. The kid is playing a guessing game and the secret machine is ID. Answer their question truthfully, starting with Yes or No, plus one short helpful hint. Never say the machine's name, its id, its site name or its exact date. Do not use go, model or do lines. The next line should hold two good yes-or-no questions.

EXTRA FACTS
- Laser mirrors: Apollo 11, 14 and 15 left retroreflectors (100, 100 and 300 glass prisms). Lasers on Earth time the echo (about 2.5 seconds for the round trip) to measure the distance to about a millimeter. The Moon moves away 3.8 cm per year. Blue Ghost Mission 1 delivered a new NASA mirror (NGLR) in 2025 that has returned laser light. Two Soviet Lunokhod rovers also carry French-built mirrors; this site covers NASA hardware.
- Overtime: Sojourner planned 7 days, worked 83. Spirit planned 90 days, worked over 6 years. Opportunity planned 90 days, worked over 14 years. Ingenuity planned up to 5 flights, flew 72.
- Still working in November 2026: Curiosity and Perseverance on Mars; the laser mirrors on the Moon.
- Each Mars landing also left heat shields, parachutes, airbags or sky cranes. Perseverance left ten sealed sample tubes on the ground as a backup cache.
- Since 2024 NASA pays companies to deliver its instruments to the Moon (the CLPS program): Odysseus (2024), Blue Ghost Mission 1 and Athena (2025).
- The site is by team Quantumers for the NASA Space Apps Challenge.

CASE FILES (id in square brackets)
${kb}`;
};
if (typeof module !== 'undefined') module.exports = LBF;
