#!/usr/bin/env node
// Postinstall: download the tix binary for the current platform into bin/tix-bin.
//
// Env overrides:
//   TIX_RELEASE_BASE_URL  Base URL for release artifacts. Defaults to a versioned
//                         GitHub release URL derived from package.json.
//                         For local testing, point at file:///abs/path/to/dist.
//   TIX_SKIP_DOWNLOAD     If set, skip the download (useful in CI / offline installs).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const zlib = require('zlib');

if (process.env.TIX_SKIP_DOWNLOAD) {
  console.log('tix: TIX_SKIP_DOWNLOAD set, skipping binary download.');
  process.exit(0);
}

const pkg = require('./package.json');

const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux' };
const ARCH_MAP = { x64: 'amd64', arm64: 'arm64' };

const platform = PLATFORM_MAP[process.platform];
const arch = ARCH_MAP[process.arch];

if (!platform || !arch) {
  console.error(`tix: unsupported platform ${process.platform}/${process.arch}`);
  process.exit(1);
}

const baseUrl =
  process.env.TIX_RELEASE_BASE_URL ||
  `https://github.com/WinstonFassett/tix/releases/download/v${pkg.version}`;

const assetName = `tix-${platform}-${arch}.tar.gz`;
const url = `${baseUrl.replace(/\/$/, '')}/${assetName}`;

const binDir = path.join(__dirname, 'bin');
const binPath = path.join(binDir, 'tix-bin');

async function readToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function fetchTarball(url) {
  if (url.startsWith('file://')) {
    return fs.promises.readFile(url.slice('file://'.length));
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}

// Minimal tar extractor for "tix" entry. Avoids native deps.
// Skips PaxHeader/* (typeflag 'x'/'g') and AppleDouble (._*) entries; only
// returns a regular file (typeflag '0' or '\0') named exactly "tix".
function extractTixFromTar(tarBuf) {
  let offset = 0;
  while (offset + 512 <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if (!name) return null;
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeflag = String.fromCharCode(header[156] || 0x30);
    const dataStart = offset + 512;
    const isRegular = typeflag === '0' || typeflag === '\0';
    const base = name.split('/').pop();
    if (isRegular && name === 'tix' && base === 'tix') {
      return tarBuf.subarray(dataStart, dataStart + size);
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return null;
}

(async () => {
  console.log(`tix: downloading ${url}`);
  const gz = await fetchTarball(url);
  const tar = zlib.gunzipSync(gz);
  const bin = extractTixFromTar(tar);
  if (!bin) {
    console.error(`tix: archive did not contain a 'tix' entry`);
    process.exit(1);
  }
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(binPath, bin);
  fs.chmodSync(binPath, 0o755);
  try {
    const ver = execFileSync(binPath, ['version'], { encoding: 'utf8' }).trim();
    console.log(`tix: installed ${ver} → ${binPath}`);
  } catch {
    console.log(`tix: installed → ${binPath}`);
  }
})().catch((err) => {
  console.error(`tix: install failed: ${err.message}`);
  process.exit(1);
});
