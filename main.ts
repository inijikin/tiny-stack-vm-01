// Tiny stack VM, ISA v1: one run answers i001..i040 from /input to /output.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const STEP_MAX = 1000000;
const OUT_MAX = 65536;

// Opcode table, flat [byte, immediate bytes, pops, pushes] x 37; unknown = 255.
const OPS = [0,0,0,0,1,1,0,1,2,4,0,1,3,0,1,0,4,0,1,2,5,0,2,2,6,0,2,3,7,0,3,3,16,0,2,1,17,0,2,1,18,0,2,1,19,0,2,1,20,0,2,1,21,0,2,1,22,0,2,1,23,0,1,1,24,0,2,1,25,0,2,1,26,0,2,1,27,0,1,1,28,0,2,1,29,0,2,1,30,0,2,1,32,0,2,1,33,0,2,1,34,0,2,1,48,2,0,0,49,2,1,0,50,2,1,0,51,2,0,0,52,0,0,0,64,0,1,1,65,0,2,0,80,0,1,0,81,0,1,0,82,0,0,1,83,0,1,0];
const IMM = new Uint8Array(256).fill(255);
const POPS = new Uint8Array(256);
const PUSHES = new Uint8Array(256);
for (let k = 0; k < OPS.length; k += 4) { IMM[OPS[k]] = OPS[k + 1]; POPS[OPS[k]] = OPS[k + 2]; PUSHES[OPS[k]] = OPS[k + 3]; }

function run(prog, input) {
  const n = prog.length;
  const st = new Int32Array(256);
  const cs = new Int32Array(64);
  const mem = new Int32Array(256);
  const out = new Uint8Array(OUT_MAX);
  const dig = new Uint8Array(12);
  let sp = 0, cp = 0, pc = 0, steps = 0, ip = 0, ol = 0;
  const fin = (e) => ({ out: out.subarray(0, ol), exit: e });
  for (;;) {
    if (steps === STEP_MAX) return fin(10);
    if (pc < 0 || pc >= n) return fin(9);
    const op = prog[pc];
    const imm = IMM[op];
    if (imm === 255) return fin(5);
    if (pc + imm >= n) return fin(9);
    steps++;
    const pops = POPS[op];
    if (sp < pops) return fin(2);
    if (sp - pops + PUSHES[op] > 256) return fin(3);
    const nxt = pc + 1 + imm;
    pc = nxt;
    switch (op) {
      case 0x00: return fin(0);
      case 0x01: st[sp++] = (prog[nxt - 1] << 24) >> 24; break;
      case 0x02: st[sp++] = prog[nxt - 4] | (prog[nxt - 3] << 8) | (prog[nxt - 2] << 16) | (prog[nxt - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: st[sp] = st[sp - 1]; sp++; break;
      case 0x05: { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; break; }
      case 0x06: st[sp] = st[sp - 2]; sp++; break;
      case 0x07: { const a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a; break; }
      case 0x17: st[sp - 1] = (-st[sp - 1]) | 0; break;
      case 0x1b: st[sp - 1] = ~st[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = st[sp - 1], a = st[sp - 2];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (!b) return fin(4); r = (a === -2147483648 && b === -1) ? a : (a / b) | 0; }
        else if (op === 0x14) { if (!b) return fin(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 0x15) { if (!b) return fin(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (!b) return fin(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; st[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((prog[nxt - 2] | (prog[nxt - 1] << 8)) << 16) >> 16;
        let go = op === 0x30;
        if (!go) { const v = st[--sp]; go = op === 0x31 ? v === 0 : v !== 0; }
        if (go) pc = nxt + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return fin(7);
        cs[cp++] = nxt;
        pc = prog[nxt - 2] | (prog[nxt - 1] << 8);
        break;
      case 0x34:
        if (!cp) return fin(8);
        pc = cs[--cp];
        break;
      case 0x40: {
        const a = st[sp - 1];
        if (a < 0 || a > 255) return fin(6);
        st[sp - 1] = mem[a];
        break;
      }
      case 0x41: {
        const a = st[sp - 1], v = st[sp - 2];
        if (a < 0 || a > 255) return fin(6);
        sp -= 2; mem[a] = v;
        break;
      }
      case 0x50: {
        const v = st[sp - 1];
        let u = v, neg = false;
        if (v < 0) { neg = true; u = -v; }
        let d = 0;
        do { dig[d++] = 48 + (u % 10); u = (u / 10) | 0; } while (u > 0);
        const len = d + (neg ? 1 : 0);
        if (ol + len > OUT_MAX) return fin(11);
        sp--;
        if (neg) out[ol++] = 45;
        while (d > 0) out[ol++] = dig[--d];
        break;
      }
      case 0x51:
        if (ol + 1 > OUT_MAX) return fin(11);
        out[ol++] = st[--sp] & 255;
        break;
      case 0x52: st[sp++] = ip < input.length ? input[ip++] : -1; break;
      case 0x53: return fin(st[--sp] & 255);
    }
  }
}

for (let k = 1; k <= 40; k++) {
  const id = 'i' + String(k).padStart(3, '0');
  try {
    const prog = readFileSync(join(IN_DIR, id, 'program.bin'));
    let input = new Uint8Array(0);
    try { input = readFileSync(join(IN_DIR, id, 'input.bin')); } catch { /* no input */ }
    const r = run(prog, input);
    const dir = join(OUT_DIR, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'stdout.bin'), r.out);
    writeFileSync(join(dir, 'exit.txt'), String(r.exit));
  } catch (e) {
    console.error(id, 'failed:', e);
    const dir = join(OUT_DIR, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'stdout.bin'), new Uint8Array(0));
    writeFileSync(join(dir, 'exit.txt'), '9');
  }
}
