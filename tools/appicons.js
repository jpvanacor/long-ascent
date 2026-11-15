/* Draws the app icon (an original emblem: steps rising to a star inside a gold ring) and writes every size the
   web app and the Android project need. Usage: node tools/appicons.js   (needs Playwright and Chrome) */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..'), res = path.join(root, 'android', 'app', 'src', 'main', 'res');
const DEFS = '<defs><radialGradient id="bg" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#4d3219"/><stop offset="1" stop-color="#170f09"/></radialGradient>' +
  '<linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fce9ab"/><stop offset="1" stop-color="#c4912a"/></linearGradient></defs>';
const MOTIF = '<circle cx="256" cy="256" r="198" fill="none" stroke="url(#au)" stroke-width="15"/>' +
  '<path d="M118 372V318H190V264H262V210H334V372Z" fill="url(#au)"/>' +
  '<path d="M334 92l13 37 37 13-37 13-13 37-13-37-37-13 37-13z" fill="#fff5cf"/>';
/* scale: how large the emblem is drawn; bg: fill behind it; clip: 'round', 'squircle' or none */
function svg(o) {
  const s = o.scale || 1, t = 256 * (1 - s);
  const clip = o.clip === 'round' ? '<clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath>' : o.clip === 'squircle' ? '<clipPath id="c"><rect width="512" height="512" rx="96"/></clipPath>' : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' + DEFS + clip + '<g' + (clip ? ' clip-path="url(#c)"' : '') + '>' +
    (o.bg === false ? '' : '<rect width="512" height="512" fill="url(#bg)"/>') + '<g transform="translate(' + t + ' ' + t + ') scale(' + s + ')">' + MOTIF + '</g></g></svg>';
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const p = await b.newPage();
  async function shot(file, w, h, body, transparent) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent('<style>html,body{margin:0;background:' + (transparent ? 'transparent' : '#170f09') + '}svg{display:block}</style>' + body);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await p.screenshot({ path: file, omitBackground: !!transparent, clip: { x: 0, y: 0, width: w, height: h } });
  }
  const sized = (o, n) => svg(o).replace('width="512" height="512"', 'width="' + n + '" height="' + n + '"');
  // web app
  await shot(path.join(root, 'icons', 'icon-192.png'), 192, 192, sized({ scale: 0.92 }, 192));
  await shot(path.join(root, 'icons', 'icon-512.png'), 512, 512, sized({ scale: 0.92 }, 512));
  await shot(path.join(root, 'icons', 'icon-maskable-512.png'), 512, 512, sized({ scale: 0.74 }, 512));
  await shot(path.join(root, 'icons', 'apple-touch-icon.png'), 180, 180, sized({ scale: 0.88 }, 180));
  // Android launcher: legacy square and round icons, and the foreground of the adaptive icon
  for (const [d, n] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    await shot(path.join(res, 'mipmap-' + d, 'ic_launcher.png'), n, n, sized({ scale: 0.86, clip: 'squircle' }, n), true);
    await shot(path.join(res, 'mipmap-' + d, 'ic_launcher_round.png'), n, n, sized({ scale: 0.86, clip: 'round' }, n), true);
    const f = Math.round(n * 108 / 48);
    await shot(path.join(res, 'mipmap-' + d, 'ic_launcher_foreground.png'), f, f, sized({ scale: 0.56, bg: false }, f), true);
  }
  // splash screens: the emblem on the dark ground
  const splash = [['drawable', 480, 320], ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480], ['drawable-land-xhdpi', 1280, 720], ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280],
    ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280], ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920]];
  for (const [d, w, h] of splash) {
    const n = Math.round(Math.min(w, h) * 0.34);
    await shot(path.join(res, d, 'splash.png'), w, h, '<div style="width:' + w + 'px;height:' + h + 'px;display:grid;place-items:center;background:#170f09">' + sized({ bg: false }, n) + '</div>');
  }
  await b.close();
  console.log('icons written');
})();
