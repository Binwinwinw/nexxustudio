/**
 * Assemblage ZIP PKZIP conforme (stockage / méthode 0 + central directory + EOCD).
 * Compatible outils standards (Explorer, 7-Zip, unzip, parseur interne archiveExtractor).
 */

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeLocalFileHeader(nameBuf, data, crc) {
  const header = Buffer.alloc(30 + nameBuf.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(crc, 10);
  header.writeUInt32LE(data.length, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  nameBuf.copy(header, 30);
  return header;
}

function writeCentralDirectoryHeader(nameBuf, data, crc, localHeaderOffset) {
  const header = Buffer.alloc(46 + nameBuf.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBuf.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localHeaderOffset, 42);
  nameBuf.copy(header, 46);
  return header;
}

function writeEndOfCentralDirectory(entryCount, centralDirSize, centralDirOffset) {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

export function buildStoredZipArchive(files = {}) {
  const localChunks = [];
  const entries = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const entryName = String(name).replace(/\\/g, "/");
    const nameBuf = Buffer.from(entryName, "utf8");
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
    const crc = crc32(data);

    const localHeaderOffset = offset;
    const localHeader = writeLocalFileHeader(nameBuf, data, crc);
    localChunks.push(localHeader, data);
    offset += localHeader.length + data.length;

    entries.push({ entryName, nameBuf, data, crc, localHeaderOffset });
  }

  const centralChunks = [];
  let centralDirSize = 0;
  const centralDirOffset = offset;

  for (const entry of entries) {
    const cdh = writeCentralDirectoryHeader(
      entry.nameBuf,
      entry.data,
      entry.crc,
      entry.localHeaderOffset,
    );
    centralChunks.push(cdh);
    centralDirSize += cdh.length;
  }

  const eocd = writeEndOfCentralDirectory(
    entries.length,
    centralDirSize,
    centralDirOffset,
  );

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}
