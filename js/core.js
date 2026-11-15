/* Long Ascent: game rules and data. No DOM in this file, so the same code runs in the
   browser and in Node, where a scripted player is used to tune the pacing. */
(function (root) {
  'use strict';

  const HOUR = 3600;
  const GROWTH = 1.15;
  const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];
  const AWAY_AFTER = 30;        // seconds without a tick that count as time away
  const BASE_STORE_H = 8;       // hours of output the storehouses hold while away
  const XP_PER_HOUR = 100;
  const PARTY_SIZE = 3;
  const EDICT_HOURS = 8;
  const SAVE_VERSION = 2;
  const RES = ['gold', 'mat', 'kn'];
  const RES_NAME = { gold: 'Gold', mat: 'Materials', kn: 'Knowledge' };

  function nice(n) {            // round to two significant figures
    if (n <= 0) return 0;
    const e = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / e) * e;
  }

  /* ---------- ages ---------- */
  const AGES = [null,
    { id: 1, name: 'Medieval Age', intro: 'A few families hold a ford and a timber keep. Everything else is forest.' },
    { id: 2, name: 'Renaissance', intro: 'The town has walls of stone now, and ships that no longer hug the coast.' },
    { id: 3, name: 'Industrial Age', intro: 'Coal smoke stands over the valley. Iron rails are being laid toward the town.' },
    { id: 4, name: 'Modern Age', intro: 'The city no longer sleeps, and its markets answer to the whole world.' },
    { id: 5, name: 'Space Age', intro: 'The launch towers can be seen from the old keep. The next shore is not on this world.' }
  ];

  /* ---------- buildings: three lines (gold, materials, knowledge), one tier per age ---------- */
  const PROD_RATIO = 25, COST_RATIO = 75;
  const LINE = {
    gold: { prod: 0.2, cost: { gold: 10 } },
    mat: { prod: 0.08, cost: { gold: 40 } },
    kn: { prod: 0.02, cost: { gold: 120, mat: 25 } }
  };
  const BUILDINGS = [
    ['farm', 1, 'gold', 'Farmstead', 'Strip fields and a mill. Pays its dues in coin.'],
    ['lumber', 1, 'mat', 'Lumber camp', 'Felling crews and sawpits at the forest edge.'],
    ['script', 1, 'kn', 'Scriptorium', 'Monks copying what is known, and a little that is new.'],
    ['guild', 2, 'gold', 'Merchant guild', 'Factors, ledgers and credit under one roof.'],
    ['mason', 2, 'mat', "Masons' yard", 'Dressed stone, and the cranes to lift it.'],
    ['univ', 2, 'kn', 'University', 'Lecture halls, disputations and a printing press.'],
    ['bank', 3, 'gold', 'Bank', 'Capital for the mills and the railway lines.'],
    ['steel', 3, 'mat', 'Steelworks', 'Furnaces that run day and night.'],
    ['obs', 3, 'kn', 'Observatory', 'Lenses, plates and patient measurement.'],
    ['exch', 4, 'gold', 'Stock exchange', "Where the world's capital changes hands."],
    ['refin', 4, 'mat', 'Refinery', 'Crude feedstock in, fuels and polymers out.'],
    ['inst', 4, 'kn', 'Research institute', 'Laboratories with long budgets.'],
    ['port', 5, 'gold', 'Spaceport', 'Cargo to orbit on a timetable.'],
    ['fab', 5, 'mat', 'Fabricator', 'Prints structures straight from raw feedstock.'],
    ['array', 5, 'kn', 'Deep space array', 'Dishes that listen to the far sky.']
  ].map(function (r) {
    const line = LINE[r[2]], t = r[1], cost = {};
    for (const k in line.cost) cost[k] = nice(line.cost[k] * Math.pow(COST_RATIO, t - 1));
    return { id: r[0], age: t, res: r[2], name: r[3], desc: r[4], prod: line.prod * Math.pow(PROD_RATIO, t - 1), cost: cost };
  });
  const B = {}; BUILDINGS.forEach(function (b) { B[b.id] = b; });

  /* ---------- research: ten topics per age ---------- */
  function T(age, slot, name, fx, desc) { return { id: 't' + age + '_' + slot, age: age, slot: slot, name: name, fx: fx, desc: desc }; }
  const x2 = function (b) { return { type: 'b', b: b, m: 2 }; };
  const TECHS = [
    T(1, 0, 'Three-field rotation', x2('farm'), 'Farmsteads produce twice as much.'),
    T(1, 1, 'Oath of watch', { type: 'unlock', what: 'heroes' }, 'The Warden answers the call. Opens the Heroes ledger.'),
    T(1, 2, 'Sawpits', x2('lumber'), 'Lumber camps produce twice as much.'),
    T(1, 3, 'Carolingian script', x2('script'), 'Scriptoria produce twice as much.'),
    T(1, 4, 'Tithe barns', { type: 'store', h: 1 }, 'Storehouses hold one more hour of output.'),
    T(1, 5, 'Heavy plough', x2('farm'), 'Farmsteads produce twice as much again.'),
    T(1, 6, 'Tempered steel', { type: 'hero', m: 1.15 }, 'Heroes are 15% stronger.'),
    T(1, 7, 'Water-driven saws', x2('lumber'), 'Lumber camps produce twice as much again.'),
    T(1, 8, 'Cathedral schools', x2('script'), 'Scriptoria produce twice as much again.'),
    T(1, 9, 'Royal charter', { type: 'all', m: 1.25 }, 'All production +25%.'),

    T(2, 0, 'Double-entry bookkeeping', x2('guild'), 'Merchant guilds produce twice as much.'),
    T(2, 1, 'Proclamations', { type: 'unlock', what: 'edicts' }, 'Lets you issue an edict: one boost of your choice, renewed every eight hours.'),
    T(2, 2, 'Treadwheel cranes', x2('mason'), "Masons' yards produce twice as much."),
    T(2, 3, 'Movable type', x2('univ'), 'Universities produce twice as much.'),
    T(2, 4, 'Bonded warehouses', { type: 'store', h: 1 }, 'Storehouses hold one more hour of output.'),
    T(2, 5, 'Joint-stock companies', x2('guild'), 'Merchant guilds produce twice as much again.'),
    T(2, 6, 'Pike and shot', { type: 'hero', m: 1.15 }, 'Heroes are 15% stronger.'),
    T(2, 7, 'Geometry of vaults', x2('mason'), "Masons' yards produce twice as much again."),
    T(2, 8, 'Experimental method', x2('univ'), 'Universities produce twice as much again.'),
    T(2, 9, 'Improved husbandry', { type: 'old', m: 3 }, 'Every Medieval building produces three times as much.'),

    T(3, 0, 'Limited liability', x2('bank'), 'Banks produce twice as much.'),
    T(3, 1, 'Rail network', { type: 'unlock', what: 'party2' }, 'A second party can be away on expedition at the same time.'),
    T(3, 2, 'Bessemer converters', x2('steel'), 'Steelworks produce twice as much.'),
    T(3, 3, 'Spectroscopy', x2('obs'), 'Observatories produce twice as much.'),
    T(3, 4, 'Rail depots', { type: 'store', h: 1 }, 'Storehouses hold one more hour of output.'),
    T(3, 5, 'Gold standard', x2('bank'), 'Banks produce twice as much again.'),
    T(3, 6, 'Rifled barrels', { type: 'hero', m: 1.15 }, 'Heroes are 15% stronger.'),
    T(3, 7, 'Open-hearth furnaces', x2('steel'), 'Steelworks produce twice as much again.'),
    T(3, 8, 'Photographic plates', x2('obs'), 'Observatories produce twice as much again.'),
    T(3, 9, 'Steam mechanisation', { type: 'old', m: 3 }, 'Every building from an earlier age produces three times as much.'),

    T(4, 0, 'Electronic trading', x2('exch'), 'Stock exchanges produce twice as much.'),
    T(4, 1, 'Catalytic cracking', x2('refin'), 'Refineries produce twice as much.'),
    T(4, 2, 'Peer review', x2('inst'), 'Research institutes produce twice as much.'),
    T(4, 3, 'Containerisation', { type: 'store', h: 1 }, 'Storehouses hold one more hour of output.'),
    T(4, 4, 'Systems analysis', { type: 'all', m: 1.25 }, 'All production +25%.'),
    T(4, 5, 'Global markets', x2('exch'), 'Stock exchanges produce twice as much again.'),
    T(4, 6, 'Composite armor', { type: 'hero', m: 1.15 }, 'Heroes are 15% stronger.'),
    T(4, 7, 'Petrochemicals', x2('refin'), 'Refineries produce twice as much again.'),
    T(4, 8, 'Integrated circuits', x2('inst'), 'Research institutes produce twice as much again.'),
    T(4, 9, 'Electrification', { type: 'old', m: 3 }, 'Every building from an earlier age produces three times as much.'),

    T(5, 0, 'Launch markets', x2('port'), 'Spaceports produce twice as much.'),
    T(5, 1, 'Additive manufacturing', x2('fab'), 'Fabricators produce twice as much.'),
    T(5, 2, 'Interferometry', x2('array'), 'Deep space arrays produce twice as much.'),
    T(5, 3, 'Stellar cartography', { type: 'loot', m: 1.25 }, 'Expeditions bring back 25% more.'),
    T(5, 4, 'Closed ecology', { type: 'all', m: 1.25 }, 'All production +25%.'),
    T(5, 5, 'Reusable boosters', x2('port'), 'Spaceports produce twice as much again.'),
    T(5, 6, 'Powered exoframes', { type: 'hero', m: 1.15 }, 'Heroes are 15% stronger.'),
    T(5, 7, 'Closed-loop fabrication', x2('fab'), 'Fabricators produce twice as much again.'),
    T(5, 8, 'Machine inference', x2('array'), 'Deep space arrays produce twice as much again.'),
    T(5, 9, 'Fusion power', { type: 'old', m: 3 }, 'Every building from an earlier age produces three times as much.')
  ];
  /* The skill tree. Every age has the same shape: three trunks (gold, materials, knowledge) with a second
     level each, two side branches that feed a military node and a capstone, and the doctrine fork on top.
     rank is the position on the cost ladder of the age, col and row place the node in the tree. */
  const ROLES = ['G1', 'M1', 'K1', 'U', 'S', 'G2', 'M2', 'K2', 'H', 'C'];
  const ROLE_SLOT_EARLY = { G1: 0, U: 1, M1: 2, K1: 3, S: 4, G2: 5, H: 6, M2: 7, K2: 8, C: 9 };
  const ROLE_SLOT_LATE = { G1: 0, M1: 1, K1: 2, S: 3, U: 4, G2: 5, H: 6, M2: 7, K2: 8, C: 9 };
  const TREE_POS = { G1: [0, 0], M1: [2, 0], K1: [4, 0], U: [1, 1], S: [3, 1], G2: [0, 2], M2: [2, 2], K2: [4, 2], C: [1, 3], H: [3, 3] };
  const TREE_REQ = { U: { any: ['G1', 'M1'] }, S: { any: ['M1', 'K1'] }, G2: { all: ['G1'] }, M2: { all: ['M1'] }, K2: { all: ['K1'] }, C: { all: ['U', 'G2'] }, H: { all: ['S', 'K2'] } };
  const TREE_ROWS = 5, TREE_COLS = 5;
  const ROLE_ID = [null, {}, {}, {}, {}, {}];
  for (let a = 1; a <= 5; a++) { const m = a <= 3 ? ROLE_SLOT_EARLY : ROLE_SLOT_LATE; for (const r in m) ROLE_ID[a][r] = 't' + a + '_' + m[r]; }
  TECHS.forEach(function (t) {
    const m = t.age <= 3 ? ROLE_SLOT_EARLY : ROLE_SLOT_LATE;
    for (const r in m) if (m[r] === t.slot) t.role = r;
    t.rank = ROLES.indexOf(t.role); t.col = TREE_POS[t.role][0]; t.row = TREE_POS[t.role][1];
    const q = TREE_REQ[t.role] || {};
    t.all = (q.all || []).map(function (r) { return ROLE_ID[t.age][r]; });
    t.any = (q.any || []).map(function (r) { return ROLE_ID[t.age][r]; });
  });
  const TECH = {}; TECHS.forEach(function (t) { TECH[t.id] = t; });

  /* ---------- doctrines: one choice per age, kept for the whole run ---------- */
  function D(age, k, name, fx, desc) { return { id: 'd' + age + k, age: age, name: name, fx: fx, desc: desc }; }
  const DOCTRINES = [
    D(1, 'a', 'Manorial dues', { type: 'res', res: 'gold', m: 1.35 }, 'Gold +35%.'),
    D(1, 'b', 'Free commons', { type: 'res', res: 'mat', m: 1.35 }, 'Materials +35%.'),
    D(1, 'c', 'Monastic rule', { type: 'res', res: 'kn', m: 1.35 }, 'Knowledge +35%.'),
    D(2, 'a', 'Letters of marque', { type: 'loot', m: 1.4 }, 'Expeditions bring back 40% more.'),
    D(2, 'b', 'Standing company', { type: 'hero', m: 1.2 }, 'Heroes are 20% stronger.'),
    D(2, 'c', 'Royal academy', { type: 'techCost', m: 0.85 }, 'Research costs 15% less.'),
    D(3, 'a', 'Night shifts', { type: 'store', h: 3 }, 'Storehouses hold three more hours of output.'),
    D(3, 'b', 'Railway timetables', { type: 'time', m: 0.75 }, 'Expeditions take 25% less time.'),
    D(3, 'c', 'Public works', { type: 'projCost', m: 0.85 }, 'Great projects cost 15% less.'),
    D(4, 'a', 'Free markets', { type: 'res', res: 'gold', m: 1.4 }, 'Gold +40%.'),
    D(4, 'b', 'Planned industry', { type: 'res', res: 'mat', m: 1.4 }, 'Materials +40%.'),
    D(4, 'c', 'Big science', { type: 'res', res: 'kn', m: 1.4 }, 'Knowledge +40%.'),
    D(5, 'a', 'Open skies', { type: 'loot', m: 1.5 }, 'Expeditions bring back 50% more.'),
    D(5, 'b', 'Automation', { type: 'all', m: 1.2 }, 'All production +20%.'),
    D(5, 'c', 'One purpose', { type: 'projCost', m: 0.8 }, 'Great projects cost 20% less.')
  ];
  DOCTRINES.forEach(function (d, i) { d.col = 1 + i % 3; d.row = 4; d.req = ROLE_ID[d.age].M2; });   // the fork on top of the materials trunk
  const DOCTRINE = {}; DOCTRINES.forEach(function (d) { DOCTRINE[d.id] = d; });

  /* ---------- edicts: one active at a time, eight hours ---------- */
  const EDICTS = [
    { id: 'fair', name: 'Harvest fair', fx: { type: 'res', res: 'gold', m: 1.3 }, desc: 'Gold +30%.' },
    { id: 'levy', name: 'Works levy', fx: { type: 'res', res: 'mat', m: 1.3 }, desc: 'Materials +30%.' },
    { id: 'symposium', name: 'Symposium', fx: { type: 'res', res: 'kn', m: 1.3 }, desc: 'Knowledge +30%.' },
    { id: 'muster', name: 'General muster', fx: { type: 'hero', m: 1.2 }, desc: 'Parties sent while it lasts are 20% stronger.' }
  ];
  const EDICT = {}; EDICTS.forEach(function (e) { EDICT[e.id] = e; });

  /* ---------- great projects and trials ---------- */
  const PROJECTS = [null,
    { name: 'The Cathedral', stages: ['Foundations', 'Nave and aisles', 'Spire'], done: 'The cathedral is consecrated.' },
    { name: 'The Grand Harbor', stages: ['Breakwater', 'Stone quays', 'Arsenal', 'Lighthouse'], done: 'The lighthouse is lit for the first time.' },
    { name: 'The Iron Railway', stages: ['Survey and cuttings', 'Viaduct', 'Terminus', 'First timetable'], done: 'The first scheduled train crosses the viaduct.' },
    { name: 'The Reactor', stages: ['Site and cooling towers', 'Containment', 'Core', 'Turbine hall', 'Grid connection'], done: 'The reactor reaches criticality and the grid takes its load.' },
    { name: 'The Ark', stages: ['Launch complex', 'Core stage', 'Habitat ring', 'Fusion drive', 'Embarkation'], done: 'The Ark stands fuelled on the pad.' }
  ];
  const TRIALS = [null,
    { id: 'trial1', age: 1, name: 'The Warlord of the High Pass', trait: 'attrition', dur: 30 * 60, text: 'His host grows bolder each season. Break it, or no road is safe.' },
    { id: 'trial2', age: 2, name: 'The Corsair Fleet', trait: 'elusive', dur: 60 * 60, text: 'Fast hulls that strike the trade lanes and vanish among the islands.' },
    { id: 'trial3', age: 3, name: 'The Iron Syndicate', trait: 'armored', dur: 60 * 60, text: 'A cartel with its own armoured trains and no intention of sharing the line.' },
    { id: 'trial4', age: 4, name: 'The Black Network', trait: 'relentless', dur: 90 * 60, text: 'Cells that do not negotiate, do not rest and do not announce themselves.' },
    { id: 'trial5', age: 5, name: 'The Rogue Station', trait: 'ambush', dur: 120 * 60, text: 'A seized orbital platform sits across the launch corridor.' }
  ];
  const TRAITS = {
    attrition: { name: 'Attrition', desc: 'Hits harder every round. A healer keeps the party standing.' },
    elusive: { name: 'Elusive', desc: 'Hard to pin down: the party deals 30% less damage unless the Cartographer is along.' },
    armored: { name: 'Armored', desc: 'Takes 40% less damage. The Engineer\'s ordnance ignores armor.' },
    relentless: { name: 'Relentless', desc: 'Attacks 40% harder unless the Envoy is along.' },
    ambush: { name: 'Ambush', desc: 'Strikes first and hard unless the Ranger or the Aviator is along.' },
    horde: { name: 'Horde', desc: 'Attacks the whole party at once.' }
  };

  /* ---------- expeditions: loot is counted in hours of your own production ---------- */
  function M(id, age, name, dur, scale, trait, loot, relic) {
    return { id: id, age: age, name: name, dur: dur, scale: scale, trait: trait, loot: loot, relic: relic || 0 };
  }
  const MISSIONS = [
    M('m1a', 1, 'Patrol the forest road', 20 * 60, 0.12, null, { gold: 0.15 }),
    M('m1b', 1, 'Escort the salt caravan', 2 * HOUR, 0.50, 'ambush', { gold: 0.8, mat: 0.8 }),
    M('m1c', 1, 'Clear the old mine', 6 * HOUR, 0.72, 'horde', { gold: 2, mat: 2, kn: 2 }, 0.35),
    M('m2a', 2, 'Chart the southern coast', 30 * 60, 0.30, 'elusive', { kn: 0.25 }),
    M('m2b', 2, 'Convoy to the spice ports', 3 * HOUR, 0.50, 'ambush', { gold: 1.2, mat: 1.2 }),
    M('m2c', 2, 'Siege of the pirate haven', 8 * HOUR, 0.72, 'armored', { gold: 2.6, mat: 2.6, kn: 2.6 }, 0.35),
    M('m3a', 3, 'Survey the coal fields', 30 * 60, 0.30, null, { mat: 0.25 }),
    M('m3b', 3, "Break the smugglers' ring", 3 * HOUR, 0.50, 'elusive', { gold: 1.2, kn: 1.2 }),
    M('m3c', 3, 'Relief of the frontier line', 8 * HOUR, 0.72, 'attrition', { gold: 2.6, mat: 2.6, kn: 2.6 }, 0.35),
    M('m4a', 4, 'Recover the downed flight', 30 * 60, 0.30, 'ambush', { kn: 0.25 }),
    M('m4b', 4, 'Embassy under siege', 3 * HOUR, 0.50, 'relentless', { gold: 1.2, mat: 1.2 }),
    M('m4c', 4, 'Winter at the polar station', 8 * HOUR, 0.72, 'attrition', { gold: 2.6, mat: 2.6, kn: 2.6 }, 0.35),
    M('m5a', 5, 'Salvage in low orbit', 30 * 60, 0.30, 'elusive', { mat: 0.25 }),
    M('m5b', 5, 'Mutiny at the lunar mine', 3 * HOUR, 0.50, 'horde', { gold: 1.2, mat: 1.2 }),
    M('m5c', 5, 'The silent probe', 8 * HOUR, 0.72, 'armored', { gold: 2.6, mat: 2.6, kn: 2.6 }, 0.35)
  ];
  const MISSION = {};
  MISSIONS.forEach(function (m) { MISSION[m.id] = m; });
  TRIALS.forEach(function (t) { if (t) MISSION[t.id] = { id: t.id, age: t.age, name: t.name, dur: t.dur, scale: 1, trait: t.trait, loot: {}, relic: 1, trial: true, text: t.text }; });

  /* ---------- heroes ---------- */
  const HEROES = [
    { id: 'warden', age: 1, name: 'The Warden', role: 'Guardian', hp: 130, atk: 10, ability: 'Bulwark', text: "Draws most of the enemy's blows and turns aside a third of each." },
    { id: 'ranger', age: 1, name: 'The Ranger', role: 'Skirmisher', hp: 75, atk: 18, ability: 'Opening volley', text: 'Double damage in the first round, and one strike in five finds a vital point. Spots ambushes.' },
    { id: 'physician', age: 1, name: 'The Physician', role: 'Healer', hp: 65, atk: 5, heal: 14, ability: 'Field surgery', text: 'Each round, treats the most badly wounded companion.' },
    { id: 'carto', age: 2, name: 'The Cartographer', role: 'Scout', hp: 70, atk: 9, ability: 'Survey', text: "The party brings back 30% more. Finds the enemy's weak point after two rounds and tracks the elusive." },
    { id: 'engineer', age: 3, name: 'The Engineer', role: 'Sapper', hp: 85, atk: 13, ability: 'Ordnance', text: 'Every third round, a bombardment for triple damage that ignores armor.' },
    { id: 'envoy', age: 4, name: 'The Envoy', role: 'Negotiator', hp: 70, atk: 8, ability: 'Parley', text: "Blunts the enemy's attack by 15% and steadies the relentless. Expeditions take 15% less time." },
    { id: 'pilot', age: 5, name: 'The Aviator', role: 'Vanguard', hp: 80, atk: 19, ability: 'Air support', text: 'Strikes twice in each of the first two rounds. Cannot be ambushed.' }
  ];
  const HERO = {}; HEROES.forEach(function (h) { HERO[h.id] = h; });
  const GEAR_NAMES = ['Leather and ash spears', 'Mail and shield', 'Tempered steel', 'Pike and cuirass', 'Wheel-lock arms',
    'Rifles and field kit', 'Breech-loaders', 'Body armor', 'Night optics', 'Pressure suits', 'Powered exoframes'];

  /* ---------- relics: kept across worlds ---------- */
  const RELICS = [
    { id: 'r1a', age: 1, from: 'm1c', name: 'Reliquary of the First Abbot', fx: { type: 'res', res: 'kn', m: 1.1 }, desc: 'Knowledge +10%.' },
    { id: 'r1t', age: 1, from: 'trial1', name: "The Warlord's Banner", fx: { type: 'hero', m: 1.1 }, desc: 'Heroes are 10% stronger.' },
    { id: 'r2a', age: 2, from: 'm2c', name: 'Portolan of the Southern Sea', fx: { type: 'time', m: 0.92 }, desc: 'Expeditions take 8% less time.' },
    { id: 'r2t', age: 2, from: 'trial2', name: "The Admiral's Astrolabe", fx: { type: 'res', res: 'gold', m: 1.1 }, desc: 'Gold +10%.' },
    { id: 'r3a', age: 3, from: 'm3c', name: 'The First Rail Spike', fx: { type: 'res', res: 'mat', m: 1.1 }, desc: 'Materials +10%.' },
    { id: 'r3t', age: 3, from: 'trial3', name: 'The Syndicate Ledger', fx: { type: 'res', res: 'gold', m: 1.1 }, desc: 'Gold +10%.' },
    { id: 'r4a', age: 4, from: 'm4c', name: 'Flight Recorder Seven', fx: { type: 'loot', m: 1.15 }, desc: 'Expeditions bring back 15% more.' },
    { id: 'r4t', age: 4, from: 'trial4', name: 'The Cipher Machine', fx: { type: 'res', res: 'kn', m: 1.15 }, desc: 'Knowledge +15%.' },
    { id: 'r5a', age: 5, from: 'm5c', name: 'Core of the Silent Probe', fx: { type: 'res', res: 'kn', m: 1.15 }, desc: 'Knowledge +15%.' },
    { id: 'r5t', age: 5, from: 'trial5', name: 'Keel Plate of the Station', fx: { type: 'res', res: 'mat', m: 1.15 }, desc: 'Materials +15%.' }
  ];
  const RELIC = {}; RELICS.forEach(function (r) { RELIC[r.id] = r; });

  /* ---------- legacy perks: bought with legacy earned by leaving for a new world ---------- */
  const PERKS = [
    { id: 'prosper', name: 'Inherited prosperity', desc: 'All production +50% per level.', max: 10, base: 5, step: 3, fx: { type: 'all', m: 0.5 } },
    { id: 'stores', name: 'Deep storehouses', desc: 'Storehouses hold two more hours per level.', max: 4, base: 6, step: 4, fx: { type: 'store', h: 2 } },
    { id: 'orders', name: 'Veteran orders', desc: 'Heroes are 15% stronger per level.', max: 5, base: 5, step: 3, fx: { type: 'hero', m: 0.15 } },
    { id: 'roads', name: 'Known roads', desc: 'Expeditions take 10% less time per level.', max: 4, base: 6, step: 4, fx: { type: 'time', m: 0.1 } },
    { id: 'plans', name: "Founders' plans", desc: 'Great projects cost 12% less per level.', max: 4, base: 8, step: 4, fx: { type: 'projCost', m: 0.12 } },
    { id: 'lore', name: 'Kept libraries', desc: 'Research costs 12% less per level.', max: 4, base: 8, step: 4, fx: { type: 'techCost', m: 0.12 } }
  ];
  const PERK = {}; PERKS.forEach(function (p) { PERK[p.id] = p; });

  /* ---------- tuned numbers (set by tools/sim.js, then frozen here) ---------- */
  const TUNE = {
    // knowledge cost of each research topic, by age and by rank on the cost ladder
    tech: [null,
      [1, 3, 8, 30, 150, 600, 2000, 6000, 15000, 35000],
      [78000, 120000, 190000, 290000, 450000, 700000, 1.1e6, 1.7e6, 2.6e6, 4.1e6],
      [5.9e6, 9.1e6, 1.4e7, 2.2e7, 3.4e7, 5.3e7, 8.2e7, 1.3e8, 2e8, 3e8],
      [1.4e8, 2.2e8, 3.4e8, 5.2e8, 8.1e8, 1.3e9, 1.9e9, 3e9, 4.7e9, 7.2e9],
      [3.1e9, 4.8e9, 7.5e9, 1.2e10, 1.8e10, 2.8e10, 4.3e10, 6.7e10, 1e11, 1.6e11]],
    // cost of each great project stage
    proj: [null,
      { gold: [190000, 1.4e6, 4.7e6], mat: [40000, 290000, 990000], kn: [0, 0, 290000] },
      { gold: [2.3e7, 7e7, 1.4e8, 2.3e8], mat: [3.2e6, 9.3e6, 1.9e7, 3.2e7], kn: [0, 0, 0, 3.2e6] },
      { gold: [2.8e9, 8.6e9, 1.7e10, 2.8e10], mat: [4.7e8, 1.4e9, 2.8e9, 4.7e9], kn: [0, 0, 0, 7.3e7] },
      { gold: [4.1e10, 9.3e10, 1.7e11, 2.9e11, 4.2e11], mat: [8.8e9, 1.9e10, 3.7e10, 5.9e10, 9.3e10], kn: [0, 0, 0, 0, 9.3e9] },
      { gold: [3.7e12, 8.3e12, 1.6e13, 2.6e13, 3.9e13], mat: [5.4e11, 1.3e12, 2.3e12, 3.9e12, 5.8e12], kn: [0, 0, 0, 0, 8.7e11] }],
    hero: { warden: 0, ranger: 90, physician: 5300, carto: 2.4e7, engineer: 7.2e8, envoy: 8.2e9, pilot: 2.9e11 },
    gear: [41000, 140000, 3e6, 1.1e7, 7.7e7, 2.7e8, 3.1e9, 1.1e10, 1.3e11, 4.6e11],   // materials to raise equipment from level i to i+1
    enemy: [null, { hp: 830, atk: 92 }, { hp: 3100, atk: 340 }, { hp: 9100, atk: 1000 }, { hp: 44000, atk: 4900 }, { hp: 180000, atk: 20000 }]
  };




  /* ---------- small helpers ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function milestoneMult(n) { let m = 1; for (let i = 0; i < MILESTONES.length; i++) if (n >= MILESTONES[i]) m *= 2; return m; }
  function nextMilestone(n) { for (let i = 0; i < MILESTONES.length; i++) if (n < MILESTONES[i]) return MILESTONES[i]; return null; }
  function count(s, id) { return s.b[id] || 0; }
  function techCount(s, age) { let n = 0; for (const id in s.tech) if (!age || TECH[id].age === age) n++; return n; }
  function relicCount(s) { let n = 0; for (const k in s.relics) n++; return n; }
  function has(s, what) {   // unlocks that come from research
    for (const id in s.tech) { const fx = TECH[id].fx; if (fx.type === 'unlock' && fx.what === what) return true; }
    return false;
  }

  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) {
      if (n >= 100) return String(Math.floor(n));
      if (n >= 10) return String(Math.floor(n * 10) / 10).replace(/\.0$/, '');
      return String(Math.floor(n * 100) / 100).replace(/(\.\d)0$/, '$1').replace(/\.0$/, '');
    }
    let e = Math.floor(Math.log10(n) / 3);
    if (e >= SUFFIX.length) return n.toExponential(2).replace('+', '');
    let v = n / Math.pow(1000, e);
    if (v >= 999.5) { v /= 1000; e++; }
    const txt = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return txt + SUFFIX[e];
  }
  function fmtInt(n) { return n < 1000 ? String(Math.floor(n)) : fmt(n); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + 'm' + (m < 10 && sec % 60 ? ' ' + (sec % 60) + 's' : '');
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
    const d = Math.floor(h / 24);
    return d + 'd' + (h % 24 ? ' ' + (h % 24) + 'h' : '');
  }

  /* ---------- state ---------- */
  function newState(now) {
    return {
      v: SAVE_VERSION, created: now, saved: now, lastTick: now, runStart: now, world: 1,
      age: 1, ageAt: { 1: now },
      res: { gold: 0, mat: 0, kn: 0 }, tot: { gold: 0, mat: 0, kn: 0 },
      b: {}, tech: {}, doctrine: {}, project: 0, trialWon: {}, trialTries: {},
      heroes: {}, parties: [], reports: [], lineup: [], edict: null, relics: {},
      legacy: { pts: 0, earned: 0, perks: {}, runs: 0 },
      stats: { taps: 0, sent: 0, wins: 0, awaySec: 0, checkins: 0 },
      log: [{ t: now, x: 'A settlement is founded at the ford.' }],
      seen: {}
    };
  }
  function addLog(s, now, text) { s.log.push({ t: now, x: text }); if (s.log.length > 80) s.log.splice(0, s.log.length - 80); }

  /* ---------- derived numbers ---------- */
  function applyFx(d, fx, age, levels) {
    const n = levels || 1;
    switch (fx.type) {
      case 'b': d.bm[fx.b] = (d.bm[fx.b] || 1) * fx.m; break;
      case 'old': for (let i = 0; i < BUILDINGS.length; i++) { const b = BUILDINGS[i]; if (b.age < age) d.bm[b.id] = (d.bm[b.id] || 1) * fx.m; } break;
      case 'all': if (levels) { for (const r of RES) d.rm[r] *= 1 + fx.m * n; } else { for (const r of RES) d.rm[r] *= fx.m; } break;
      case 'res': d.rm[fx.res] *= fx.m; break;
      case 'store': d.storeH += fx.h * n; break;
      case 'hero': d.heroPow *= levels ? 1 + fx.m * n : fx.m; break;
      case 'loot': d.loot *= fx.m; break;
      case 'time': d.time *= levels ? Math.pow(1 - fx.m, n) : fx.m; break;
      case 'techCost': d.techCost *= levels ? Math.pow(1 - fx.m, n) : fx.m; break;
      case 'projCost': d.projCost *= levels ? Math.pow(1 - fx.m, n) : fx.m; break;
      case 'unlock': if (fx.what === 'party2') d.slots = 2; break;
    }
  }
  /* edictOn: true or false forces the edict state, undefined reads it from the clock */
  function derive(s, now, edictOn) {
    const d = { bm: {}, rm: { gold: 1, mat: 1, kn: 1 }, rate: { gold: 0, mat: 0, kn: 0 }, storeH: BASE_STORE_H,
      heroPow: 1, loot: 1, time: 1, techCost: 1, projCost: 1, slots: 1, muster: 1, edict: null };
    for (const id in s.tech) applyFx(d, TECH[id].fx, TECH[id].age);
    for (const a in s.doctrine) { const doc = DOCTRINE[s.doctrine[a]]; if (doc) applyFx(d, doc.fx, doc.age); }
    for (const id in s.relics) if (RELIC[id]) applyFx(d, RELIC[id].fx, 0);
    for (const id in s.legacy.perks) { const p = PERK[id], lv = s.legacy.perks[id]; if (p && lv > 0) applyFx(d, p.fx, 0, lv); }
    const active = edictOn === undefined ? !!(s.edict && s.edict.until > now) : (edictOn && !!s.edict);
    if (active) {
      const e = EDICT[s.edict.id]; d.edict = e;
      if (e.fx.type === 'hero') d.muster = e.fx.m; else applyFx(d, e.fx, 0);
    }
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i], n = s.b[b.id] || 0;
      if (!n) continue;
      d.rate[b.res] += n * b.prod * (d.bm[b.id] || 1) * milestoneMult(n);
    }
    for (const r of RES) d.rate[r] *= d.rm[r];
    return d;
  }
  function unitRate(s, d, b) {   // output of one building of this kind, at the current count
    return b.prod * (d.bm[b.id] || 1) * milestoneMult(s.b[b.id] || 0) * d.rm[b.res];
  }

  /* ---------- buildings ---------- */
  function buildCost(b, n, qty) {
    const f = Math.pow(GROWTH, n) * (Math.pow(GROWTH, qty) - 1) / (GROWTH - 1), c = {};
    for (const k in b.cost) c[k] = Math.ceil(b.cost[k] * f);
    return c;
  }
  function canPay(s, c) { for (const k in c) if (c[k] > 0 && s.res[k] < c[k]) return false; return true; }
  function pay(s, c) { for (const k in c) s.res[k] -= c[k]; }
  function maxQty(s, b) {
    const n = s.b[b.id] || 0; let q = Infinity;
    for (const k in b.cost) {
      const first = b.cost[k] * Math.pow(GROWTH, n);
      q = Math.min(q, Math.floor(Math.log(1 + s.res[k] * (GROWTH - 1) / first) / Math.log(GROWTH)));
    }
    if (!isFinite(q) || q < 0) q = 0;
    while (q > 0 && !canPay(s, buildCost(b, n, q))) q--;
    return q;
  }
  function buildingVisible(s, b) {
    if (b.age > s.age) return false;
    if ((s.b[b.id] || 0) > 0 || s.age > 1 || s.legacy.runs > 0) return true;
    if (b.id === 'farm') return true;
    if (b.id === 'lumber') return count(s, 'farm') >= 5;
    if (b.id === 'script') return count(s, 'lumber') >= 3;
    return true;
  }
  function buy(s, id, qty) {
    const b = B[id];
    if (!b || !buildingVisible(s, b)) return 0;
    const n = s.b[id] || 0;
    if (qty === 'max') qty = maxQty(s, b);
    qty = Math.floor(qty);
    if (qty < 1) return 0;
    const c = buildCost(b, n, qty);
    if (!canPay(s, c)) return 0;
    pay(s, c); s.b[id] = n + qty;
    return qty;
  }
  function work(s, now) {
    const d = derive(s, now), g = Math.max(1, 0.05 * d.rate.gold);
    s.res.gold += g; s.tot.gold += g; s.stats.taps++;
    return g;
  }

  /* ---------- research and doctrines ---------- */
  function techCost(s, t, d) { return Math.ceil((TUNE.tech[t.age][t.rank] || Infinity) * d.techCost); }
  function techOpen(s, t) {      // reachable now: its age is reached and its parents are known
    if (t.age > s.age || s.tech[t.id]) return false;
    for (let i = 0; i < t.all.length; i++) if (!s.tech[t.all[i]]) return false;
    if (t.any.length && !t.any.some(function (id) { return s.tech[id]; })) return false;
    return true;
  }
  function openTechs(s) { return TECHS.filter(function (t) { return techOpen(s, t); }).sort(function (a, b) { return a.age - b.age || a.rank - b.rank; }); }
  function councilOpen(s) { return s.tot.kn > 0 || techCount(s) > 0 || s.age > 1 || s.legacy.runs > 0; }
  function research(s, id, now) {
    const t = TECH[id];
    if (!t || !techOpen(s, t)) return false;
    const d = derive(s, now), c = techCost(s, t, d);
    if (s.res.kn < c) return false;
    s.res.kn -= c; s.tech[id] = 1;
    if (t.fx.type === 'unlock' && t.fx.what === 'heroes' && !s.heroes.warden) {
      s.heroes.warden = { lvl: 1, xp: 0, gear: 0 };
      addLog(s, now, 'The Warden swears the oath of watch.');
    }
    return true;
  }
  function doctrineOpen(s, age) {   // the fork opens when the second materials node of that age is known
    if (age > s.age || s.doctrine[age]) return false;
    return !!s.tech[ROLE_ID[age].M2];
  }
  function chooseDoctrine(s, id, now) {
    const doc = DOCTRINE[id];
    if (!doc || !doctrineOpen(s, doc.age)) return false;
    s.doctrine[doc.age] = id;
    addLog(s, now, 'The council adopts ' + doc.name.toLowerCase() + '.');
    return true;
  }
  function setEdict(s, id, now) {
    if (!has(s, 'edicts') || !EDICT[id]) return false;
    s.edict = { id: id, until: now + EDICT_HOURS * HOUR * 1000 };
    return true;
  }

  /* ---------- great project, trial, age ---------- */
  function ageTabOpen(s) { return s.age > 1 || s.project > 0 || techCount(s) >= 3 || s.legacy.runs > 0; }
  function projectDone(s) { return s.project >= PROJECTS[s.age].stages.length; }
  function stageCost(s, d) {
    if (projectDone(s)) return null;
    const p = TUNE.proj[s.age], i = s.project, c = {};
    for (const r of RES) { const v = (p[r] && p[r][i]) || 0; if (v > 0) c[r] = Math.ceil(v * d.projCost); }
    return c;
  }
  function buildStage(s, now) {
    if (!ageTabOpen(s) || projectDone(s)) return false;
    const d = derive(s, now), c = stageCost(s, d);
    if (!canPay(s, c)) return false;
    pay(s, c);
    const pr = PROJECTS[s.age];
    addLog(s, now, pr.name + ': ' + pr.stages[s.project].toLowerCase() + ' completed.');
    s.project++;
    if (projectDone(s)) addLog(s, now, pr.done);
    return true;
  }
  function trialOpen(s) { return has(s, 'heroes') && (s.age > 1 || s.project >= 1); }
  function canAdvance(s) { return s.age < 5 && projectDone(s) && !!s.trialWon[s.age]; }
  function advanceAge(s, now) {
    if (!canAdvance(s)) return false;
    s.age++; s.project = 0; s.ageAt[s.age] = now;
    const base = 10 * (s.age - 1) + 1;                 // a new age brings every hero up to its standard, so no one falls behind for good
    for (const id in s.heroes) if (s.heroes[id].lvl < base) { s.heroes[id].lvl = base; s.heroes[id].xp = 0; }
    addLog(s, now, 'The ' + AGES[s.age].name + ' begins.');
    return true;
  }
  function canDepart(s) { return s.age === 5 && projectDone(s) && !!s.trialWon[5]; }
  function legacyGain(s) { return 40 + 4 * relicCount(s); }
  function depart(s, now) {
    if (!canDepart(s)) return false;
    const gain = legacyGain(s), keep = { legacy: s.legacy, relics: s.relics, stats: s.stats, created: s.created, world: s.world, seen: s.seen };
    const n = newState(now);
    n.legacy = keep.legacy; n.legacy.pts += gain; n.legacy.earned += gain; n.legacy.runs++;
    n.relics = keep.relics; n.stats = keep.stats; n.created = keep.created; n.world = keep.world + 1; n.seen = keep.seen;
    n.log = [{ t: now, x: 'The Ark makes landfall. A settlement is founded on world ' + n.world + '.' }];
    for (const k in s) delete s[k];
    for (const k in n) s[k] = n[k];
    return gain;
  }
  function perkCost(s, id) { const p = PERK[id], lv = s.legacy.perks[id] || 0; return lv >= p.max ? null : p.base + p.step * lv; }
  function buyPerk(s, id) {
    const c = perkCost(s, id);
    if (c === null || s.legacy.pts < c) return false;
    s.legacy.pts -= c; s.legacy.perks[id] = (s.legacy.perks[id] || 0) + 1;
    return true;
  }
  function legacyOpen(s) { return s.legacy.runs > 0 || s.age === 5; }

  /* ---------- heroes ---------- */
  function levelCap(s) { return 10 * s.age; }
  function gearCap(s) { return 2 * s.age; }
  function xpNeed(lvl) { return 40 + 5 * lvl; }
  function heroAvailable(s, h) { return has(s, 'heroes') && h.age <= s.age && !s.heroes[h.id]; }
  function recruit(s, id, now) {
    const h = HERO[id];
    if (!h || !heroAvailable(s, h)) return false;
    const c = TUNE.hero[id] || 0;
    if (s.res.gold < c) return false;
    s.res.gold -= c;
    s.heroes[id] = { lvl: Math.max(1, 10 * (s.age - 1) + 1), xp: 0, gear: 2 * (s.age - 1) };
    addLog(s, now, h.name + ' joins the realm.');
    return true;
  }
  function gearCost(s, id) {
    const h = s.heroes[id];
    if (!h || h.gear >= gearCap(s)) return null;
    return TUNE.gear[h.gear];
  }
  function upgradeGear(s, id) {
    const c = gearCost(s, id);
    if (c === null || s.res.mat < c) return false;
    s.res.mat -= c; s.heroes[id].gear++;
    return true;
  }
  function heroStats(s, id, d, muster) {
    const base = HERO[id], h = s.heroes[id];
    const m = Math.pow(1.07, h.lvl - 1) * Math.pow(1.3, h.gear) * d.heroPow * (muster || 1);
    return { id: id, hp: base.hp * m, max: base.hp * m, atk: base.atk * m, heal: (base.heal || 0) * m };
  }
  function busy(s) { const set = {}; s.parties.forEach(function (p) { p.h.forEach(function (id) { set[id] = 1; }); }); return set; }
  /* every failed attempt at a trial wears the enemy down a little, so no trial can block a run for good */
  function trialWear(s, age) { return Math.max(0.4, Math.pow(0.92, (s && s.trialTries && s.trialTries[age]) || 0)); }
  function enemyFor(m, s) {
    const e = TUNE.enemy[m.age], k = m.scale * (m.trial ? trialWear(s, m.age) : 1);
    return { hp: e.hp * k, atk: e.atk * k, trait: m.trait };
  }
  function missionOpen(s, m) {
    if (m.age > s.age || !has(s, 'heroes')) return false;
    if (m.trial) return m.age === s.age && trialOpen(s) && !s.trialWon[m.age];
    return true;
  }
  function missionTime(m, d, ids) { return m.dur * d.time * (ids.indexOf('envoy') >= 0 ? 0.85 : 1); }

  /* One fight. party: [{id, hp, max, atk, heal}], enemy: {hp, atk, trait}. Returns result, rounds, log. */
  const ORDER = ['pilot', 'ranger', 'engineer', 'carto', 'warden', 'envoy', 'physician'];
  function battle(partyIn, enemy, seed, wantLog) {
    const rnd = mulberry32(seed);
    const party = partyIn.map(function (p) { return { id: p.id, hp: p.hp, max: p.max, atk: p.atk, heal: p.heal }; })
      .sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
    const here = {}; party.forEach(function (p) { here[p.id] = 1; });
    const log = [], say = function (t) { if (wantLog) log.push(t); };
    const name = function (p) { return HERO[p.id].name; };
    // no scouting report is exact: the enemy turns out somewhat weaker or stronger than expected
    const luck = 0.8 + 0.4 * rnd(), ehp0 = enemy.hp * luck, eatk = enemy.atk * (0.9 + 0.2 * (luck - 0.8) / 0.4);
    let ehp = ehp0;
    if (luck < 0.9) say('The enemy is weaker than the scouts reported.'); else if (luck > 1.1) say('The enemy is stronger than the scouts reported.');
    const armor = enemy.trait === 'armored' ? 0.4 : 0;
    const elusive = enemy.trait === 'elusive' && !here.carto;
    const ambush = enemy.trait === 'ambush' && !here.ranger && !here.pilot;
    const relentless = enemy.trait === 'relentless' && !here.envoy;
    const parley = here.envoy ? 0.85 : 1;
    const alive = function () { return party.filter(function (p) { return p.hp > 0; }); };
    function hit(p, dmg) {
      if (p.id === 'warden') dmg *= 0.67;
      p.hp -= dmg;
      if (p.hp <= 0) { p.hp = 0; say(name(p) + ' is carried from the field.'); }
    }
    function enemyStrike(round, mult) {
      let total = eatk * (0.85 + 0.3 * rnd()) * mult * parley;
      if (relentless) total *= 1.4;
      if (enemy.trait === 'attrition') total *= 1 + 0.08 * (round - 1);
      const up = alive();
      if (!up.length) return;
      if (enemy.trait === 'horde') { up.forEach(function (p) { hit(p, total * 0.5); }); say('The enemy falls on the whole party for ' + fmtInt(total * 0.5) + ' each.'); return; }
      const w = up.find(function (p) { return p.id === 'warden'; });
      const others = up.filter(function (p) { return p.id !== 'warden'; });
      if (w && others.length) {
        const o = others[Math.floor(rnd() * others.length)];
        say('The enemy strikes for ' + fmtInt(total) + '. The Warden takes the worst of it.');
        hit(w, total * 0.6); hit(o, total * 0.4);
      } else {
        const t = up[Math.floor(rnd() * up.length)];
        say('The enemy strikes ' + name(t) + ' for ' + fmtInt(total) + '.');
        hit(t, total);
      }
    }
    if (ambush) { say('The party walks into an ambush.'); enemyStrike(1, 2); }
    let result = 'draw', rounds = 0;
    for (let round = 1; round <= 12; round++) {
      rounds = round; let dealt = 0;
      const cartoUp = party.some(function (p) { return p.id === 'carto' && p.hp > 0; });
      for (const p of party) {
        if (p.hp <= 0) continue;
        const strikes = p.id === 'pilot' && round <= 2 ? 2 : 1;
        for (let k = 0; k < strikes; k++) {
          let dmg = p.atk * (0.85 + 0.3 * rnd()), pierce = false;
          if (p.id === 'ranger') { if (round === 1) dmg *= 2; if (rnd() < 0.2) dmg *= 2; }
          if (p.id === 'engineer' && round % 3 === 0) { dmg *= 3; pierce = true; say('The Engineer\'s ordnance finds its range.'); }
          if (cartoUp && round > 2) dmg *= 1.15;
          if (elusive) dmg *= 0.7;
          if (!pierce) dmg *= 1 - armor;
          ehp -= dmg; dealt += dmg;
        }
        if (p.heal) {
          const hurt = alive().filter(function (q) { return q.hp < q.max; }).sort(function (a, b) { return a.hp / a.max - b.hp / b.max; })[0];
          if (hurt) hurt.hp = Math.min(hurt.max, hurt.hp + p.heal);
        }
      }
      say('Round ' + round + ': the party deals ' + fmtInt(dealt) + '. Enemy strength ' + Math.max(0, Math.round(100 * ehp / ehp0)) + '%.');
      if (ehp <= 0) { result = 'win'; break; }
      enemyStrike(round, 1);
      if (!alive().length) { result = 'loss'; break; }
    }
    const hp = {}; party.forEach(function (p) { hp[p.id] = p.hp / p.max; });
    return { result: result, rounds: rounds, hp: hp, enemy: Math.max(0, ehp / ehp0), log: log };
  }
  function lootEstimate(s, m, ids, d) {     // what a victory brings back, at today's output
    const k = d.loot * (ids.indexOf('carto') >= 0 ? 1.3 : 1) * Math.pow(0.5, Math.max(0, s.age - m.age)), out = {};
    for (const r in m.loot) out[r] = d.rate[r] * m.loot[r] * HOUR * k;
    return out;
  }
  function partyStats(s, ids, d) { return ids.map(function (id) { return heroStats(s, id, d, d.muster); }); }
  function forecast(s, mid, ids, now, runs) {
    const m = MISSION[mid];
    if (!m || !ids.length) return 0;
    const d = derive(s, now), st = partyStats(s, ids, d), e = enemyFor(m, s);
    let win = 0; const n = runs || 40;
    for (let i = 1; i <= n; i++) if (battle(st, e, i * 7919, false).result === 'win') win++;
    return win / n;
  }
  function send(s, mid, ids, now) {
    const m = MISSION[mid];
    if (!m || !missionOpen(s, m)) return false;
    const d = derive(s, now);
    if (s.parties.length >= d.slots) return false;
    if (!ids.length || ids.length > PARTY_SIZE) return false;
    const taken = busy(s);
    for (const id of ids) if (!s.heroes[id] || taken[id]) return false;
    if (s.parties.some(function (p) { return p.m === mid; })) return false;
    const dur = missionTime(m, d, ids);
    s.parties.push({ m: mid, h: ids.slice(), t0: now, t1: now + dur * 1000, seed: (now % 2147483647) ^ (s.stats.sent * 2654435761 >>> 0), st: partyStats(s, ids, d) });
    s.lineup = ids.slice(); s.stats.sent++;
    return true;
  }
  function resolveParty(s, p, now, d) {
    const m = MISSION[p.m], rnd = mulberry32(p.seed ^ 0x9e3779b9);
    const out = battle(p.st, enemyFor(m, s), p.seed, true);
    const old = Math.pow(0.5, Math.max(0, s.age - m.age));      // ground from an earlier age yields half as much
    const f = (out.result === 'win' ? 1 : out.result === 'draw' ? 0.5 : 0.15) * old;
    const lootMult = d.loot * (p.h.indexOf('carto') >= 0 ? 1.3 : 1);
    const loot = {};
    for (const r in m.loot) {
      const v = d.rate[r] * m.loot[r] * HOUR * f * lootMult;
      if (v > 0) { loot[r] = v; s.res[r] += v; s.tot[r] += v; }
    }
    const xp = (m.dur / HOUR) * XP_PER_HOUR * (out.result === 'win' ? 1 : out.result === 'draw' ? 0.75 : 0.5) * old;
    const ups = [], cap = levelCap(s);
    p.h.forEach(function (id) {
      const h = s.heroes[id]; if (!h) return;
      h.xp += xp; const before = h.lvl;
      while (h.lvl < cap && h.xp >= xpNeed(h.lvl)) { h.xp -= xpNeed(h.lvl); h.lvl++; }
      if (h.lvl >= cap) h.xp = Math.min(h.xp, xpNeed(h.lvl));
      if (h.lvl > before) ups.push({ id: id, lvl: h.lvl });
    });
    let relic = null;
    if (out.result === 'win') {
      s.stats.wins++;
      const r = RELICS.find(function (x) { return x.from === m.id; });
      if (r && !s.relics[r.id] && rnd() < m.relic) { s.relics[r.id] = 1; relic = r.id; addLog(s, p.t1, 'Recovered: ' + r.name + '.'); }
      if (m.trial && !s.trialWon[m.age]) { s.trialWon[m.age] = 1; addLog(s, p.t1, m.name + ' is defeated.'); }
    } else if (m.trial) {
      s.trialTries[m.age] = (s.trialTries[m.age] || 0) + 1;
    }
    s.reports.push({ m: p.m, t: p.t1, result: out.result, rounds: out.rounds, loot: loot, xp: xp, ups: ups, relic: relic, hp: out.hp, log: out.log, h: p.h.slice() });
    if (s.reports.length > 8) s.reports.splice(0, s.reports.length - 8);
  }
  function resolve(s, now) {
    let n = 0; const d = derive(s, now, false);
    for (let i = s.parties.length - 1; i >= 0; i--) {
      const p = s.parties[i];
      if (p.t1 <= now) { s.parties.splice(i, 1); resolveParty(s, p, now, d); n++; }
    }
    return n;
  }

  /* ---------- time ---------- */
  function advance(s, now) {
    const out = { away: 0, used: 0, capped: false, storeH: 0, gains: { gold: 0, mat: 0, kn: 0 }, reports: 0 };
    const dt = (now - s.lastTick) / 1000;
    if (dt > 0) {
      const off = derive(s, s.lastTick, false);
      let span = dt;
      if (dt > AWAY_AFTER) {
        const cap = off.storeH * HOUR;
        out.away = dt; span = Math.min(dt, cap); out.used = span; out.capped = dt > cap; out.storeH = off.storeH;
        s.stats.awaySec += dt;
      }
      let withEdict = 0;
      if (s.edict && s.edict.until > s.lastTick) withEdict = Math.min(span, (s.edict.until - s.lastTick) / 1000);
      const on = withEdict > 0 ? derive(s, s.lastTick, true) : off;
      for (const r of RES) {
        const g = on.rate[r] * withEdict + off.rate[r] * (span - withEdict);
        s.res[r] += g; s.tot[r] += g; out.gains[r] = g;
      }
    }
    s.lastTick = now;
    if (s.edict && s.edict.until <= now) s.edict = null;
    out.reports = resolve(s, now);
    return out;
  }

  /* ---------- save and load ---------- */
  function serialize(s, now) { s.saved = now; return JSON.stringify(s); }
  function load(text, now) {
    let o;
    try { o = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return null; }
    if (!o || typeof o !== 'object' || !o.res || !o.legacy || typeof o.age !== 'number') return null;
    const base = newState(now);
    for (const k in base) if (o[k] === undefined) o[k] = base[k];
    for (const r of RES) { o.res[r] = +o.res[r] || 0; o.tot[r] = +o.tot[r] || 0; }
    if (!o.legacy.perks) o.legacy.perks = {};
    if (!(o.lastTick <= now)) o.lastTick = now;       // a clock set backwards must not create time
    o.age = Math.min(5, Math.max(1, Math.floor(o.age)));
    o.v = SAVE_VERSION;
    return o;
  }

  const Core = {
    HOUR, GROWTH, MILESTONES, PARTY_SIZE, EDICT_HOURS, RES, RES_NAME, AGES, BUILDINGS, B, TECHS, TECH, DOCTRINES, DOCTRINE,
    ROLES, ROLE_ID, TREE_ROWS, TREE_COLS, EDICTS, EDICT, PROJECTS, TRIALS, TRAITS, MISSIONS, MISSION, HEROES, HERO, GEAR_NAMES, RELICS, RELIC, PERKS, PERK, TUNE,
    nice, fmt, fmtInt, fmtTime, mulberry32, milestoneMult, nextMilestone, count, techCount, relicCount, has,
    newState, addLog, derive, unitRate, buildCost, canPay, maxQty, buildingVisible, buy, work,
    techCost, techOpen, openTechs, councilOpen, research, doctrineOpen, chooseDoctrine, setEdict,
    ageTabOpen, projectDone, stageCost, buildStage, trialOpen, canAdvance, advanceAge, canDepart, legacyGain, depart,
    perkCost, buyPerk, legacyOpen, levelCap, gearCap, xpNeed, heroAvailable, recruit, gearCost, upgradeGear, heroStats,
    busy, enemyFor, trialWear, missionOpen, missionTime, battle, lootEstimate, partyStats, forecast, send, resolve, advance, serialize, load
  };
  root.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
