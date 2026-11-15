/* Long Ascent: game rules and data. No DOM in this file, so the same code runs in the
   browser and in Node, where a scripted player is used to tune the pacing. */
(function (root) {
  'use strict';

  const HOUR = 3600;
  const GROWTH = 1.15;
  const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];
  const NAMED = 4;              // the first four doublings of every kind are buildings with a name
  const AWAY_AFTER = 30;        // seconds without a tick that count as time away
  const BASE_STORE_H = 8;       // hours of output the storehouses hold while away
  const XP_PER_HOUR = 100;
  const PARTY_SIZE = 3;
  const EDICT_HOURS = 8;
  const EVENT_GAP = 45 * 60;    // seconds between an answered event and the next one
  const SAVE_VERSION = 3;
  const RES = ['gold', 'mat', 'kn'];
  const RES_NAME = { gold: 'Gold', mat: 'Materials', kn: 'Knowledge' };
  const JOBS = ['gold', 'mat', 'kn', 'work', 'idle'];     // tenths of the people; the idle ones do nothing
  const JOB_NAMES = {             // what the people of each age are set to
    gold: ['Fields', 'Trade', 'Finance', 'Markets', 'Launches'],
    mat: ['Woods', 'Yards', 'Mills', 'Plants', 'Fabrication'],
    kn: ['Books', 'Schools', 'Laboratories', 'Institutes', 'Arrays'],
    work: ['Great work', 'Great work', 'Great work', 'Great work', 'Great work'],
    idle: ['Idle', 'Idle', 'Idle', 'Idle', 'Idle']
  };
  const PEOPLE = [0, 3, 12, 60, 400, 2500];     // people a building of each age brings to the town
  const MARK_PEOPLE = [5, 10, 20, 40];          // a named building counts for this many ordinary ones

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

  /* ---------- buildings: three lines (gold, materials, knowledge), one tier per age ----------
     Each kind raises four named buildings as it grows, at 10, 25, 50 and 100. Each one doubles the kind. */
  const PROD_RATIO = 25, COST_RATIO = 75;
  const LINE = {
    gold: { prod: 0.2, cost: { gold: 10 } },
    mat: { prod: 0.08, cost: { gold: 40 } },
    kn: { prod: 0.02, cost: { gold: 120, mat: 25 } }
  };
  const BUILDINGS = [
    ['farm', 1, 'gold', 'Farmstead', 'Farmsteads', 'Strip fields and a mill. Pays its dues in coin.', ['Windmill', 'Granary', 'Manor house', 'Great estate']],
    ['lumber', 1, 'mat', 'Lumber camp', 'Lumber camps', 'Felling crews and sawpits at the forest edge.', ['Sawpit', 'Timber yard', 'Charcoal kilns', 'Forest lodge']],
    ['script', 1, 'kn', 'Scriptorium', 'Scriptoria', 'Monks copying what is known, and a little that is new.', ['Bell tower', 'Library', 'Cloister', 'Chapter house']],
    ['guild', 2, 'gold', 'Merchant guild', 'Merchant guilds', 'Factors, ledgers and credit under one roof.', ['Counting house', 'Belfry', 'Cloth hall', "Merchants' row"]],
    ['mason', 2, 'mat', "Masons' yard", "Masons' yards", 'Dressed stone, and the cranes to lift it.', ['Lime kiln', 'Treadwheel crane', "Stonecutters' lodge", "Masons' hall"]],
    ['univ', 2, 'kn', 'University', 'Universities', 'Lecture halls, disputations and a printing press.', ['Lecture hall', 'Printing house', 'Anatomy theatre', 'Great college']],
    ['bank', 3, 'gold', 'Bank', 'Banks', 'Capital for the mills and the railway lines.', ['Strongroom', 'Clearing house', 'Head office', 'Bank tower']],
    ['steel', 3, 'mat', 'Steelworks', 'Steelworks', 'Furnaces that run day and night.', ['Blast furnace', 'Rolling mill', 'Coke ovens', 'Great foundry']],
    ['obs', 3, 'kn', 'Observatory', 'Observatories', 'Lenses, plates and patient measurement.', ['Transit room', 'Great refractor', 'Physics laboratory', 'Royal observatory']],
    ['exch', 4, 'gold', 'Stock exchange', 'Stock exchanges', "Where the world's capital changes hands.", ['Trading floor', 'Ticker hall', 'Office tower', 'Financial district']],
    ['refin', 4, 'mat', 'Refinery', 'Refineries', 'Crude feedstock in, fuels and polymers out.', ['Cracking tower', 'Tank farm', 'Pipeline terminal', 'Chemical works']],
    ['inst', 4, 'kn', 'Research institute', 'Research institutes', 'Laboratories with long budgets.', ['Laboratory wing', 'Computing centre', 'Particle ring', 'Science campus']],
    ['port', 5, 'gold', 'Spaceport', 'Spaceports', 'Cargo to orbit on a timetable.', ['Launch pad', 'Assembly hall', 'Landing field', 'Orbital terminal']],
    ['fab', 5, 'mat', 'Fabricator', 'Fabricators', 'Prints structures straight from raw feedstock.', ['Feedstock silo', 'Print hall', 'Robot bay', 'Autofactory']],
    ['array', 5, 'kn', 'Deep space array', 'Deep space arrays', 'Dishes that listen to the far sky.', ['Second dish', 'Control room', 'Long baseline', 'Great array']]
  ].map(function (r) {
    const line = LINE[r[2]], t = r[1], cost = {};
    for (const k in line.cost) cost[k] = nice(line.cost[k] * Math.pow(COST_RATIO, t - 1));
    return { id: r[0], age: t, res: r[2], name: r[3], pl: r[4], desc: r[5], marks: r[6], prod: line.prod * Math.pow(PROD_RATIO, t - 1), cost: cost };
  });
  const B = {}; BUILDINGS.forEach(function (b) { B[b.id] = b; });

  /* ---------- landmarks: one of a kind. Research teaches the town to build one; it is then built once ---------- */
  function LM(id, age, name, fx, desc, rank, text) { return { id: id, age: age, name: name, fx: fx, desc: desc, rank: rank || 0, text: text }; }
  const hero15 = { type: 'hero', m: 1.15 }, old3 = { type: 'old', m: 3 }, store2 = { type: 'store', h: 2 };
  const LANDMARKS = [
    LM('watch', 1, 'Watchtower', { type: 'unlock', what: 'heroes' }, 'The Warden answers its beacon, and heroes can be called.', 0, 'A timber tower at the end of the street, with a fire basket on top.'),
    LM('market', 1, 'Market square', { type: 'unlock', what: 'events' }, 'Travellers and news reach the town. Now and then something happens, and you decide.', 2, 'Stalls, a cross and a patch of beaten earth where the roads meet.'),
    LM('forge', 1, 'Forge', hero15, 'Heroes are 15% stronger.', 0, 'A smithy that works iron for more than ploughshares.'),
    LM('moot', 1, 'Moot hall', { type: 'all', m: 1.25 }, 'All production +25%.', 3, 'Where the charter is kept and quarrels are settled.'),
    LM('hall', 2, 'Town hall', { type: 'unlock', what: 'edicts' }, 'You can proclaim an edict: one boost of your choice, renewed every eight hours.', 4, 'A council chamber over an arcade, with a clock that is nearly right.'),
    LM('ware', 2, 'Bonded warehouses', store2, 'Storehouses hold two more hours of output.', 0, 'Gabled stores along the water, each with its own hoist.'),
    LM('armoury', 2, 'Armoury', hero15, 'Heroes are 15% stronger.', 0, 'Pikes, powder and breastplates under one guarded roof.'),
    LM('corn', 2, 'Corn exchange', old3, 'Every Medieval building produces three times as much.', 5, 'The harvest of the whole valley is priced here before it is cut.'),
    LM('station', 3, 'Telegraph office', { type: 'unlock', what: 'party2' }, 'A second party can be away at the same time.', 6, 'Orders that took a week by road now arrive before the ink is dry.'),
    LM('depot', 3, 'Goods depot', store2, 'Storehouses hold two more hours of output.', 0, 'Sidings and sheds where wagons wait their turn.'),
    LM('arms', 3, 'Arms works', hero15, 'Heroes are 15% stronger.', 0, 'Rifled barrels by the thousand.'),
    LM('engine', 3, 'Engine house', old3, 'Every building from an earlier age produces three times as much.', 7, 'One great beam engine drives the shafts of half the town.'),
    LM('container', 4, 'Container terminal', store2, 'Storehouses hold two more hours of output.', 0, 'Stacks of steel boxes under a gantry crane.'),
    LM('radio', 4, 'Broadcasting house', { type: 'edictTime', m: 2 }, 'Edicts last sixteen hours instead of eight.', 8, 'One voice reaches every kitchen in the country.'),
    LM('proving', 4, 'Proving ground', hero15, 'Heroes are 15% stronger.', 0, 'A fenced range where equipment is tried before it is trusted.'),
    LM('grid', 4, 'Grid control', old3, 'Every building from an earlier age produces three times as much.', 9, 'A room of dials that keeps the whole country lit.'),
    LM('tracking', 5, 'Tracking station', { type: 'loot', m: 1.25 }, 'Expeditions bring back 25% more.', 0, 'It knows where every hull is, and where it will be.'),
    LM('control', 5, 'Mission control', { type: 'unlock', what: 'party3' }, 'A third party can be away at the same time.', 10, 'Rows of consoles facing one great screen.'),
    LM('exo', 5, 'Exoframe bay', hero15, 'Heroes are 15% stronger.', 0, 'Powered frames hang in rows, waiting for their wearers.'),
    LM('fusion', 5, 'Fusion plant', old3, 'Every building from an earlier age produces three times as much.', 0, 'A ring of magnets holding a piece of the sun.')
  ];
  const LANDMARK = {}; LANDMARKS.forEach(function (l) { LANDMARK[l.id] = l; });

  /* ---------- town ranks: the settlement is counted in people, and every rank opens something ---------- */
  const RANKS = [null,
    { name: 'Hamlet', text: 'A few families at a ford.' },
    { name: 'Village', opens: 'The people can be set to tasks.', text: 'Enough hands that not everyone must farm.' },
    { name: 'Town', opens: 'A place of honour: one item can be kept in the town.', text: "It has a name on other people's maps." },
    { name: 'Borough', text: 'It keeps its own seal and its own walls.' },
    { name: 'City', opens: 'A second place of honour.', text: 'Strangers come here to stay.' },
    { name: 'Great city', text: 'Its smoke can be seen from the next county.' },
    { name: 'Metropolis', opens: 'A third place of honour.', text: 'No one living has walked every street of it.' },
    { name: 'Capital', text: 'What is decided here is obeyed far away.' },
    { name: 'Megalopolis', opens: 'A fourth place of honour.', text: 'The towns around it have become its suburbs.' },
    { name: 'World city', text: 'Every language is spoken in its streets.' }
  ];
  const AGE_RANKS = [null, [2, 3], [4, 5], [6, 7], [8, 9], [10]];      // the ranks a town usually reaches in each age

  /* ---------- research: ten topics per age. The trunks improve the three kinds of building of the age and
     let their larger named buildings be raised; the other four each teach a landmark. ---------- */
  function T(age, slot, name, fx) { return { id: 't' + age + '_' + slot, age: age, slot: slot, name: name, fx: fx, desc: '' }; }
  const x2 = function (b) { return { type: 'b', b: b, m: 2 }; };
  const lm = function (id) { return { type: 'lm', id: id }; };
  const TECHS = [
    T(1, 0, 'Three-field rotation', x2('farm')), T(1, 1, 'Oath of watch', lm('watch')), T(1, 2, 'Sawpits', x2('lumber')), T(1, 3, 'Carolingian script', x2('script')), T(1, 4, 'Market rights', lm('market')),
    T(1, 5, 'Heavy plough', x2('farm')), T(1, 6, 'Tempered steel', lm('forge')), T(1, 7, 'Water-driven saws', x2('lumber')), T(1, 8, 'Cathedral schools', x2('script')), T(1, 9, 'Royal charter', lm('moot')),

    T(2, 0, 'Double-entry bookkeeping', x2('guild')), T(2, 1, 'Proclamations', lm('hall')), T(2, 2, 'Treadwheel cranes', x2('mason')), T(2, 3, 'Movable type', x2('univ')), T(2, 4, 'Bonded storage', lm('ware')),
    T(2, 5, 'Joint-stock companies', x2('guild')), T(2, 6, 'Pike and shot', lm('armoury')), T(2, 7, 'Geometry of vaults', x2('mason')), T(2, 8, 'Experimental method', x2('univ')), T(2, 9, 'Improved husbandry', lm('corn')),

    T(3, 0, 'Limited liability', x2('bank')), T(3, 1, 'Electric telegraph', lm('station')), T(3, 2, 'Bessemer converters', x2('steel')), T(3, 3, 'Spectroscopy', x2('obs')), T(3, 4, 'Rail freight', lm('depot')),
    T(3, 5, 'Gold standard', x2('bank')), T(3, 6, 'Rifled barrels', lm('arms')), T(3, 7, 'Open-hearth furnaces', x2('steel')), T(3, 8, 'Photographic plates', x2('obs')), T(3, 9, 'Steam mechanisation', lm('engine')),

    T(4, 0, 'Electronic trading', x2('exch')), T(4, 1, 'Catalytic cracking', x2('refin')), T(4, 2, 'Peer review', x2('inst')), T(4, 3, 'Containerisation', lm('container')), T(4, 4, 'Wireless broadcasting', lm('radio')),
    T(4, 5, 'Global markets', x2('exch')), T(4, 6, 'Composite armor', lm('proving')), T(4, 7, 'Petrochemicals', x2('refin')), T(4, 8, 'Integrated circuits', x2('inst')), T(4, 9, 'Electrification', lm('grid')),

    T(5, 0, 'Launch markets', x2('port')), T(5, 1, 'Additive manufacturing', x2('fab')), T(5, 2, 'Interferometry', x2('array')), T(5, 3, 'Stellar cartography', lm('tracking')), T(5, 4, 'Orbital logistics', lm('control')),
    T(5, 5, 'Reusable boosters', x2('port')), T(5, 6, 'Powered exoframes', lm('exo')), T(5, 7, 'Closed-loop fabrication', x2('fab')), T(5, 8, 'Machine inference', x2('array')), T(5, 9, 'Fusion power', lm('fusion'))
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
  /* what each topic opens, and its description in words */
  const TRUNK = { gold: ['G1', 'G2'], mat: ['M1', 'M2'], kn: ['K1', 'K2'] };
  BUILDINGS.forEach(function (b) { b.need = [null, ROLE_ID[b.age][TRUNK[b.res][0]], ROLE_ID[b.age][TRUNK[b.res][1]]]; });
  TECHS.forEach(function (t) {
    if (t.fx.type === 'b') {
      const b = B[t.fx.b], second = t.id === b.need[2];
      t.marks = second ? [2, 3] : [1];
      t.desc = second ? b.pl + ' produce twice as much again. The ' + b.marks[2] + ' can be raised at 50 of them and the ' + b.marks[3] + ' at 100.'
        : b.pl + ' produce twice as much. The ' + b.marks[1] + ' can be raised at 25 of them.';
    } else if (t.fx.type === 'lm') {
      const l = LANDMARK[t.fx.id]; l.tech = t.id;
      t.desc = 'The town learns to build the ' + l.name + '. ' + l.desc;
    }
  });

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

  /* ---------- discoveries: the first victory on an expedition finds a place. A route works from that day on;
     a site needs an outpost built before it gives anything. They stay behind when the world is left. ---------- */
  function DZ(id, from, kind, name, fx, desc, text, build) { return { id: id, age: +id.charAt(1), from: from, kind: kind, name: name, fx: fx, desc: desc, text: text, build: build || null }; }
  const DISCOVERIES = [
    DZ('d1a', 'm1a', 'route', 'The charcoal road', { type: 'res', res: 'mat', m: 1.1 }, 'Materials +10%.', 'Burners in the deep wood will sell to anyone who keeps the road safe.'),
    DZ('d1b', 'm1b', 'route', 'The salt road', { type: 'res', res: 'gold', m: 1.15 }, 'Gold +15%.', 'The caravans now pass through the town and pay their toll.'),
    DZ('d1c', 'm1c', 'site', 'The old mine', { type: 'res', res: 'mat', m: 1.25 }, 'Materials +25%.', 'The galleries are sound. It needs props, pumps and men.', 'Mine workings'),
    DZ('d2a', 'm2a', 'route', 'The coastal passage', { type: 'res', res: 'kn', m: 1.1 }, 'Knowledge +10%.', 'With a true chart, ships and letters arrive in half the time.'),
    DZ('d2b', 'm2b', 'route', 'The spice route', { type: 'res', res: 'gold', m: 1.2 }, 'Gold +20%.', 'Pepper, cloves and the credit that follows them.'),
    DZ('d2c', 'm2c', 'site', 'The pirate haven', { type: 'loot', m: 1.25 }, 'Expeditions bring back 25% more.', 'A deep anchorage that no longer belongs to anyone.', 'Free port'),
    DZ('d3a', 'm3a', 'site', 'The coal field', { type: 'res', res: 'mat', m: 1.25 }, 'Materials +25%.', 'Seams a yard thick, close to the surface.', 'Colliery'),
    DZ('d3b', 'm3b', 'route', 'The border road', { type: 'res', res: 'gold', m: 1.15 }, 'Gold +15%.', 'What was smuggled now pays duty.'),
    DZ('d3c', 'm3c', 'site', 'The frontier fort', { type: 'hero', m: 1.15 }, 'Heroes are 15% stronger.', 'Half ruined, but it commands the line.', 'Garrison'),
    DZ('d4a', 'm4a', 'route', 'The polar air route', { type: 'time', m: 0.85 }, 'Expeditions take 15% less time.', 'Over the top of the world, a day is saved each way.'),
    DZ('d4b', 'm4b', 'route', 'The treaty port', { type: 'res', res: 'gold', m: 1.2 }, 'Gold +20%.', 'The embassy stands, and so does the trade agreement.'),
    DZ('d4c', 'm4c', 'site', 'The polar station', { type: 'res', res: 'kn', m: 1.25 }, 'Knowledge +25%.', 'A hundred thousand winters lie frozen under it.', 'Ice core laboratory'),
    DZ('d5a', 'm5a', 'site', 'The debris field', { type: 'res', res: 'mat', m: 1.25 }, 'Materials +25%.', 'A century of dead hardware in one orbit.', 'Orbital scrapyard'),
    DZ('d5b', 'm5b', 'site', 'The lunar mine', { type: 'res', res: 'gold', m: 1.25 }, 'Gold +25%.', 'The crews will work again, under better terms.', 'Helium works'),
    DZ('d5c', 'm5c', 'site', "The probe's source", { type: 'res', res: 'kn', m: 1.25 }, 'Knowledge +25%.', 'The signal came from somewhere. Now you know where to listen.', 'Listening post')
  ];
  const DISCOVERY = {}, DISC_FROM = {}; DISCOVERIES.forEach(function (x) { DISCOVERY[x.id] = x; DISC_FROM[x.from] = x; });

  /* ---------- items: brought back from expeditions and kept across worlds. An item does one thing when a hero
     carries it and another when it is kept in a place of honour in the town. You choose where each one is. ---------- */
  function IT(id, from, chance, name, hero, heroDesc, city, cityDesc) { return { id: id, age: +id.charAt(1), from: from, chance: chance, name: name, hero: hero, heroDesc: heroDesc, city: city, cityDesc: cityDesc }; }
  const res = function (r, m) { return { type: 'res', res: r, m: m }; };
  const ITEMS = [
    IT('r1b', 'm1b', 0.4, "Saltmaster's seal", { type: 'loot', m: 1.2 }, 'The party brings back 20% more.', res('gold', 1.1), 'Gold +10%.'),
    IT('r1a', 'm1c', 0.35, 'Reliquary of the First Abbot', { type: 'self', m: 1.25 }, 'Its bearer is 25% stronger.', res('kn', 1.1), 'Knowledge +10%.'),
    IT('r1t', 'trial1', 1, "The Warlord's Banner", { type: 'party', m: 1.1 }, 'The whole party is 10% stronger.', res('mat', 1.1), 'Materials +10%.'),
    IT('r2b', 'm2b', 0.4, "Pilot's rutter", { type: 'time', m: 0.85 }, 'The party is away 15% less time.', res('gold', 1.1), 'Gold +10%.'),
    IT('r2a', 'm2c', 0.35, 'Portolan of the Southern Sea', { type: 'loot', m: 1.25 }, 'The party brings back 25% more.', res('kn', 1.1), 'Knowledge +10%.'),
    IT('r2t', 'trial2', 1, "The Admiral's Astrolabe", { type: 'party', m: 1.1 }, 'The whole party is 10% stronger.', { type: 'techCost', m: 0.9 }, 'Research costs 10% less.'),
    IT('r3b', 'm3b', 0.4, "Smuggler's lantern", { type: 'self', m: 1.25 }, 'Its bearer is 25% stronger.', { type: 'store', h: 1 }, 'Storehouses hold one more hour of output.'),
    IT('r3a', 'm3c', 0.35, 'The First Rail Spike', { type: 'xp', m: 1.5 }, 'The party learns half as fast again.', res('mat', 1.15), 'Materials +15%.'),
    IT('r3t', 'trial3', 1, 'The Syndicate Ledger', { type: 'loot', m: 1.25 }, 'The party brings back 25% more.', res('gold', 1.15), 'Gold +15%.'),
    IT('r4b', 'm4b', 0.4, "The Ambassador's flag", { type: 'party', m: 1.1 }, 'The whole party is 10% stronger.', { type: 'projCost', m: 0.9 }, 'Great projects cost 10% less.'),
    IT('r4a', 'm4c', 0.35, 'Flight Recorder Seven', { type: 'time', m: 0.85 }, 'The party is away 15% less time.', res('kn', 1.15), 'Knowledge +15%.'),
    IT('r4t', 'trial4', 1, 'The Cipher Machine', { type: 'self', m: 1.3 }, 'Its bearer is 30% stronger.', { type: 'techCost', m: 0.9 }, 'Research costs 10% less.'),
    IT('r5b', 'm5b', 0.4, "The foreman's log", { type: 'xp', m: 1.5 }, 'The party learns half as fast again.', res('mat', 1.15), 'Materials +15%.'),
    IT('r5a', 'm5c', 0.35, 'Core of the Silent Probe', { type: 'self', m: 1.3 }, 'Its bearer is 30% stronger.', res('kn', 1.2), 'Knowledge +20%.'),
    IT('r5t', 'trial5', 1, 'Keel Plate of the Station', { type: 'party', m: 1.12 }, 'The whole party is 12% stronger.', { type: 'all', m: 1.1 }, 'All production +10%.')
  ];
  const ITEM = {}, ITEM_FROM = {}; ITEMS.forEach(function (x) { ITEM[x.id] = x; ITEM_FROM[x.from] = x; });

  /* ---------- events: once the market stands, news reaches the town and asks for a decision.
     name: one line per age. a, b: the two choices, as a label and a list of outcomes.
     Outcomes: gain/pay/lose a resource (hours of your own output), people (in buildings' worth), work on the
     great work, xp for every hero (hours), boost a resource for some hours, or risk (chance, if it goes well, if not). */
  const EVENTS = [
    { id: 'caravan', name: ['A salt caravan at the ford', 'A merchant convoy at the gate', 'A goods train held at the junction', 'A freight convoy off the motorway', 'A cargo lander asking for a pad'],
      text: 'They ask leave to trade here for a day.',
      a: ['Let them trade', [['gain', 'gold', 1.5]]], b: ['Buy the whole load', [['pay', 'gold', 1], ['gain', 'mat', 2.5]]] },
    { id: 'scholar', need: 'heroes', name: ['A travelling monk', 'A scholar from the south', 'A visiting engineer', 'A professor on sabbatical', 'A surveyor back from the belt'],
      text: 'A guest of some learning will stay a season, if there is work.',
      a: ['A desk among the books', [['gain', 'kn', 2]]], b: ['Have the heroes taught', [['xp', 2]]] },
    { id: 'fire', name: ['Fire in the thatch', 'Fire in the warehouses', 'Fire at the mill', 'Fire at the depot', 'A breach in the dome'],
      text: 'It is spreading along the row.',
      a: ['Pull the row down', [['lose', 'mat', 0.5]]], b: ['Fight it where it stands', [['risk', 0.6, [], [['lose', 'mat', 1.5]]]]] },
    { id: 'feast', name: ['The harvest is in', 'Carnival week', 'The jubilee', 'The city marathon', 'Landing day'],
      text: 'The town expects a holiday.',
      a: ['Hold the feast', [['pay', 'gold', 1], ['people', 12]]], b: ['Work as usual', [['gain', 'gold', 0.75]]] },
    { id: 'settlers', need: 'works', name: ['Families from the hills', 'Weavers fleeing a war', 'Hands from the country', 'Newcomers at the station', 'A colony ship turned back'],
      text: 'They ask for a place here.',
      a: ['Give them land', [['people', 20]]], b: ['Hire them for the great work', [['work', 4]]] },
    { id: 'find', name: ['A hoard under the plough', 'A wreck on the bar', 'A seam under the yard', 'A forgotten patent', 'A derelict in high orbit'],
      text: 'By old right it belongs to the town.',
      a: ['Sell it', [['gain', 'gold', 2]]], b: ['Study it', [['gain', 'kn', 2]]] },
    { id: 'dispute', name: ['A quarrel over the commons', 'The guilds at odds', 'A strike at the works', 'A dispute at the docks', 'The habitat council splits'],
      text: 'Both sides want your word, and one of them will get it.',
      a: ['Favour trade', [['boost', 'gold', 1.3, 4]]], b: ['Favour the yards', [['boost', 'mat', 1.3, 4]]] },
    { id: 'venture', name: ['A trader wants a partner', 'A share in a voyage', 'Railway shares', 'A stake in an oil field', 'A stake in an asteroid claim'],
      text: 'Three for every one, if it comes off.',
      a: ['Put money in', [['pay', 'gold', 1], ['risk', 0.55, [['gain', 'gold', 3]], []]]], b: ['Keep the purse shut', [['gain', 'gold', 0.25]]] },
    { id: 'master', need: 'works', name: ['A master builder passes through', 'An architect from the south', 'A railway engineer on leave', 'A firm of consultants', 'A shipwright from the yards'],
      text: 'A few days can be spared, and no more.',
      a: ['Put the visit to the great work', [['work', 5]]], b: ['Have the yards inspected', [['gain', 'mat', 1.5]]] },
    { id: 'envoys', name: ['Envoys from the next valley', 'Envoys from a rival city', 'A trade delegation', 'A foreign minister', 'Envoys from the outer stations'],
      text: 'They bring gifts and expect some.',
      a: ['Exchange gifts', [['pay', 'gold', 0.5], ['gain', 'kn', 1.5]]], b: ['Open the road to them', [['gain', 'gold', 0.6], ['gain', 'mat', 0.6]]] }
  ];
  const EVENT = {}; EVENTS.forEach(function (e) { EVENT[e.id] = e; });

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
      [1, 3, 8, 30, 800, 4000, 14000, 35000, 75000, 150000],
      [130000, 210000, 320000, 500000, 770000, 1.2e6, 1.9e6, 2.9e6, 4.5e6, 6.9e6],
      [1.3e7, 2e7, 3.1e7, 4.8e7, 7.5e7, 1.2e8, 1.8e8, 2.8e8, 4.3e8, 6.7e8],
      [3.8e8, 5.9e8, 9.1e8, 1.4e9, 2.2e9, 3.4e9, 5.2e9, 8.1e9, 1.3e10, 2e10],
      [8.7e9, 1.4e10, 2.1e10, 3.3e10, 5e10, 7.8e10, 1.2e11, 1.9e11, 2.9e11, 4.5e11]],
    // cost of each great project stage
    proj: [null,
      { gold: [590000, 4.4e6, 1.5e7], mat: [50000, 370000, 1.3e6], kn: [0, 0, 330000] },
      { gold: [7.6e7, 2.3e8, 4.6e8, 7.6e8], mat: [5.9e6, 1.8e7, 3.7e7, 5.9e7], kn: [0, 0, 0, 1e7] },
      { gold: [2.6e9, 7.8e9, 1.6e10, 2.6e10], mat: [1.3e8, 3.9e8, 7.8e8, 1.3e9], kn: [0, 0, 0, 3.3e7] },
      { gold: [2.4e11, 5.4e11, 1.1e12, 1.7e12, 2.6e12], mat: [2.2e10, 5e10, 9e10, 1.5e11, 2.3e11], kn: [0, 0, 0, 0, 5.7e10] },
      { gold: [8.2e12, 1.8e13, 3.4e13, 5.6e13, 8.2e13], mat: [5.5e11, 1.2e12, 2.3e12, 3.8e12, 5.7e12], kn: [0, 0, 0, 0, 1.1e12] }],
    // work each stage needs. A standing crew gives one work an hour, and so does every tenth of the people set to it
    work: [null, [3, 6, 12], [8, 10, 12, 14], [12, 14, 16, 18], [14, 16, 18, 20, 22], [16, 18, 20, 22, 24]],
    hero: { warden: 0, ranger: 210, physician: 62000, carto: 2.7e7, engineer: 1.5e9, envoy: 4.3e10, pilot: 1e12 },
    gear: [74000, 260000, 1.8e6, 6.3e6, 1e8, 3.5e8, 2.4e9, 8.4e9, 1.1e11, 3.9e11],   // materials to raise equipment from level i to i+1
    enemy: [null, { hp: 830, atk: 92 }, { hp: 3200, atk: 360 }, { hp: 9100, atk: 1000 }, { hp: 58000, atk: 6400 }, { hp: 180000, atk: 20000 }],
    rank: [0, 0, 250, 950, 3100, 4300, 13000, 20000, 67000, 130000, 500000],     // people a town needs for each rank
    // gold and materials to build each landmark, and each outpost at a discovered site
    lm: { watch: [600, 250], market: [4000, 1500], forge: [5.9e6, 900000], moot: [4.1e6, 630000],
      hall: [3.8e7, 4.6e6], ware: [3.8e7, 4.6e6], armoury: [6.2e8, 5.8e7], corn: [4.3e8, 4.1e7],
      station: [2.2e9, 1.9e8], depot: [4.4e9, 2.7e8], arms: [2.9e10, 2.7e9], engine: [5.1e10, 3.9e9],
      container: [9.6e10, 6.2e9], radio: [2e11, 1.3e10], proving: [4.7e11, 5.2e10], grid: [1.3e12, 1.6e11],
      tracking: [3.1e12, 3.8e11], control: [6.2e12, 4.9e11], exo: [4.3e13, 3e12], fusion: [3.1e13, 1.9e12] },
    disc: { d1c: [800000, 200000], d2c: [8e7, 1.5e7], d3a: [1e9, 2e8], d3c: [1.7e10, 1.6e9],
      d4c: [7.8e11, 9.6e10], d5a: [2e12, 3e11], d5b: [1.8e12, 2.2e11], d5c: [2.5e13, 1.7e12] }
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
  function count(s, id) { return s.b[id] || 0; }
  function techCount(s, age) { let n = 0; for (const id in s.tech) if (!age || TECH[id].age === age) n++; return n; }
  function itemCount(s) { let n = 0; for (const k in s.items) n++; return n; }
  function discCount(s, age) { let n = 0; for (const k in s.disc) if (!age || DISCOVERY[k].age === age) n++; return n; }
  function has(s, what) {   // things a landmark opens
    for (const id in s.lm) { const l = LANDMARK[id]; if (l && l.fx.type === 'unlock' && l.fx.what === what) return true; }
    return false;
  }
  function jobName(job, age) { return JOB_NAMES[job][Math.min(5, Math.max(1, age)) - 1]; }

  /* ---------- named buildings ---------- */
  function markNeed(b, i) { return i === 0 ? null : b.need[i === 1 ? 1 : 2]; }      // the topic the i-th doubling of a kind waits for
  function doublingsAt(s, b, n) {
    let k = 0;
    for (let i = 0; i < MILESTONES.length; i++) { if (n < MILESTONES[i]) break; const need = markNeed(b, i); if (need && !s.tech[need]) break; k++; }
    return k;
  }
  function doublings(s, b) { return doublingsAt(s, b, s.b[b.id] || 0); }
  function multAt(s, b, n) { return Math.pow(2, doublingsAt(s, b, n)); }
  function nextMark(s, b) {     // the next doubling of a kind: how many it takes, its name, and the topic it still waits for
    const k = doublings(s, b); if (k >= MILESTONES.length) return null;
    const need = markNeed(b, k);
    return { i: k, at: MILESTONES[k], prev: k ? MILESTONES[k - 1] : 0, name: k < NAMED ? b.marks[k] : null, need: need && !s.tech[need] ? need : null };
  }

  /* ---------- the town: people and rank ---------- */
  function people(s) {
    let p = 12 + (s.settlers || 0);
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i], n = s.b[b.id] || 0; if (!n) continue;
      let u = n; const k = Math.min(NAMED, doublings(s, b)); for (let j = 0; j < k; j++) u += MARK_PEOPLE[j];
      p += u * PEOPLE[b.age];
    }
    for (const id in s.lm) if (LANDMARK[id]) p += 10 * PEOPLE[LANDMARK[id].age];
    for (const id in s.disc) if (s.disc[id] === 2 && DISCOVERY[id]) p += 10 * PEOPLE[DISCOVERY[id].age];      // roads and outposts bring people too
    for (let a = 1; a <= s.age; a++) p += 15 * PEOPLE[a] * (a < s.age ? PROJECTS[a].stages.length : s.project);  // and so does every stage of a great work
    return Math.floor(p);
  }
  function rankFor(p) { let r = 1; for (let i = 2; i < RANKS.length; i++) if (p >= TUNE.rank[i]) r = i; return r; }
  function jobPower(rank) { return rank < 2 ? 0 : 0.08 + 0.03 * (rank - 2); }        // what one tenth of the people adds to its line
  function citySlots(s) { return s.rank >= 3 ? 1 + Math.floor((s.rank - 3) / 2) : 0; }   // places of honour
  function rankOpens(r) {       // what a rank brings, in words
    const out = [];
    if (RANKS[r].opens) out.push(RANKS[r].opens);
    LANDMARKS.forEach(function (l) { if (l.rank === r) out.push('The ' + l.name + ' can be built, once learned.'); });
    if (r > 2) out.push('Each tenth of the people adds ' + Math.round(jobPower(r) * 100) + '% to its task, up from ' + Math.round(jobPower(r - 1) * 100) + '%.');
    return out;
  }
  function news(s, o) { s.news.push(o); if (s.news.length > 24) s.news.splice(0, s.news.length - 24); }
  /* After anything that can change the town: raise the named buildings that are due and the rank. Each is put in
     s.news for the interface to celebrate. */
  function settle(s, now) {
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i], k = doublings(s, b), was = s.marks[b.id] || 0;
      if (k <= was) continue;
      for (let j = was; j < k; j++) { news(s, { k: 'mark', b: b.id, i: j }); if (j < NAMED) addLog(s, now, b.marks[j] + ' raised. ' + b.pl + ' produce twice as much.'); }
      s.marks[b.id] = k;
    }
    const r = rankFor(people(s));
    while (s.rank < r) { s.rank++; news(s, { k: 'rank', r: s.rank }); addLog(s, now, 'The ' + RANKS[s.rank - 1].name.toLowerCase() + ' has grown into a ' + RANKS[s.rank].name.toLowerCase() + '.'); }
    if (s.jobs.work > 0 && !worksOpen(s)) { s.jobs.idle += s.jobs.work; s.jobs.work = 0; if (s.rank >= 2) news(s, { k: 'idle' }); }      // no great work to raise: the builders stand idle until they are given a task
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
      b: {}, marks: {}, tech: {}, doctrine: {}, lm: {}, project: 0, work: 0, trialWon: {}, trialTries: {},
      rank: 1, settlers: 0, jobs: { gold: 4, mat: 3, kn: 3, work: 0, idle: 0 },
      heroes: {}, parties: [], reports: [], lineup: [], edict: null, boost: null, items: {}, disc: {},
      ev: { next: 0, cur: null, n: 0, last: '', seen: {} }, goals: {}, news: [],
      legacy: { pts: 0, earned: 0, perks: {}, runs: 0 },
      stats: { taps: 0, sent: 0, wins: 0, awaySec: 0, checkins: 0, moves: 0, events: 0, claimed: 0 },
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
      case 'all': { const m = levels ? 1 + fx.m * n : fx.m; for (const r of RES) d.rm[r] *= m; d.wm *= m; break; }
      case 'res': d.rm[fx.res] *= fx.m; break;
      case 'store': d.storeH += fx.h * n; break;
      case 'hero': d.heroPow *= levels ? 1 + fx.m * n : fx.m; break;
      case 'loot': d.loot *= fx.m; break;
      case 'time': d.time *= levels ? Math.pow(1 - fx.m, n) : fx.m; break;
      case 'techCost': d.techCost *= levels ? Math.pow(1 - fx.m, n) : fx.m; break;
      case 'projCost': d.projCost *= levels ? Math.pow(1 - fx.m, n) : fx.m; break;
      case 'edictTime': d.edictH *= fx.m; break;
      case 'unlock': if (fx.what === 'party2' || fx.what === 'party3') d.slots++; break;
    }
  }
  /* edictOn: true or false forces the edict state, undefined reads it from the clock */
  function derive(s, now, edictOn) {
    const d = { bm: {}, rm: { gold: 1, mat: 1, kn: 1 }, rate: { gold: 0, mat: 0, kn: 0 }, storeH: BASE_STORE_H,
      heroPow: 1, loot: 1, time: 1, techCost: 1, projCost: 1, slots: 1, muster: 1, edict: null, edictH: EDICT_HOURS, jp: 0, wm: 1, work: 0, boost: null };
    for (const id in s.tech) { const t = TECH[id]; if (t.fx.type !== 'lm') applyFx(d, t.fx, t.age); }
    for (const id in s.lm) { const l = LANDMARK[id]; if (l) applyFx(d, l.fx, l.age); }
    for (const a in s.doctrine) { const doc = DOCTRINE[s.doctrine[a]]; if (doc) applyFx(d, doc.fx, doc.age); }
    for (const id in s.disc) if (s.disc[id] === 2 && DISCOVERY[id]) applyFx(d, DISCOVERY[id].fx, 0);
    let kept = 0; const places = citySlots(s);
    for (const id in s.items) if (s.items[id] === 'city' && ITEM[id] && kept < places) { kept++; applyFx(d, ITEM[id].city, 0); }
    for (const id in s.legacy.perks) { const p = PERK[id], lv = s.legacy.perks[id]; if (p && lv > 0) applyFx(d, p.fx, 0, lv); }
    const active = edictOn === undefined ? !!(s.edict && s.edict.until > now) : (edictOn && !!s.edict);
    if (active) {
      const e = EDICT[s.edict.id]; d.edict = e;
      if (e.fx.type === 'hero') d.muster = e.fx.m; else applyFx(d, e.fx, 0);
    }
    if (s.rank >= 2) {                       // the people at their tasks
      d.jp = jobPower(s.rank);
      for (const r of RES) d.rm[r] *= 1 + d.jp * (s.jobs[r] || 0);
    }
    if (worksOpen(s) && s.work < stageWork(s)) d.work = (1 + (s.rank >= 2 ? s.jobs.work || 0 : 0)) * d.wm;      // work an hour: the standing crew and the builders
    if (s.boost && s.boost.until > now) { d.boost = s.boost; if (s.boost.res === 'all') { for (const r of RES) d.rm[r] *= s.boost.m; } else d.rm[s.boost.res] *= s.boost.m; }
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i], n = s.b[b.id] || 0;
      if (!n) continue;
      d.rate[b.res] += n * b.prod * (d.bm[b.id] || 1) * multAt(s, b, n);
    }
    for (const r of RES) d.rate[r] *= d.rm[r];
    return d;
  }
  function unitRate(s, d, b) {   // output of one building of this kind, at the current count
    return b.prod * (d.bm[b.id] || 1) * multAt(s, b, s.b[b.id] || 0) * d.rm[b.res];
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
  function buy(s, id, qty, now) {
    const b = B[id];
    if (!b || !buildingVisible(s, b)) return 0;
    const n = s.b[id] || 0;
    if (qty === 'max') qty = maxQty(s, b);
    qty = Math.floor(qty);
    if (qty < 1) return 0;
    const c = buildCost(b, n, qty);
    if (!canPay(s, c)) return 0;
    pay(s, c); s.b[id] = n + qty;
    settle(s, now || s.lastTick);
    return qty;
  }
  function work(s, now) {
    const d = derive(s, now), g = Math.max(1, 0.05 * d.rate.gold);
    s.res.gold += g; s.tot.gold += g; s.stats.taps++;
    return g;
  }
  function townOpen(s) { let n = 0; for (const k in s.b) n += s.b[k]; return n >= 5 || s.age > 1 || s.legacy.runs > 0; }

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
    settle(s, now);
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
    s.edict = { id: id, until: now + derive(s, now, false).edictH * HOUR * 1000 };
    return true;
  }

  /* ---------- landmarks ---------- */
  function landmarkState(s, l) {            // built, open (can be built now), rank (learned, but the town is too small), locked (not learned)
    if (s.lm[l.id]) return 'built';
    if (!s.tech[l.tech]) return 'locked';
    return l.rank && s.rank < l.rank ? 'rank' : 'open';
  }
  function landmarkCost(l) { const c = TUNE.lm[l.id] || [0, 0], o = {}; if (c[0] > 0) o.gold = c[0]; if (c[1] > 0) o.mat = c[1]; return o; }
  function buildLandmark(s, id, now) {
    const l = LANDMARK[id];
    if (!l || landmarkState(s, l) !== 'open') return false;
    const c = landmarkCost(l);
    if (!canPay(s, c)) return false;
    pay(s, c); s.lm[id] = 1;
    addLog(s, now, 'The ' + l.name + ' is built.');
    if (l.fx.type === 'unlock' && l.fx.what === 'heroes' && !s.heroes.warden) {
      s.heroes.warden = { lvl: Math.max(1, 10 * (s.age - 1) + 1), xp: 0, gear: 2 * (s.age - 1) };
      addLog(s, now, 'The Warden swears the oath of watch.');
    }
    if (l.fx.type === 'unlock' && l.fx.what === 'events') s.ev.next = now + 90 * 1000;      // the first news is not long in coming
    news(s, { k: 'lm', id: id });
    settle(s, now);
    return true;
  }

  /* ---------- the people at their tasks ---------- */
  function moveJob(s, from, to) {           // one tenth of the people changes task
    if (s.rank < 2 || from === to || JOBS.indexOf(from) < 0 || JOBS.indexOf(to) < 0 || !(s.jobs[from] > 0)) return false;
    if (to === 'work' && (!worksOpen(s) || s.work >= stageWork(s))) return false;      // nothing for more builders to do
    s.jobs[from]--; s.jobs[to]++; s.stats.moves = (s.stats.moves || 0) + 1;
    return true;
  }
  function setJobs(s, j) {                  // set them all at once; they must add up to ten
    let sum = 0; for (const k of JOBS) { const v = j[k] | 0; if (v < 0) return false; sum += v; }
    if (s.rank < 2 || sum !== 10 || (j.work > 0 && !worksOpen(s))) return false;
    let changed = false; for (const k of JOBS) { if (s.jobs[k] !== (j[k] | 0)) changed = true; s.jobs[k] = j[k] | 0; }
    if (changed) s.stats.moves = (s.stats.moves || 0) + 1;
    return true;
  }

  /* ---------- great project, trial, age ---------- */
  function ageTabOpen(s) { return s.age > 1 || s.project > 0 || techCount(s) >= 3 || s.legacy.runs > 0; }
  function projectDone(s) { return s.project >= PROJECTS[s.age].stages.length; }
  function stageWork(s) { return projectDone(s) ? 0 : (TUNE.work[s.age][s.project] || 0); }   // work the next stage needs from the builders
  function worksOpen(s) { return ageTabOpen(s) && !projectDone(s) && stageWork(s) > 0; }
  function stageCost(s, d) {
    if (projectDone(s)) return null;
    const p = TUNE.proj[s.age], i = s.project, c = {};
    for (const r of RES) { const v = (p[r] && p[r][i]) || 0; if (v > 0) c[r] = Math.ceil(v * d.projCost); }
    return c;
  }
  function stageReady(s, d) {               // paid for and worked for
    const c = stageCost(s, d);
    return !!c && canPay(s, c) && s.work >= stageWork(s) - 1e-6;
  }
  function buildStage(s, now) {
    if (!ageTabOpen(s) || projectDone(s)) return false;
    const d = derive(s, now), c = stageCost(s, d);
    if (!canPay(s, c) || s.work < stageWork(s) - 1e-6) return false;
    pay(s, c); s.work = 0;
    const pr = PROJECTS[s.age];
    addLog(s, now, pr.name + ': ' + pr.stages[s.project].toLowerCase() + ' completed.');
    s.project++;
    if (projectDone(s)) addLog(s, now, pr.done);
    settle(s, now);
    return true;
  }
  function trialOpen(s) { return has(s, 'heroes') && (s.age > 1 || s.project >= 1); }
  function canAdvance(s) { return s.age < 5 && projectDone(s) && !!s.trialWon[s.age]; }
  function advanceAge(s, now) {
    if (!canAdvance(s)) return false;
    s.age++; s.project = 0; s.work = 0; s.ageAt[s.age] = now;
    const base = 10 * (s.age - 1) + 1;                 // a new age brings every hero up to its standard, so no one falls behind for good
    for (const id in s.heroes) if (s.heroes[id].lvl < base) { s.heroes[id].lvl = base; s.heroes[id].xp = 0; }
    addLog(s, now, 'The ' + AGES[s.age].name + ' begins.');
    settle(s, now);
    return true;
  }
  function canDepart(s) { return s.age === 5 && projectDone(s) && !!s.trialWon[5]; }
  function legacyGain(s) { return 40 + 4 * itemCount(s); }
  function depart(s, now) {
    if (!canDepart(s)) return false;
    const gain = legacyGain(s), keep = { legacy: s.legacy, items: s.items, stats: s.stats, created: s.created, world: s.world, seen: s.seen };
    const n = newState(now);
    n.legacy = keep.legacy; n.legacy.pts += gain; n.legacy.earned += gain; n.legacy.runs++;
    for (const id in keep.items) n.items[id] = '';     // the items travel; where they are kept is decided again
    n.stats = keep.stats; n.created = keep.created; n.world = keep.world + 1; n.seen = keep.seen;
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
  function busy(s) { const set = {}; s.parties.forEach(function (p) { p.h.forEach(function (id) { set[id] = 1; }); }); return set; }

  /* ---------- items ---------- */
  function carried(s, heroId) { for (const id in s.items) if (s.items[id] === heroId) return id; return null; }
  function itemsKept(s) { const out = []; for (const id in s.items) if (s.items[id] === 'city') out.push(id); return out; }
  function itemLocked(s, id) { const at = s.items[id]; return !!at && at !== 'city' && !!busy(s)[at]; }     // out with a party
  /* where: 'city', a hero's id, or '' for the strongroom, where it does nothing */
  function placeItem(s, id, where) {
    if (!ITEM[id] || s.items[id] === undefined || itemLocked(s, id)) return false;
    if (where === s.items[id]) return true;
    if (where === 'city') { if (itemsKept(s).length >= citySlots(s)) return false; }
    else if (where) {
      if (!s.heroes[where] || busy(s)[where]) return false;
      const other = carried(s, where); if (other) s.items[other] = '';      // a hero carries one thing: what was carried goes to the strongroom
    }
    s.items[id] = where || '';
    return true;
  }
  function heroStats(s, id, d, muster) {
    const base = HERO[id], h = s.heroes[id], it = carried(s, id), own = it && ITEM[it].hero.type === 'self' ? ITEM[it].hero.m : 1;
    const m = Math.pow(1.07, h.lvl - 1) * Math.pow(1.3, h.gear) * d.heroPow * (muster || 1) * own;
    return { id: id, hp: base.hp * m, max: base.hp * m, atk: base.atk * m, heal: (base.heal || 0) * m };
  }
  function partyBonus(s, ids) {             // what the items a party carries do for it as a whole
    const o = { power: 1, loot: 1, time: 1, xp: 1 };
    for (const id of ids) {
      const it = carried(s, id); if (!it) continue;
      const fx = ITEM[it].hero;
      if (fx.type === 'party') o.power *= fx.m; else if (fx.type === 'loot') o.loot *= fx.m; else if (fx.type === 'time') o.time *= fx.m; else if (fx.type === 'xp') o.xp *= fx.m;
    }
    return o;
  }
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
  function missionTime(s, m, d, ids) { return m.dur * d.time * (ids.indexOf('envoy') >= 0 ? 0.85 : 1) * partyBonus(s, ids).time; }
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
    const k = d.loot * (ids.indexOf('carto') >= 0 ? 1.3 : 1) * partyBonus(s, ids).loot * Math.pow(0.5, Math.max(0, s.age - m.age)), out = {};
    for (const r in m.loot) out[r] = d.rate[r] * m.loot[r] * HOUR * k;
    return out;
  }
  function partyStats(s, ids, d) { const pm = partyBonus(s, ids).power; return ids.map(function (id) { return heroStats(s, id, d, d.muster * pm); }); }
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
    const dur = missionTime(s, m, d, ids), bx = partyBonus(s, ids);
    s.parties.push({ m: mid, h: ids.slice(), t0: now, t1: now + dur * 1000, seed: (now % 2147483647) ^ (s.stats.sent * 2654435761 >>> 0), st: partyStats(s, ids, d), bx: { loot: bx.loot, xp: bx.xp } });
    s.lineup = ids.slice(); s.stats.sent++;
    return true;
  }
  function gainXp(s, id, xp, ups) {
    const h = s.heroes[id]; if (!h) return;
    const cap = levelCap(s), before = h.lvl;
    h.xp += xp;
    while (h.lvl < cap && h.xp >= xpNeed(h.lvl)) { h.xp -= xpNeed(h.lvl); h.lvl++; }
    if (h.lvl >= cap) h.xp = Math.min(h.xp, xpNeed(h.lvl));
    if (h.lvl > before) ups.push({ id: id, lvl: h.lvl });
  }
  function lowerThe(t) { return /^The /.test(t) ? 'the ' + t.slice(4) : t.charAt(0).toLowerCase() + t.slice(1); }
  function short(name) { return name.replace(/^The /, ''); }
  function resolveParty(s, p, now, d) {
    const m = MISSION[p.m], rnd = mulberry32(p.seed ^ 0x9e3779b9), bx = p.bx || { loot: 1, xp: 1 };
    const out = battle(p.st, enemyFor(m, s), p.seed, true);
    const old = Math.pow(0.5, Math.max(0, s.age - m.age));      // ground from an earlier age yields half as much
    const f = (out.result === 'win' ? 1 : out.result === 'draw' ? 0.5 : 0.15) * old;
    const lootMult = d.loot * (p.h.indexOf('carto') >= 0 ? 1.3 : 1) * bx.loot;
    const loot = {};
    for (const r in m.loot) {
      const v = d.rate[r] * m.loot[r] * HOUR * f * lootMult;
      if (v > 0) { loot[r] = v; s.res[r] += v; s.tot[r] += v; }
    }
    const xp = (m.dur / HOUR) * XP_PER_HOUR * (out.result === 'win' ? 1 : out.result === 'draw' ? 0.75 : 0.5) * old * bx.xp;
    const ups = [];
    p.h.forEach(function (id) { gainXp(s, id, xp, ups); });
    let relic = null, found = null;
    if (out.result === 'win') {
      s.stats.wins++;
      const it = ITEM_FROM[m.id];
      if (it && s.items[it.id] === undefined && rnd() < it.chance) { s.items[it.id] = ''; relic = it.id; addLog(s, p.t1, 'Brought back: ' + it.name + '.'); }
      const z = DISC_FROM[m.id];
      if (z && !s.disc[z.id]) { s.disc[z.id] = z.kind === 'route' ? 2 : 1; found = z.id; addLog(s, p.t1, 'Found: ' + lowerThe(z.name) + '.'); settle(s, p.t1); }
      if (m.trial && !s.trialWon[m.age]) { s.trialWon[m.age] = 1; addLog(s, p.t1, m.name + ' is defeated.'); }
    } else if (m.trial) {
      s.trialTries[m.age] = (s.trialTries[m.age] || 0) + 1;
    }
    s.reports.push({ m: p.m, t: p.t1, result: out.result, rounds: out.rounds, loot: loot, xp: xp, ups: ups, relic: relic, disc: found, hp: out.hp, log: out.log, h: p.h.slice() });
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

  /* ---------- outposts at discovered sites ---------- */
  function outpostCost(id) { const c = TUNE.disc[id] || [0, 0], o = {}; if (c[0] > 0) o.gold = c[0]; if (c[1] > 0) o.mat = c[1]; return o; }
  function buildOutpost(s, id, now) {
    const z = DISCOVERY[id];
    if (!z || s.disc[id] !== 1) return false;
    const c = outpostCost(id);
    if (!canPay(s, c)) return false;
    pay(s, c); s.disc[id] = 2;
    addLog(s, now, z.build + ' built at ' + lowerThe(z.name) + '.');
    news(s, { k: 'post', id: id });
    settle(s, now);
    return true;
  }

  /* ---------- outcomes: what an event choice or a goal pays, counted in hours of your own output ---------- */
  const FLOOR = { gold: 40, mat: 15, kn: 3 };
  function amountOf(s, d, r, h, min) { return Math.max(min || 0, FLOOR[r] * h, d.rate[r] * h * HOUR); }
  function canAfford(s, d, list) { for (const e of list) if (e[0] === 'pay' && s.res[e[1]] < amountOf(s, d, e[1], e[2])) return false; return true; }
  function promise(s, d, list) {            // the same list, with today's amounts filled in
    return list.map(function (e) {
      switch (e[0]) {
        case 'gain': return { k: 'gain', res: e[1], v: amountOf(s, d, e[1], e[2], e[3]) };
        case 'pay': return { k: 'pay', res: e[1], v: amountOf(s, d, e[1], e[2]) };
        case 'lose': return { k: 'lose', res: e[1], v: Math.min(s.res[e[1]], amountOf(s, d, e[1], e[2])) };
        case 'people': return { k: 'people', v: e[1] * PEOPLE[s.age] };
        case 'work': return worksOpen(s) && s.work < stageWork(s) ? { k: 'work', v: Math.min(e[1], stageWork(s) - s.work) } : { k: 'gain', res: 'mat', v: amountOf(s, d, 'mat', 1) };
        case 'xp': return { k: 'xp', v: e[1] };
        case 'boost': return { k: 'boost', res: e[1], m: e[2], h: e[3] };
        default: return { k: 'risk', p: e[1], win: promise(s, d, e[2]), lose: promise(s, d, e[3]) };
      }
    });
  }
  function applyOutcome(s, list, now, d, rnd, out) {
    promise(s, d, list).forEach(function (o, i) {
      switch (o.k) {
        case 'gain': s.res[o.res] += o.v; s.tot[o.res] += o.v; out.push(o); break;
        case 'pay': case 'lose': { const v = Math.min(s.res[o.res], o.v); s.res[o.res] -= v; out.push({ k: 'lose', res: o.res, v: v }); break; }
        case 'people': s.settlers = (s.settlers || 0) + o.v; out.push(o); break;
        case 'work': s.work += o.v; out.push(o); break;
        case 'xp': { const ups = []; for (const id in s.heroes) gainXp(s, id, o.v * XP_PER_HOUR, ups); out.push({ k: 'xp', v: o.v, ups: ups }); break; }
        case 'boost': s.boost = { res: o.res, m: o.m, until: now + o.h * HOUR * 1000 }; out.push(o); break;
        default: { const ok = rnd() < o.p; out.push({ k: 'luck', ok: ok }); applyOutcome(s, ok ? list[i][2] : list[i][3], now, d, rnd, out); }
      }
    });
    return out;
  }

  /* ---------- events ---------- */
  function eventOk(s, e) { return !e.need || (e.need === 'heroes' ? Object.keys(s.heroes).length > 0 : worksOpen(s) && s.work < stageWork(s)); }
  function nextEvent(s, now) {              // news arrives when none is waiting and enough time has passed since the last
    if (!has(s, 'events') || s.ev.cur || now < s.ev.next) return false;
    const rnd = mulberry32(((s.created % 2147483647) ^ Math.imul(s.ev.n + 1, 0x9e3779b1)) >>> 0);
    let pool = EVENTS.filter(function (e) { return eventOk(s, e) && e.id !== s.ev.last; });
    const fresh = pool.filter(function (e) { return !s.ev.seen[e.id]; });
    if (fresh.length) pool = fresh;
    if (!pool.length) return false;
    s.ev.cur = { id: pool[Math.floor(rnd() * pool.length)].id, t: now, age: s.age };
    return true;
  }
  function eventView(s, now) {              // the waiting event in words: for each choice its label, what it promises and whether it can be paid
    const cur = s.ev.cur; if (!cur || !EVENT[cur.id]) return null;
    const e = EVENT[cur.id], d = derive(s, now, false);
    return { id: e.id, name: e.name[Math.min(5, Math.max(1, cur.age || s.age)) - 1], text: e.text, t: cur.t,
      choices: [e.a, e.b].map(function (c) { return { label: c[0], ok: canAfford(s, d, c[1]), promise: promise(s, d, c[1]) }; }) };
  }
  function answerEvent(s, i, now) {
    const cur = s.ev.cur; if (!cur || !EVENT[cur.id]) return null;
    const e = EVENT[cur.id], c = i ? e.b : e.a, d = derive(s, now, false);
    if (!canAfford(s, d, c[1])) return null;
    const rnd = mulberry32(((now % 2147483647) ^ Math.imul(s.ev.n + 7, 40503)) >>> 0);
    const out = applyOutcome(s, c[1], now, d, rnd, []);
    addLog(s, now, e.name[Math.min(5, Math.max(1, cur.age || s.age)) - 1] + ': ' + lowerThe(c[0]) + '.');
    s.ev.cur = null; s.ev.n++; s.ev.last = e.id; s.ev.seen[e.id] = (s.ev.seen[e.id] || 0) + 1; s.ev.next = now + EVENT_GAP * 1000;
    s.stats.events = (s.stats.events || 0) + 1;
    settle(s, now);
    return out;
  }

  /* ---------- goals: an ordered list for every age. Three are shown at a time, and each pays when it is claimed. ---------- */
  function buildGoals() {
    const L = [];
    const add = function (id, age, text, icon, of, test, reward) { L.push({ id: id, age: age, text: text, icon: icon, of: of, test: test, reward: reward }); };
    const cnt = function (b) { return function (s) { return s.b[b] || 0; }; };
    const low = function (t) { return t.charAt(0).toLowerCase() + t.slice(1); };
    for (let a = 1; a <= 5; a++) (function (a) {
      const bs = BUILDINGS.filter(function (b) { return b.age === a; }), g = bs[0], m = bs[1], k = bs[2];
      const lms = {}; LANDMARKS.forEach(function (l) { if (l.age === a) lms[TECH[l.tech].role] = l; });
      const pr = PROJECTS[a], tr = TRIALS[a], P = 'g' + a + '_', rk = AGE_RANKS[a];
      const raise = function (b, i, r, h) { add(P + b.id + i, a, 'Raise the ' + b.marks[i] + ': ' + MILESTONES[i] + ' ' + low(b.pl), 'b.' + b.id, 1, function (s) { return doublings(s, b) > i ? 1 : 0; }, [r, h]); };
      const build = function (l, r, h) { add(P + l.id, a, 'Build the ' + l.name, 'lm.' + l.id, 1, function (s) { return s.lm[l.id] ? 1 : 0; }, [r, h]); };
      const grow = function (r, h) { add(P + 'rank' + r, a, 'Grow into a ' + low(RANKS[r].name), 'ui.rank', 1, function (s) { return s.rank >= r ? 1 : 0; }, ['gold', h]); };
      const stg = function (i, h) { add(P + 'stage' + i, a, short(pr.name) + ': ' + low(pr.stages[i]), 'p.' + a, 1, function (s) { return s.age > a || (s.age === a && s.project > i) ? 1 : 0; }, ['mat', h]); };
      const site = DISCOVERIES.filter(function (z) { return z.age === a && z.kind === 'site'; })[0];
      const post = function (h) { if (site) add(P + 'post', a, 'Build the ' + low(site.build), 'd.' + site.id, 1, function (s) { return s.disc[site.id] === 2 ? 1 : 0; }, ['gold', h]); };
      if (a === 1) {
        add('g1_farm5', 1, 'Raise 5 farmsteads', 'b.farm', 5, cnt('farm'), ['gold', 0.01, 15]);
        add('g1_lumber3', 1, 'Raise 3 lumber camps', 'b.lumber', 3, cnt('lumber'), ['gold', 0.01, 30]);
        add('g1_script', 1, 'Build a scriptorium', 'b.script', 1, cnt('script'), ['kn', 0.01, 1]);
        raise(g, 0, 'gold', 0.02);
        add('g1_tech3', 1, 'Research 3 topics', 'tab.council', 3, function (s) { return techCount(s); }, ['kn', 0.03, 3]);
        grow(2, 0.05);
        build(lms.U, 'mat', 0.05);
        add('g1_sent', 1, 'Send a party on an expedition', 'tab.heroes', 1, function (s) { return s.stats.sent; }, ['gold', 0.05]);
        add('g1_jobs', 1, 'Set the people to tasks', 'ui.people', 1, function (s) { return s.stats.moves || 0; }, ['kn', 0.05]);
        build(lms.S, 'gold', 0.08);
        add('g1_event', 1, 'Decide what to do about some news', 'ui.news', 1, function (s) { return s.stats.events || 0; }, ['mat', 0.08]);
        raise(g, 1, 'gold', 0.1); raise(m, 1, 'mat', 0.1); raise(k, 1, 'kn', 0.1);
        add('g1_wins', 1, 'Win 3 expeditions', 'ui.win', 3, function (s) { return s.stats.wins; }, ['gold', 0.15]);
        stg(0, 0.25);
        add('g1_disc', 1, 'Find a place on an expedition', 'ui.found', 1, function (s) { return discCount(s); }, ['kn', 0.25]);
        grow(3, 0.25);
        add('g1_gear', 1, 'Give a hero better equipment', 'ui.gear', 1, function (s) { let x = 0; for (const id in s.heroes) x = Math.max(x, s.heroes[id].gear); return x; }, ['mat', 0.25]);
        add('g1_doc', 1, 'Adopt a doctrine', 'ui.fork', 1, function (s) { return s.doctrine[1] ? 1 : 0; }, ['kn', 0.25]);
        build(lms.H, 'mat', 0.25);
        raise(g, 2, 'gold', 0.25);
        stg(1, 0.4);
        build(lms.C, 'gold', 0.4);
        post(0.4);
        stg(2, 0.5);
      } else {
        raise(g, 0, 'gold', 0.15); raise(m, 0, 'mat', 0.15); raise(k, 0, 'kn', 0.15);
        add(P + 'tech3', a, 'Research 3 topics of the ' + AGES[a].name, 'tab.council', 3, function (s) { return techCount(s, a); }, ['kn', 0.2]);
        build(lms.S, 'mat', 0.25); build(lms.U, 'gold', 0.25);
        HEROES.forEach(function (h) { if (h.age === a) add(P + h.id, a, 'Recruit ' + lowerThe(h.name), 'h.' + h.id, 1, function (s) { return s.heroes[h.id] ? 1 : 0; }, ['gold', 0.2]); });
        stg(0, 0.3); grow(rk[0], 0.3);
        add(P + 'disc', a, 'Find a place on an expedition of this age', 'ui.found', 1, function (s) { return discCount(s, a); }, ['kn', 0.3]);
        raise(g, 1, 'gold', 0.3); raise(m, 1, 'mat', 0.3); raise(k, 1, 'kn', 0.3);
        add(P + 'doc', a, 'Adopt the doctrine of the ' + AGES[a].name, 'ui.fork', 1, function (s) { return s.doctrine[a] ? 1 : 0; }, ['kn', 0.3]);
        stg(1, 0.4); build(lms.H, 'mat', 0.4); post(0.4);
        if (rk[1]) grow(rk[1], 0.4);
        raise(g, 2, 'gold', 0.4); raise(m, 2, 'mat', 0.4);
        for (let i = 2; i < pr.stages.length; i++) stg(i, 0.5);
        build(lms.C, 'gold', 0.5);
      }
      add(P + 'trial', a, 'Defeat ' + lowerThe(tr.name), 'm.trial' + a, 1, function (s) { return s.trialWon[a] || s.age > a ? 1 : 0; }, ['gold', 0.75]);
    })(a);
    return L;
  }
  const GOALS = buildGoals(), GOAL = {}; GOALS.forEach(function (g) { GOAL[g.id] = g; });
  function activeGoals(s) {
    const out = [];
    for (let i = 0; i < GOALS.length && out.length < 3; i++) {
      const g = GOALS[i];
      if (g.age > s.age) break;
      if (s.goals[g.id]) continue;
      if (g.age < s.age && !(g.test(s) >= g.of)) continue;       // what an earlier age left undone is not asked for again
      out.push(g);
    }
    return out;
  }
  function goalState(s, g) { const v = +g.test(s) || 0; return { cur: Math.min(g.of, v), of: g.of, done: v >= g.of }; }
  function goalReward(s, g, d) { return { res: g.reward[0], v: amountOf(s, d, g.reward[0], g.reward[1], g.reward[2]) }; }
  function claimGoal(s, id, now) {
    const g = GOAL[id];
    if (!g || s.goals[id] || activeGoals(s).indexOf(g) < 0 || !goalState(s, g).done) return null;
    const r = goalReward(s, g, derive(s, now, false));
    s.res[r.res] += r.v; s.tot[r.res] += r.v; s.goals[id] = 1; s.stats.claimed = (s.stats.claimed || 0) + 1;
    return r;
  }

  /* ---------- the chronicle: everything there is to raise, build, find and beat, and whether it has been ---------- */
  function chronicle(s) {
    const chapters = []; let have = 0, of = 0;
    const chap = function (title, age) { const c = { title: title, age: age || 0, pages: [], have: 0 }; chapters.push(c); return c; };
    const page = function (c, name, icon, got, hint, note) { c.pages.push({ name: name, icon: icon, have: !!got, hint: hint || '', note: note || '' }); of++; if (got) { have++; c.have++; } };
    const town = chap('The town');
    for (let r = 1; r < RANKS.length; r++) page(town, RANKS[r].name, 'ui.rank', s.rank >= r, r > 1 ? 'A town of ' + fmtInt(TUNE.rank[r]) + ' people' : '', RANKS[r].text);
    for (let a = 1; a <= 5; a++) (function (a) {
      const c = chap(AGES[a].name, a);
      BUILDINGS.forEach(function (b) { if (b.age === a) for (let i = 0; i < NAMED; i++) page(c, b.marks[i], 'b.' + b.id, doublings(s, b) > i, MILESTONES[i] + ' ' + b.pl.toLowerCase(), ''); });
      LANDMARKS.forEach(function (l) { if (l.age === a) page(c, l.name, 'lm.' + l.id, s.lm[l.id], 'Learned from ' + TECH[l.tech].name.toLowerCase(), l.text); });
      PROJECTS[a].stages.forEach(function (st, i) { page(c, short(PROJECTS[a].name) + ': ' + st.toLowerCase(), 'p.' + a, s.age > a || (s.age === a && s.project > i), 'The great work of the age', ''); });
      HEROES.forEach(function (h) { if (h.age === a) page(c, h.name, 'h.' + h.id, s.heroes[h.id], 'A hero of this age', h.role); });
      DISCOVERIES.forEach(function (z) { if (z.age === a) page(c, z.name, 'd.' + z.id, s.disc[z.id], 'Somewhere along: ' + lowerThe(MISSION[z.from].name), z.text); });
      ITEMS.forEach(function (x) { if (x.age === a) page(c, x.name, x.id, s.items[x.id] !== undefined, 'Said to lie along: ' + lowerThe(MISSION[x.from].name), ''); });
      page(c, TRIALS[a].name, 'm.trial' + a, s.trialWon[a] || s.age > a, 'The trial of the age', TRIALS[a].text);
    })(a);
    const ne = chap('News that reached the town');
    EVENTS.forEach(function (e) { page(ne, e.name[Math.min(5, s.age) - 1], 'ev.' + e.id, s.ev.seen[e.id], 'It has not happened yet', ''); });
    return { chapters: chapters, have: have, of: of };
  }

  /* ---------- time ---------- */
  function advance(s, now) {
    const out = { away: 0, used: 0, capped: false, storeH: 0, gains: { gold: 0, mat: 0, kn: 0 }, work: 0, reports: 0, event: false };
    const dt = (now - s.lastTick) / 1000;
    if (dt > 0) {
      let span = dt;
      if (dt > AWAY_AFTER) {
        const cap = derive(s, s.lastTick, false).storeH * HOUR;
        out.away = dt; span = Math.min(dt, cap); out.used = span; out.capped = dt > cap; out.storeH = cap / HOUR;
        s.stats.awaySec += dt;
      }
      const t0 = s.lastTick, t1 = t0 + span * 1000, cuts = [t0];       // an edict or a boost may run out part of the way through
      if (s.edict && s.edict.until > t0 && s.edict.until < t1) cuts.push(s.edict.until);
      if (s.boost && s.boost.until > t0 && s.boost.until < t1) cuts.push(s.boost.until);
      cuts.sort(function (a, b) { return a - b; }); cuts.push(t1);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const sec = (cuts[i + 1] - cuts[i]) / 1000;
        if (sec <= 0) continue;
        const d = derive(s, cuts[i]);
        for (const r of RES) { const g = d.rate[r] * sec; s.res[r] += g; s.tot[r] += g; out.gains[r] += g; }
        if (d.work > 0) { const w = Math.min(Math.max(0, stageWork(s) - s.work), d.work * sec / HOUR); s.work += w; out.work += w; }
      }
    }
    s.lastTick = now;
    if (s.edict && s.edict.until <= now) s.edict = null;
    if (s.boost && s.boost.until <= now) s.boost = null;
    out.reports = resolve(s, now);
    out.event = nextEvent(s, now);
    return out;
  }

  /* ---------- save and load ---------- */
  function serialize(s, now) { s.saved = now; return JSON.stringify(s); }
  function parse(text) { try { return typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return null; } }
  function isOldSave(text) { const o = parse(text); return !!o && typeof o === 'object' && !!o.res && !(o.v >= SAVE_VERSION); }    // a realm from before version 6
  function load(text, now) {
    const o = parse(text);
    if (!o || typeof o !== 'object' || !o.res || !o.legacy || typeof o.age !== 'number') return null;
    if (!(o.v >= SAVE_VERSION)) return null;            // older realms follow other rules and are not carried over
    const base = newState(now);
    for (const k in base) if (o[k] === undefined) o[k] = base[k];
    for (const k of ['jobs', 'ev', 'stats']) { if (!o[k] || typeof o[k] !== 'object') o[k] = base[k]; for (const x in base[k]) if (o[k][x] === undefined) o[k][x] = base[k][x]; }
    for (const r of RES) { o.res[r] = +o.res[r] || 0; o.tot[r] = +o.tot[r] || 0; }
    if (!o.legacy.perks) o.legacy.perks = {};
    if (!(o.lastTick <= now)) o.lastTick = now;       // a clock set backwards must not create time
    o.age = Math.min(5, Math.max(1, Math.floor(o.age)));
    o.rank = Math.min(RANKS.length - 1, Math.max(1, Math.floor(o.rank) || 1));
    let sum = 0; for (const j of JOBS) { o.jobs[j] = Math.max(0, Math.floor(+o.jobs[j] || 0)); sum += o.jobs[j]; }
    if (sum !== 10) o.jobs = base.jobs;
    o.news = [];                                      // celebrations are for what happens while the game is open
    o.v = SAVE_VERSION;
    return o;
  }

  const Core = {
    HOUR, GROWTH, MILESTONES, NAMED, PARTY_SIZE, EDICT_HOURS, EVENT_GAP, RES, RES_NAME, JOBS, PEOPLE, AGES, BUILDINGS, B, LANDMARKS, LANDMARK, RANKS, AGE_RANKS,
    TECHS, TECH, DOCTRINES, DOCTRINE, ROLES, ROLE_ID, TREE_ROWS, TREE_COLS, EDICTS, EDICT, PROJECTS, TRIALS, TRAITS, MISSIONS, MISSION, HEROES, HERO, GEAR_NAMES,
    DISCOVERIES, DISCOVERY, DISC_FROM, ITEMS, ITEM, ITEM_FROM, EVENTS, EVENT, GOALS, GOAL, PERKS, PERK, TUNE,
    nice, fmt, fmtInt, fmtTime, mulberry32, count, techCount, itemCount, discCount, has, jobName, lowerThe, short,
    markNeed, doublings, doublingsAt, multAt, nextMark, people, rankFor, jobPower, citySlots, rankOpens, settle,
    newState, addLog, derive, unitRate, buildCost, canPay, maxQty, buildingVisible, buy, work, townOpen,
    techCost, techOpen, openTechs, councilOpen, research, doctrineOpen, chooseDoctrine, setEdict,
    landmarkState, landmarkCost, buildLandmark, moveJob, setJobs,
    ageTabOpen, projectDone, stageWork, worksOpen, stageCost, stageReady, buildStage, trialOpen, canAdvance, advanceAge, canDepart, legacyGain, depart,
    perkCost, buyPerk, legacyOpen, levelCap, gearCap, xpNeed, heroAvailable, recruit, gearCost, upgradeGear, heroStats,
    carried, itemsKept, itemLocked, placeItem, partyBonus,
    busy, enemyFor, trialWear, missionOpen, missionTime, battle, lootEstimate, partyStats, forecast, send, resolve,
    outpostCost, buildOutpost, promise, eventView, answerEvent, nextEvent, activeGoals, goalState, goalReward, claimGoal, chronicle,
    advance, serialize, load, isOldSave
  };
  root.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
