# Deploying to Railway

This repo builds to a **single container image** (see `Dockerfile`) that serves
the Next.js site *and* runs the compiler playground's `▸▸ run` feature. The
layer-by-layer transforms (LA → IR → L3 → L2 → L1 → x86) run in the browser via
WebAssembly and need no server. Only `▸▸ run` — link the emitted x86 with the C
runtime, execute it, and time it — hits the server (`POST /api/compile`), which
exec's the in-image compiler binaries + gcc directly. **No Docker-in-Docker.**

## What the image contains

- **Stage A** (Ubuntu 24.04): builds the five compiler stage binaries from
  `compiler-src/` (`LA IR L3 L2 L1`) with `make` + `g++ 13`, plus `lib/runtime.c`.
  Built fresh from source — the checked-in `.bin/bin` artifacts are never shipped.
- **Stage B** (Node 22): `npm ci && npm run build` of `site/` (Next standalone).
- **Final** (Ubuntu 24.04): Node 22 + `gcc`/`libc6-dev` (linking happens per
  request) + `libstdc++6` + the stage binaries at `/opt/compiler` + the Next
  standalone server. Runs as non-root `appuser`.

## One-time setup

1. Install the CLI and log in:
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. From the repo root, link (or create) a project + service:
   ```bash
   railway init          # or: railway link   (to attach to an existing project)
   ```
3. **Force the Dockerfile builder.** `railway.json` already pins it
   (`build.builder = "DOCKERFILE"`, `dockerfilePath = "Dockerfile"`), so Railway
   will not fall back to Nixpacks. If you configure via the dashboard instead:
   Service → Settings → Build → Builder = **Dockerfile**, path `Dockerfile`.
   Keep the **build context at the repo root** — the build needs both
   `compiler-src/` and `site/`.

## Required variables

Set these on the Railway **service** (dashboard → Variables, or CLI):

```bash
railway variables --set "BLOB_READ_WRITE_TOKEN=<vercel-blob-rw-token>" \
                  --set "UPLOAD_PASSWORD=<gallery-upload-password>"
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | injected by Railway | Port the server binds. The standalone server reads it automatically — do **not** hardcode. |
| `BLOB_READ_WRITE_TOKEN` | if the gallery upload feature is used | Vercel Blob read/write token for gallery uploads. |
| `UPLOAD_PASSWORD` | if the gallery upload feature is used | Password gating gallery uploads. |
| `COMPILER_BIN_DIR` | no (defaults to `/opt/compiler` in-image) | Dir holding `<STAGE>/bin/<STAGE>` + `lib/runtime.c`. Override only for unusual layouts. |
| `COMPILER_RUNTIME_C` | no | Path to `runtime.c` (defaults under `COMPILER_BIN_DIR`). |
| `COMPILER_GCC` | no (defaults `gcc`) | gcc used for the link step. |

The Vercel Blob variables must live on Railway now because the whole app runs
here (it is no longer split across Vercel).

## Deploy

```bash
railway up            # builds the Dockerfile remotely and deploys
# or connect the GitHub repo in the dashboard for push-to-deploy
```

Railway assigns a domain (Settings → Networking → Generate Domain).

## Verify

- `GET /` returns the homepage (this is also the healthcheck path).
- `GET /compiler/playground` loads; the transform view works with **no** server
  (it's WASM).
- `▸▸ run` on a preset returns `ok:true` with `programOutput`, `runExit`, and a
  plausible `runMs`. Toggling an IR pass (e.g. turning off DCE) changes the
  emitted IR/x86.

Local dress rehearsal (equivalent to what Railway runs):

```bash
docker build --platform linux/amd64 -t personal-site:test .
docker run --rm -p 8080:8080 -e PORT=8080 personal-site:test
# then:
curl -s localhost:8080/ -o /dev/null -w '%{http_code}\n'
curl -s -X POST localhost:8080/api/compile \
  -H 'content-type: application/json' \
  -d '{"source":"...LA source...","fromLayer":"LA","run":true}' | jq '.ok,.runExit,.runMs'
```

## Build/runtime settings summary

- Builder: **Dockerfile** (pinned in `railway.json`; not Nixpacks).
- Start command: `node server.js` (Next standalone; binds `$PORT`/`$HOSTNAME`).
- Healthcheck: `/`, timeout 300s; restart `ON_FAILURE` (max 5).
- Compile ceiling is ~90s (`COMPILE_TIMEOUT_MS`) and run ceiling ~30s
  (`RUN_TIMEOUT_MS`) in `site/src/app/api/compile/route.ts`. Railway's proxy
  streams long responses and does not hard-cut at a low value, so these fit. If
  a future edge timeout truncates long compiles, lower `COMPILE_TIMEOUT_MS`.

## Security model & residual risk (IMPORTANT)

`POST /api/compile` compiles and executes **arbitrary user-submitted code**. On
Railway there is **no per-request microVM** — a standard shared-infra container
is the only isolation boundary — so in-container hardening does the real work:

- The whole app process (and therefore every compiler stage and the linked
  `prog_exec`) runs as **non-root** `appuser`.
- Every exec is wrapped in `ulimit` caps — CPU seconds (`-t`), address space
  (`-v`), file size (`-f`), and process count (`-u`, fork-bomb guard) — **plus**
  a wall-clock `timeout`. A `while(1)`, a huge `malloc`, or a fork bomb is
  killed and cannot wedge the server or bleed into other requests.
- Each executed program runs in its **own process group**; the whole group is
  SIGKILL-swept on timeout and after exit, so a program that forks-and-detaches
  (e.g. a fork bomb via hand-written L1/asm) cannot leave stragglers. `tini`
  runs as PID 1 to reap the corpses, so they don't linger as `<defunct>` PID-slot
  leaks against the `-u` cap.
- Each request runs in its own `mkdtemp` working dir, removed afterward. There
  is no shared warm state a bad run can corrupt.
- **Per-IP rate limiting** on the run path (12 runs / 15s) bounds burst.
- Source size (128 KB), program stdout (32 KB), and PID/fork limits are enforced.

**Residual risk — network egress:** the executed program's outbound network is
**NOT** cut. Cleanly dropping a child's egress needs a Linux network namespace /
`NET_ADMIN`, which Railway does not grant unprivileged containers; shipping a
privileged hack would be worse. So a determined user can issue raw syscalls
(e.g. hand-written x86 that opens a socket) and reach the network **from inside
this container**. The mitigations are the strict CPU/mem/time/pid caps, the
per-IP rate limit, the source-size cap, and Railway's container isolation
keeping this off the host and away from other tenants. If you need a hard egress
guarantee, run this service on infra that grants network namespaces (or a
gVisor/Firecracker sandbox) and drop the child's networking there.
