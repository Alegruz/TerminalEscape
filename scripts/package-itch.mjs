import { deflateRawSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const sourceDir = 'dist';
const outputFile = 'terminal-escape-itch.zip';

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i += 1) {
  let c = i;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function pushUInt16(parts, value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  parts.push(buffer);
}

function pushUInt32(parts, value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  parts.push(buffer);
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of listFiles(sourceDir)) {
  const stats = statSync(file);
  const name = relative(sourceDir, file).split(sep).join('/');
  const nameBuffer = Buffer.from(name);
  const content = readFileSync(file);
  const compressed = deflateRawSync(content, { level: 9 });
  const checksum = crc32(content);
  const { dosTime, dosDate } = dosDateTime(stats.mtime);

  const localHeader = [];
  pushUInt32(localHeader, 0x04034b50);
  pushUInt16(localHeader, 20);
  pushUInt16(localHeader, 0x0800);
  pushUInt16(localHeader, 8);
  pushUInt16(localHeader, dosTime);
  pushUInt16(localHeader, dosDate);
  pushUInt32(localHeader, checksum);
  pushUInt32(localHeader, compressed.length);
  pushUInt32(localHeader, content.length);
  pushUInt16(localHeader, nameBuffer.length);
  pushUInt16(localHeader, 0);
  localHeader.push(nameBuffer, compressed);

  const localBuffer = Buffer.concat(localHeader);
  localParts.push(localBuffer);

  const centralHeader = [];
  pushUInt32(centralHeader, 0x02014b50);
  pushUInt16(centralHeader, 20);
  pushUInt16(centralHeader, 20);
  pushUInt16(centralHeader, 0x0800);
  pushUInt16(centralHeader, 8);
  pushUInt16(centralHeader, dosTime);
  pushUInt16(centralHeader, dosDate);
  pushUInt32(centralHeader, checksum);
  pushUInt32(centralHeader, compressed.length);
  pushUInt32(centralHeader, content.length);
  pushUInt16(centralHeader, nameBuffer.length);
  pushUInt16(centralHeader, 0);
  pushUInt16(centralHeader, 0);
  pushUInt16(centralHeader, 0);
  pushUInt16(centralHeader, 0);
  pushUInt32(centralHeader, 0);
  pushUInt32(centralHeader, offset);
  centralHeader.push(nameBuffer);
  centralParts.push(Buffer.concat(centralHeader));

  offset += localBuffer.length;
}

const centralDirectory = Buffer.concat(centralParts);
const endRecord = [];
pushUInt32(endRecord, 0x06054b50);
pushUInt16(endRecord, 0);
pushUInt16(endRecord, 0);
pushUInt16(endRecord, centralParts.length);
pushUInt16(endRecord, centralParts.length);
pushUInt32(endRecord, centralDirectory.length);
pushUInt32(endRecord, offset);
pushUInt16(endRecord, 0);

writeFileSync(outputFile, Buffer.concat([...localParts, centralDirectory, ...endRecord]));
console.log(`Created ${outputFile} from ${sourceDir}/ (${centralParts.length} files).`);
