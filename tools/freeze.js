/* Copies the tuned numbers from tools/tune.json into src/core.js */
const fs = require('fs'), path = require('path');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'tune.json'), 'utf8'));
const file = path.join(__dirname, '..', 'js', 'core.js');
let src = fs.readFileSync(file, 'utf8');
const a = src.indexOf('  const TUNE = {'), b = src.indexOf('  };', a) + 4;
if (a < 0 || b < 4) throw new Error('TUNE block not found');
const num = function (v) { return v >= 1e6 ? v.toExponential().replace('e+', 'e') : String(v); };
const arr = function (x) { return '[' + x.map(num).join(', ') + ']'; };
let out = '  const TUNE = {\n    // knowledge cost of each research topic, by age and by rank on the cost ladder\n    tech: [null,\n';
out += [1, 2, 3, 4, 5].map(function (i) { return '      ' + arr(T.tech[i]); }).join(',\n') + '],\n';
out += '    // cost of each great project stage\n    proj: [null,\n';
out += [1, 2, 3, 4, 5].map(function (i) { const p = T.proj[i]; return '      { gold: ' + arr(p.gold) + ', mat: ' + arr(p.mat) + ', kn: ' + arr(p.kn) + ' }'; }).join(',\n') + '],\n';
out += '    hero: { ' + Object.keys(T.hero).map(function (k) { return k + ': ' + num(T.hero[k]); }).join(', ') + ' },\n';
out += '    gear: ' + arr(T.gear) + ',   // materials to raise equipment from level i to i+1\n';
out += '    enemy: [null, ' + [1, 2, 3, 4, 5].map(function (i) { return '{ hp: ' + num(T.enemy[i].hp) + ', atk: ' + num(T.enemy[i].atk) + ' }'; }).join(', ') + ']\n  };\n';
src = src.slice(0, a) + out + src.slice(b);
fs.writeFileSync(file, src);
console.log('frozen');
