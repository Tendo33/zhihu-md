const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

/**
 * Create a ZIP file containing markdown and images
 * Uses a simple ZIP implementation without external libraries
 * @param {string} mdFilename 
 * @param {string} mdContent 
 * @param {Array} images 
 * @returns {Promise<Blob>}
 */
export async function createZipWithImages(mdFilename, mdContent, images) {
  const files = [
    { name: mdFilename, content: new TextEncoder().encode(mdContent) }
  ];
  
  // Add images to the images/ folder
  for (const img of images) {
    files.push({
      name: `images/${img.filename}`,
      content: img.data
    });
  }
  
  return createZip(files);
}

/**
 * Simple ZIP file creator (no compression, store only)
 * Supports UTF-8 filenames for Chinese characters
 * @param {Array} files - Array of {name, content}
 * @returns {Blob}
 */
export function createZip(files) {
  const parts = [];
  const centralDirectory = [];
  let offset = 0;
  
  // UTF-8 flag (bit 11) for proper Chinese filename support
  const UTF8_FLAG = 0x0800;
  
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const content = file.content;
    const crcValue = crc32(content);
    
    // Local file header
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    
    localView.setUint32(0, 0x04034b50, true);  // Local file header signature
    localView.setUint16(4, 20, true);           // Version needed (2.0 for UTF-8)
    localView.setUint16(6, UTF8_FLAG, true);    // General purpose bit flag - UTF-8 encoding
    localView.setUint16(8, 0, true);            // Compression method (store)
    localView.setUint16(10, 0, true);           // File last modification time
    localView.setUint16(12, 0, true);           // File last modification date
    localView.setUint32(14, crcValue, true);    // CRC-32
    localView.setUint32(18, content.length, true);  // Compressed size
    localView.setUint32(22, content.length, true);  // Uncompressed size
    localView.setUint16(26, nameBytes.length, true); // File name length
    localView.setUint16(28, 0, true);           // Extra field length
    
    // Copy filename
    new Uint8Array(localHeader, 30).set(nameBytes);
    
    // Central directory header
    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    
    centralView.setUint32(0, 0x02014b50, true); // Central file header signature
    centralView.setUint16(4, 0x0314, true);      // Version made by (Unix + ZIP 2.0)
    centralView.setUint16(6, 20, true);          // Version needed (2.0 for UTF-8)
    centralView.setUint16(8, UTF8_FLAG, true);   // General purpose bit flag - UTF-8 encoding
    centralView.setUint16(10, 0, true);          // Compression method
    centralView.setUint16(12, 0, true);          // File last modification time
    centralView.setUint16(14, 0, true);          // File last modification date
    centralView.setUint32(16, crcValue, true);   // CRC-32
    centralView.setUint32(20, content.length, true); // Compressed size
    centralView.setUint32(24, content.length, true); // Uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // File name length
    centralView.setUint16(30, 0, true);          // Extra field length
    centralView.setUint16(32, 0, true);          // File comment length
    centralView.setUint16(34, 0, true);          // Disk number start
    centralView.setUint16(36, 0, true);          // Internal file attributes
    centralView.setUint32(38, 0, true);          // External file attributes
    centralView.setUint32(42, offset, true);     // Relative offset of local header
    
    new Uint8Array(centralHeader, 46).set(nameBytes);
    
    parts.push(new Uint8Array(localHeader));
    parts.push(content);
    centralDirectory.push(new Uint8Array(centralHeader));
    
    offset += localHeader.byteLength + content.length;
  }
  
  // End of central directory
  const centralDirSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0);
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  
  endView.setUint32(0, 0x06054b50, true);       // End of central dir signature
  endView.setUint16(4, 0, true);                // Number of this disk
  endView.setUint16(6, 0, true);                // Disk where central directory starts
  endView.setUint16(8, files.length, true);     // Number of central directory records on this disk
  endView.setUint16(10, files.length, true);    // Total number of central directory records
  endView.setUint32(12, centralDirSize, true);  // Size of central directory
  endView.setUint32(16, offset, true);          // Offset of start of central directory
  endView.setUint16(20, 0, true);               // Comment length
  
  return new Blob([...parts, ...centralDirectory, new Uint8Array(endRecord)], { type: 'application/zip' });
}

/**
 * Calculate CRC-32 checksum using pre-built lookup table
 * @param {Uint8Array} data 
 * @returns {number}
 */
export function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
