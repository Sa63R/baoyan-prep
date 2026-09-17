const table = (() => {
  const values = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    values[n] = c >>> 0
  }
  return values
})()

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value: number) {
  const data = Buffer.alloc(2); data.writeUInt16LE(value); return data
}

function u32(value: number) {
  const data = Buffer.alloc(4); data.writeUInt32LE(value >>> 0); return data
}

export function createStoredZip(files: { name: string; data: Uint8Array }[]) {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, "/"), "utf8")
    const data = Buffer.from(file.data)
    const crc = crc32(data)
    const localHeader = Buffer.concat([Buffer.from("504b0304", "hex"), u16(20), u16(0x800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name])
    local.push(localHeader, data)
    central.push(Buffer.concat([Buffer.from("504b0102", "hex"), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]))
    offset += localHeader.length + data.length
  }
  const centralData = Buffer.concat(central)
  const end = Buffer.concat([Buffer.from("504b0506", "hex"), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralData.length), u32(offset), u16(0)])
  return Buffer.concat([...local, centralData, end])
}
