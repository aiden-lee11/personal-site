# compiler-bin — prebuilt compiler artifacts

These are **prebuilt binaries** of a separate, private repository. No compiler
source lives in this repo; only the finished artifacts needed to run the
`/api/compile` route are vendored here.

## Layout

Mirrors the runtime image's `/opt/compiler` tree exactly, so the Dockerfile
copies this directory straight in:

```
L1/bin/L1   L2/bin/L2   L3/bin/L3   IR/bin/IR   LA/bin/LA   ← built stage binaries
LC/bin/LC   LB/bin/LB                                       ← prebuilt reference binaries
lib/runtime.c                                               ← C runtime linked per request
```

All stage binaries are `linux/amd64` ELF and only run on that platform (the
compile route falls back to Docker/qemu emulation for local dev on macOS).

## How these are produced

Built by the `build-binaries` GitHub Actions workflow
(`.github/workflows/build-binaries.yml`) on the private repo's `site-fork`
branch:

- `L1 L2 L3 IR LA` are compiled fresh from source on Ubuntu 24.04 / g++-13
  (matching the runtime image's base so the glibc/libstdc++ ABI lines up).
- `LC/bin/LC`, `LB/bin/LB` are prebuilt reference binaries (no source) carried
  through as-is.
- `lib/runtime.c` is copied from the source tree.

The workflow uploads a single `compiler-bin` artifact with this layout. To
refresh: run the workflow (`gh workflow run build-binaries.yml --ref
site-fork` on the private repo), then `gh run download --name compiler-bin`
and replace this directory's contents (restore the executable bit on the
binaries — artifact download strips it).
