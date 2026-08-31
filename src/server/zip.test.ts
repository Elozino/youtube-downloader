import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createZipArchive } from './zip';

describe('createZipArchive', () => {
  it('writes multiple files and a valid central directory without loading the archive at once', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'zip-test-'));
    const first = path.join(directory, 'first.txt');
    const second = path.join(directory, 'second.txt');
    const archive = path.join(directory, 'playlist.zip');
    await writeFile(first, 'first item');
    await writeFile(second, 'second item');

    await createZipArchive(archive, [
      { filePath: first, name: '01 - First.txt' },
      { filePath: second, name: '02 - Second.txt' },
    ]);

    const contents = await readFile(archive);
    expect(contents.readUInt32LE(0)).toBe(0x04034b50);
    expect(contents.includes(Buffer.from('01 - First.txt'))).toBe(true);
    expect(contents.includes(Buffer.from('02 - Second.txt'))).toBe(true);
    expect(contents.readUInt32LE(contents.length - 22)).toBe(0x06054b50);
    expect(contents.readUInt16LE(contents.length - 14)).toBe(2);
  });
});
