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

const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux', win32: 'windows' };
const ARCH_MAP = { x64: 'amd64', arm64: 'arm64' };

const platform = PLATFORM_MAP[process.platform];
const arch = ARCH_MAP[process.arch];

if (!platform || !arch) {
  console.error(`tix: unsupported platform ${process.platform}/${process.arch}`);
  process.exit(1);
}

const isWindows = platform === 'windows';

const baseUrl =
  process.env.TIX_RELEASE_BASE_URL ||
  `https://github.com/WinstonFassett/tix/releases/download/v${pkg.version}`;

const assetName = isWindows
  ? `tix-${platform}-${arch}.zip`
  : `tix-${platform}-${arch}.tar.gz`;
const url = `${baseUrl.replace(/\/$/, '')}/${assetName}`;

const binDir = path.join(__dirname, 'bin');
const binPath = path.join(binDir, isWindows ? 'tix-bin.exe' : 'tix-bin');

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

// Minimal zip extractor for "tix.exe" entry. Avoids native deps.
// Reads the local file header for each entry and extracts "tix.exe".
function extractTixFromZip(zipBuf) {
  let offset = 0;
  while (offset + 30 <= zipBuf.length) {
    const sig = zipBuf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // local file header signature
    const compression = zipBuf.readUInt16LE(offset + 8);
    const compressedSize = zipBuf.readUInt32LE(offset + 18);
    const fnLen = zipBuf.readUInt16LE(offset + 26);
    const extraLen = zipBuf.readUInt16LE(offset + 28);
    const name = zipBuf.subarray(offset + 30, offset + 30 + fnLen).toString('utf8');
    const dataStart = offset + 30 + fnLen + extraLen;
    if (name === 'tix.exe') {
      const compressed = zipBuf.subarray(dataStart, dataStart + compressedSize);
      return compression === 0 ? compressed : zlib.inflateRawSync(compressed);
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

(async () => {
  console.log(`tix: downloading ${url}`);
  const data = await fetchTarball(url);
  let bin;
  if (isWindows) {
    bin = extractTixFromZip(data);
    if (!bin) {
      console.error(`tix: archive did not contain a 'tix.exe' entry`);
      process.exit(1);
    }
  } else {
    const tar = zlib.gunzipSync(data);
    bin = extractTixFromTar(tar);
    if (!bin) {
      console.error(`tix: archive did not contain a 'tix' entry`);
      process.exit(1);
    }
  }
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(binPath, bin);
  if (!isWindows) fs.chmodSync(binPath, 0o755);
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
