// Rebuilds the static icons in public/ from the same LogoIcon component the app
// renders, so the browser tab, home screen and push notifications match it.
// Run with `npm run icons` (macOS: rasterizes with Quick Look and sips).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import LogoIcon from '../src/components/logo/LogoIcon';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const work = mkdtempSync(join(tmpdir(), 'doodle-icons-'));

/** Writes the icon as SVG (optionally on paper) and a 512px PNG of it */
function render(name: string, theme: string | null, paper = false) {
  let svg = renderToStaticMarkup(<LogoIcon theme={theme} size={512} />);
  if (paper) {
    // Home screens show transparent corners as black, so fill them
    svg = svg.replace('>', '><rect width="52" height="52" fill="#fbf8f1"/>');
  }
  const file = join(work, `${name}.svg`);
  writeFileSync(file, svg);
  execFileSync('qlmanage', ['-t', '-s', '512', '-o', work, file], {
    stdio: 'ignore',
  });
  return { svg, png: `${file}.png` };
}

function resize(png: string, size: number, out: string, format = 'png') {
  execFileSync(
    'sips',
    [
      '-s',
      'format',
      format,
      '-z',
      `${size}`,
      `${size}`,
      png,
      '--out',
      join(PUBLIC, out),
    ],
    { stdio: 'ignore' },
  );
}

const plain = render('default', null);
const onPaper = render('default-paper', null, true);
const christmas = render('christmas', 'christmas');

writeFileSync(join(PUBLIC, 'favicon.svg'), plain.svg);
resize(plain.png, 32, 'favicon.ico', 'ico');
resize(plain.png, 32, 'favicon-32x32.png');
resize(plain.png, 16, 'favicon-16x16.png');
resize(plain.png, 512, 'logo.png');
resize(onPaper.png, 512, 'android-chrome-512x512.png');
resize(onPaper.png, 192, 'android-chrome-192x192.png');
resize(onPaper.png, 180, 'apple-touch-icon.png');
// Push icon for event notifications (see server/internal/notifications/events.go)
resize(christmas.png, 192, 'icons/logo-christmas.png');

console.log(
  `Icons written to ${PUBLIC}`,
  readFileSync(join(PUBLIC, 'favicon.svg')).length,
  'byte svg',
);
