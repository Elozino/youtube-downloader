import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';

interface ZipEntry {
  filePath: string;
  name: string;
}

interface CentralEntry {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

const UINT32_MAX = 0xffff_ffff;

export async function createZipArchive(outputPath: string, entries: ZipEntry[]): Promise<void> {
  if (entries.length === 0) throw new Error('There are no playlist files to package.');

  const output = await open(outputPath, 'w', 0o600);
  const centralEntries: CentralEntry[] = [];
  let offset = 0;

  try {
    for (const entry of entries) {
      const fileStat = await stat(entry.filePath);
      const size = fileStat.size;
      if (!fileStat.isFile() || size > UINT32_MAX) {
        throw new Error('A playlist item is too large for the ZIP download.');
      }

      const name = Buffer.from(path.basename(entry.name), 'utf8');
      const crc = await crc32File(entry.filePath);
      const { time, date } = dosDateTime(fileStat.mtime);
      const header = localHeader(name, crc, size, time, date);
      assertZip32(offset + header.length + size);

      await output.write(header, 0, header.length, offset);
      offset += header.length;
      for await (const chunk of createReadStream(entry.filePath)) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        await output.write(data, 0, data.length, offset);
        offset += data.length;
      }

      centralEntries.push({ name, crc, size, offset: offset - size - header.length, time, date });
    }

    const centralOffset = offset;
    for (const entry of centralEntries) {
      const header = centralHeader(entry);
      assertZip32(offset + header.length);
      await output.write(header, 0, header.length, offset);
      offset += header.length;
    }

    const centralSize = offset - centralOffset;
    const end = endRecord(centralEntries.length, centralSize, centralOffset);
    await output.write(end, 0, end.length, offset);
  } finally {
    await output.close();
  }
}

function localHeader(name: Buffer, crc: number, size: number, time: number, date: number): Buffer {
  const result = Buffer.alloc(30 + name.length);
  result.writeUInt32LE(0x04034b50, 0);
  result.writeUInt16LE(20, 4);
  result.writeUInt16LE(0x0800, 6);
  result.writeUInt16LE(0, 8);
  result.writeUInt16LE(time, 10);
  result.writeUInt16LE(date, 12);
  result.writeUInt32LE(crc, 14);
  result.writeUInt32LE(size, 18);
  result.writeUInt32LE(size, 22);
  result.writeUInt16LE(name.length, 26);
  result.writeUInt16LE(0, 28);
  name.copy(result, 30);
  return result;
}

function centralHeader(entry: CentralEntry): Buffer {
  const result = Buffer.alloc(46 + entry.name.length);
  result.writeUInt32LE(0x02014b50, 0);
  result.writeUInt16LE(20, 4);
  result.writeUInt16LE(20, 6);
  result.writeUInt16LE(0x0800, 8);
  result.writeUInt16LE(0, 10);
  result.writeUInt16LE(entry.time, 12);
  result.writeUInt16LE(entry.date, 14);
  result.writeUInt32LE(entry.crc, 16);
  result.writeUInt32LE(entry.size, 20);
  result.writeUInt32LE(entry.size, 24);
  result.writeUInt16LE(entry.name.length, 28);
  result.writeUInt16LE(0, 30);
  result.writeUInt16LE(0, 32);
  result.writeUInt16LE(0, 34);
  result.writeUInt16LE(0, 36);
  result.writeUInt32LE(0, 38);
  result.writeUInt32LE(entry.offset, 42);
  entry.name.copy(result, 46);
  return result;
}

function endRecord(count: number, centralSize: number, centralOffset: number): Buffer {
  if (count > 0xffff) throw new Error('The playlist contains too many files for one ZIP.');
  assertZip32(centralSize);
  assertZip32(centralOffset);
  const result = Buffer.alloc(22);
  result.writeUInt32LE(0x06054b50, 0);
  result.writeUInt16LE(0, 4);
  result.writeUInt16LE(0, 6);
  result.writeUInt16LE(count, 8);
  result.writeUInt16LE(count, 10);
  result.writeUInt32LE(centralSize, 12);
  result.writeUInt32LE(centralOffset, 16);
  result.writeUInt16LE(0, 20);
  return result;
}

function assertZip32(value: number): void {
  if (value > UINT32_MAX) {
    throw new Error('The playlist is too large for one ZIP download.');
  }
}

async function crc32File(filePath: string): Promise<number> {
  let crc = 0xffff_ffff;
  for await (const chunk of createReadStream(filePath)) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function dosDateTime(value: Date): { time: number; date: number } {
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  };
}
