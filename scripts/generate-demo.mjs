import { mkdirSync, writeFileSync } from 'node:fs';
// Original synthetic sample. No external recording, license, or network required.
const rate = 44100, seconds = 8, count = rate * seconds;
const bytes = Buffer.alloc(44 + count * 2);
bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
for (let i = 0; i < count; i++) {
  const t = i / rate, beat = t % .5;
  const kick = Math.sin(2 * Math.PI * (48 * beat + 15 * (1 - Math.exp(-beat * 25)))) * Math.exp(-beat * 18) * .48;
  const note = [220, 261.63, 329.63, 293.66][Math.floor(t / 2) % 4];
  const pad = (Math.sin(t * note * Math.PI * 2) + .45 * Math.sin(t * note * 3 * Math.PI)) * .1;
  const hat = Math.sin(i * 77.392) * Math.cos(i * 13.17) * Math.exp(-(t % .25) * 95) * .12;
  const fade = Math.min(1, t * 10, (seconds - t) * 4);
  bytes.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round((kick + pad + hat) * fade * 32767))), 44 + i * 2);
}
mkdirSync('public', { recursive: true }); writeFileSync('public/demo.wav', bytes);
