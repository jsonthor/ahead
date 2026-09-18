import { inflateRawSync } from "node:zlib";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const EOCD = 0x06054b50;

export type ZipEntry = {
  name: string;
  data: Buffer;
};

function u16(bytes: Buffer, offset: number) {
  return bytes.readUInt16LE(offset);
}

function u32(bytes: Buffer, offset: number) {
  return bytes.readUInt32LE(offset);
}

export function looksLikeZip(bytes: Buffer) {
  return bytes.length >= 4 && u32(bytes, 0) === LOCAL;
}

function findEocd(bytes: Buffer) {
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (u32(bytes, i) === EOCD) {
      return i;
    }
  }
  return -1;
}

export function unzipEntries(bytes: Buffer): ZipEntry[] {
  const eocd = findEocd(bytes);
  if (eocd < 0) {
    throw new Error("That zip file could not be read.");
  }
  const count = u16(bytes, eocd + 10);
  const cdSize = u32(bytes, eocd + 12);
  const cdOffset = u32(bytes, eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error("Zip64 archives are not supported yet.");
  }
  const entries: ZipEntry[] = [];
  let offset = cdOffset;
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > bytes.length || u32(bytes, offset) !== CENTRAL) {
      break;
    }
    const method = u16(bytes, offset + 10);
    const compSize = u32(bytes, offset + 20);
    const nameLen = u16(bytes, offset + 28);
    const extraLen = u16(bytes, offset + 30);
    const commentLen = u16(bytes, offset + 32);
    const localOff = u32(bytes, offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");
    offset += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith("/") || name.includes("__MACOSX") || /(^|\/)\./.test(name)) {
      continue;
    }
    if (localOff + 30 > bytes.length || u32(bytes, localOff) !== LOCAL) {
      continue;
    }
    const localNameLen = u16(bytes, localOff + 26);
    const localExtra = u16(bytes, localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtra;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      data = inflateRawSync(compressed);
    } else {
      continue;
    }
    entries.push({ name, data });
  }
  return entries;
}
