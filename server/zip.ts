import zlib from 'node:zlib';

interface ZipEntry {
  name: string;
  data: Buffer;
}

// CRC32 implementation for ZIP format
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a valid standard ZIP archive buffer with zero external dependencies using Node zlib.
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralDirHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBuf = Buffer.from(entry.name, 'utf-8');
    const uncompressedData = entry.data;
    const uncompressedSize = uncompressedData.length;
    const crc = crc32(uncompressedData);

    // Deflate compression
    const compressedData = zlib.deflateRawSync(uncompressedData);
    const compressedSize = compressedData.length;

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + fileNameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8 filename)
    localHeader.writeUInt16LE(8, 8);          // Compression method: 8 = Deflate
    localHeader.writeUInt16LE(0, 10);         // Last mod file time
    localHeader.writeUInt16LE(0, 12);         // Last mod file date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuf.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    fileNameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedData);

    // Central directory header (46 bytes + filename)
    const cdHeader = Buffer.alloc(46 + fileNameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);    // Central dir signature
    cdHeader.writeUInt16LE(20, 4);            // Version made by
    cdHeader.writeUInt16LE(20, 6);            // Version needed to extract
    cdHeader.writeUInt16LE(0x0800, 8);        // UTF-8 flag
    cdHeader.writeUInt16LE(8, 10);            // Deflate
    cdHeader.writeUInt16LE(0, 12);            // Time
    cdHeader.writeUInt16LE(0, 14);            // Date
    cdHeader.writeUInt32LE(crc, 16);          // CRC
    cdHeader.writeUInt32LE(compressedSize, 20); // Compressed size
    cdHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    cdHeader.writeUInt16LE(fileNameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);            // Extra field length
    cdHeader.writeUInt16LE(0, 32);            // File comment length
    cdHeader.writeUInt16LE(0, 34);            // Disk number start
    cdHeader.writeUInt16LE(0, 36);            // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);            // External file attributes
    cdHeader.writeUInt32LE(offset, 42);       // Relative offset of local header
    fileNameBuf.copy(cdHeader, 46);

    centralDirHeaders.push(cdHeader);
    offset += localHeader.length + compressedData.length;
  }

  const centralDirOffset = offset;
  const centralDirBuffer = Buffer.concat(centralDirHeaders);
  const centralDirSize = centralDirBuffer.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // EOCD signature
  eocd.writeUInt16LE(0, 4);                  // Number of this disk
  eocd.writeUInt16LE(0, 6);                  // Disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8);      // Number of central directory records on this disk
  eocd.writeUInt16LE(entries.length, 10);     // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12);     // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);   // Offset of start of central directory
  eocd.writeUInt16LE(0, 20);                 // Comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}
