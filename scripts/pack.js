// Build pipeline: takes the Vite output in dist/, minifies with Terser,
// packs with Roadroller, re-embeds into a single index.html and zips it.
// Run after `vite build` (see package.json "build" script).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';

const DIST = resolve('dist');
const HTML_IN = resolve(DIST, 'index.html');
const JS_IN = resolve(DIST, 'bundle.js');
const ZIP_OUT = resolve(DIST, 'game.zip');
const BUDGET = 13312; // js13kGames zip size limit in bytes

async function main() {
  if (!existsSync(HTML_IN) || !existsSync(JS_IN)) {
    console.error('dist/index.html or dist/bundle.js missing. Run `vite build` first.');
    process.exit(1);
  }

  const rawJs = readFileSync(JS_IN, 'utf8');
  const rawHtml = readFileSync(HTML_IN, 'utf8');

  console.log(`raw bundle.js: ${rawJs.length} bytes`);

  const terserResult = await minify(rawJs, {
    module: true,
    compress: {
      passes: 5,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_methods: true,
      unsafe_math: true,
      booleans_as_integers: true,
      pure_getters: true,
      hoist_funs: true,
      hoist_vars: true,
    },
    mangle: {
      module: true,
      toplevel: true,
      properties: false, // keep property names for now; MVP correctness > extra bytes
    },
    format: { comments: false },
  });

  const minified = terserResult.code ?? '';
  console.log(`terser output: ${minified.length} bytes`);

  const packer = new Packer(
    [{ data: minified, type: 'js', action: 'eval' }],
    {
      allowFreeVars: true,
      modelRecipBaseCount: 32,
      modelMaxCount: 4,
      dynamicModels: 1,
      numAbbreviations: 27,
      sparseSelectors: [0, 1, 2, 3, 6, 7, 13, 21, 27, 42, 116, 481],
      precision: 16,
      recipLearningRate: 1910,
    },
  );
  const { firstLine, secondLine } = packer.makeDecoder();
  const packedJs = firstLine + secondLine;
  console.log(`roadroller output: ${packedJs.length} bytes`);

  // Strip the dev module script tag Vite emitted, and any extra whitespace
  // between tags. Inline styles are left as-is (already tiny).
  let finalHtml = rawHtml
    .replace(/<script[^>]*type="module"[^>]*><\/script>/, '')
    .replace('</body>', `<script>${packedJs}</script></body>`)
    .replace(/>\s+</g, '><')
    .trim();

  const htmlPath = resolve(DIST, 'final.html');
  writeFileSync(htmlPath, finalHtml, 'utf8');
  console.log(`final.html: ${Buffer.byteLength(finalHtml, 'utf8')} bytes`);

  await zip(htmlPath, ZIP_OUT);

  const zipSize = readFileSync(ZIP_OUT).length;
  const remaining = BUDGET - zipSize;
  console.log(`\n${ZIP_OUT}: ${zipSize} bytes`);
  console.log(remaining >= 0
    ? `OK — ${remaining} bytes under budget (${BUDGET})`
    : `OVER BUDGET by ${-remaining} bytes (limit ${BUDGET})`);
}

function zip(filePath, outPath) {
  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolvePromise);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(filePath, { name: 'index.html' });
    archive.finalize();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
