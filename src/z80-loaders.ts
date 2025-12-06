export interface HexProgram {
  memory: Uint8Array;
  startAddress: number;
}

export interface ListingInfo {
  lineToAddress: Map<number, number>;
  addressToLine: Map<number, number>;
}

/**
 * Parse Intel HEX content into a flat 64K memory image.
 */
export function parseIntelHex(content: string): HexProgram {
  const memory = new Uint8Array(0x10000);
  memory.fill(0);

  let startAddress = Number.MAX_SAFE_INTEGER;
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    if (!line.startsWith(':') || line.length < 11) {
      throw new Error(`Invalid HEX line: ${line}`);
    }

    const byteCount = parseInt(line.slice(1, 3), 16);
    const address = parseInt(line.slice(3, 7), 16);
    const recordType = parseInt(line.slice(7, 9), 16);
    const dataString = line.slice(9, 9 + byteCount * 2);

    if (recordType === 1) {
      // EOF
      break;
    }

    if (recordType !== 0) {
      // Only data records supported for now.
      continue;
    }

    startAddress = Math.min(startAddress, address);

    for (let i = 0; i < byteCount; i++) {
      const byteHex = dataString.slice(i * 2, i * 2 + 2);
      const value = parseInt(byteHex, 16);
      const loc = address + i;
      if (loc >= 0 && loc < 0x10000) {
        memory[loc] = value;
      }
    }
  }

  if (startAddress === Number.MAX_SAFE_INTEGER) {
    startAddress = 0;
  }

  return { memory, startAddress };
}

/**
 * Build maps between listing lines and addresses.
 */
export function parseListing(content: string): ListingInfo {
  const lineToAddress = new Map<number, number>();
  const addressToLine = new Map<number, number>();

  const lines = content.split(/\r?\n/);
  const lineRegex = /^([0-9A-Fa-f]{4})\s+/;

  lines.forEach((line, idx) => {
    const match = lineRegex.exec(line);
    if (!match) {
      return;
    }
    const addressStr = match[1];
    if (addressStr === undefined || addressStr === '') {
      return;
    }
    const address = parseInt(addressStr, 16);
    const lineNumber = idx + 1;
    if (!lineToAddress.has(lineNumber)) {
      lineToAddress.set(lineNumber, address);
    }
    if (!addressToLine.has(address)) {
      addressToLine.set(address, lineNumber);
    }
  });

  return { lineToAddress, addressToLine };
}
