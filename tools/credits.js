/* Writes CREDITS.md from the list of icons the game uses (tools/icon-credits.json, made by tools/icons.js). */
const fs = require('fs'), path = require('path');
const by = JSON.parse(fs.readFileSync(path.join(__dirname, 'icon-credits.json'), 'utf8'));
const NAME = { lorc: 'Lorc', delapouite: 'Delapouite', skoll: 'Skoll', 'caro-asercion': 'Caro Asercion', willdabeast: 'Willdabeast', 'lord-berandas': 'Lord Berandas', 'heavenly-dog': 'Heavenly Dog', sbed: 'sbed' };
const authors = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
const n = authors.reduce((a, k) => a + by[k].length, 0);
const out = `# Credits

Long Ascent is a personal project. The game rules, the illustrated scene, the interface and the app icon were made for it.
Everything below was made by other people and is used under the licence named.

## Icons

${n} icons from [game-icons.net](https://game-icons.net), used under the
[Creative Commons Attribution 3.0 licence](https://creativecommons.org/licenses/by/3.0/).
The icon shapes are unchanged; the game draws them in its own colours and sizes.

${authors.map((a) => `- **${NAME[a] || a}** (${by[a].length}): ${by[a].slice().sort().join(', ')}`).join('\n')}

Which icon stands for what is listed in \`tools/iconmap.js\`.

## Music and sound effects

The five pieces of music and the sound effects were written for this game as note lists
(\`tools/music/score.js\`, \`tools/music/sfx.js\`) and rendered to audio by \`tools/music/build.js\`.

The instrument sounds are samples of the **FluidR3_GM** soundfont by **Frank Wen**, as pre-rendered note by note in
[gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) by Benjamin Gleitzman.
That repository gives the Fluid soundfont as released under the
[Creative Commons Attribution 3.0 licence](https://creativecommons.org/licenses/by/3.0/us/); its own code is MIT licensed.
The samples themselves are not stored in this repository, only the audio rendered from them.

## Typefaces

All under the [SIL Open Font License 1.1](https://openfontlicense.org). The licence and copyright notice of each is in \`fonts/licenses/\`.

- Grenze Gotisch, The Grenze Gotisch Project Authors (Omnibus-Type)
- IM Fell English, Igino Marini
- Besley, The Besley Project Authors (indestructible type*)
- Archivo, The Archivo Project Authors (Omnibus-Type)
- Michroma, The Michroma Project Authors
- Source Serif 4, Adobe
- IBM Plex Sans, IBM Corp.

The font files come from the [Fontsource](https://fontsource.org) packages.

## Tools

The Android app is wrapped with [Capacitor](https://capacitorjs.com) (MIT licence).
`;
fs.writeFileSync(path.join(__dirname, '..', 'CREDITS.md'), out);
console.log('CREDITS.md: ' + n + ' icons by ' + authors.length + ' authors');
