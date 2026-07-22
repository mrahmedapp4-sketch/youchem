---
name: Chromium on Replit NixOS for Puppeteer
description: How to find the real Chromium ELF binary on Replit NixOS so puppeteer-core can launch it
---

The `chromium` command on Replit/NixOS is a **bash wrapper script**, not an ELF binary.
`puppeteer-core` checks the file header and rejects wrapper scripts with "Browser was not found at the configured executablePath".

**Why:** `which chromium` returns the wrapper path. The wrapper ends with `exec "/nix/store/<hash>-chromium-unwrapped-.../libexec/chromium/chromium" ...` — that `exec` target is the real ELF.

**How to apply:** Read the wrapper script and extract the `exec "..."` line:

```ts
const wrapper = execSync('which chromium 2>/dev/null').toString().trim();
const contents = fs.readFileSync(wrapper, 'utf8');
const m = contents.match(/^exec\s+"([^"]+)"/m);
if (m && m[1] && fs.existsSync(m[1])) return m[1]; // real ELF path
```

This survives nix store hash changes (no hardcoded paths). Always log the resolved path at startup so you can verify it.

Also: `tsx` runs with a stripped PATH, so `which chromium` may fail unless you fall back to `which chromium-browser`. Add both attempts before falling back to `/usr/bin/chromium`.
