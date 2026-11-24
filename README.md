# Tiny Stack VM

A small, fast interpreter for make.fun's tiny stack ISA (v1): 32-bit wrapping
integers, a 256-value stack, 64-deep calls, 256 words of memory, input/output,
and ten traps with their own exit codes.

## Run

```
node main.ts
```

It reads `/input/i001..i040/{program,input}.bin` and writes
`/output/iNNN/stdout.bin` + `/output/iNNN/exit.txt` for each instance.
`MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` override the two directories.
Node 22 stdlib only; nothing is installed and nothing is deleted.

## Files

- `main.ts` — the VM + the driver over the 40 instances
- `LICENSE` — MIT
