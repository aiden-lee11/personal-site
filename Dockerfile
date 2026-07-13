# syntax=docker/dockerfile:1
#
# Single Railway-deployable image for the personal site + compiler live-run.
#
# No compiler source lives in this repo. The compiler stage binaries are built
# on a private repo (branch `site-fork`) by its `build-binaries` GitHub Actions
# workflow and vendored here under compiler-bin/ (see compiler-bin/README.md),
# laid out exactly as the runtime's /opt/compiler tree expects.
#
#   Stage B (web):    Node 22, build the Next.js app (standalone output).
#   Final (runtime):  Ubuntu 24.04 + Node 22 + gcc + libc dev + the vendored
#                     stage binaries + runtime.c + the Next server. Runs as a
#                     non-root user. gcc stays because linking happens per
#                     request; the C++ build toolchain does NOT ship.
#
# The binaries are built on Ubuntu 24.04 / g++-13 (linux/amd64), so the runtime
# base matches them and their glibc/libstdc++ ABI lines up at run time.

##########################  Stage B: Next.js build  ##########################
FROM node:22-slim AS web

WORKDIR /app/site
ENV NEXT_TELEMETRY_DISABLED=1
COPY site/package.json site/package-lock.json ./
RUN npm ci
COPY site/ ./
RUN npm run build

#############################  Final: runtime  ###############################
FROM --platform=linux/amd64 ubuntu:24.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    COMPILER_BIN_DIR=/opt/compiler \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# gcc + libc6-dev: compile runtime.c and link prog.S per request.
# libstdc++6: run the C++ stage binaries. nodejs 22: run the Next server.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends \
      nodejs gcc libc6-dev libstdc++6 tini \
 && rm -rf /var/lib/apt/lists/*

# Loader path some x86-64 binaries expect.
RUN mkdir -p /lib64 \
 && ln -sf /lib/x86_64-linux-gnu/ld-linux-x86-64.so.2 /lib64/ld-linux-x86-64.so.2

# Vendored compiler artifacts (no toolchain, no C++ source). The bundle already
# mirrors /opt/compiler: <STAGE>/bin/<STAGE> for LA IR L3 L2 L1 + LC LB, plus
# lib/runtime.c. Restore the executable bit (git preserves it, but keep this
# explicit) and verify every binary is present and the LC -> LB prefix runs, so
# a missing/broken binary fails the build here rather than at request time.
COPY compiler-bin/ /opt/compiler/
RUN set -eux; \
    for d in LA IR L3 L2 L1 LC LB; do \
      chmod +x "/opt/compiler/$d/bin/$d"; \
      test -x "/opt/compiler/$d/bin/$d"; \
    done; \
    test -s /opt/compiler/lib/runtime.c; \
    mkdir -p /tmp/lc-smoke; cd /tmp/lc-smoke; \
    printf 'void main ( ) {\n  int x\n  x <- 1\n  print(x)\n  return\n}\n' > prog.LC; \
    /opt/compiler/LC/bin/LC prog.LC -g 1 -O0; test -s prog.b; \
    /opt/compiler/LB/bin/LB prog.b -g 1 -O0; test -s prog.a; \
    cd /; rm -rf /tmp/lc-smoke

# Next.js standalone server: server.js + traced node_modules, then static/public.
# Tracing root is /app/site (its lockfile), so server.js sits at the standalone
# root and expects ./.next/static and ./public beside it.
WORKDIR /app
COPY --from=web /app/site/.next/standalone ./
COPY --from=web /app/site/.next/static ./.next/static
COPY --from=web /app/site/public ./public

# Precompiled-preset cache. Bring in just the generator, the shared cache
# module, and the preset SOURCES, then compile the 4 presets (× full/no opts)
# with the SHIPPED stage binaries + gcc + runtime.c. Because generation uses
# the very binaries that will serve requests, the recorded compiler fingerprint
# matches at runtime and the cache can never be stale/mismatched — the route
# verifies it and otherwise falls back to live compilation. Never fails the
# build (the script swallows its own errors); a missing cache just means live
# compiles.
ENV PRESET_CACHE_DIR=/app/precomputed-presets \
    PRESET_CONTENT_DIR=/app/content/compiler-presets \
    PRESET_CACHE_SHARED=/app/lib/presetCache.mjs
COPY --from=web /app/site/scripts/precompile-presets.mjs ./scripts/precompile-presets.mjs
COPY --from=web /app/site/src/lib/presetCache.mjs ./lib/presetCache.mjs
COPY --from=web /app/site/content/compiler-presets ./content/compiler-presets
RUN node scripts/precompile-presets.mjs

# Non-root runtime user — the app, every compiler stage, and prog_exec all run
# unprivileged (the container is the only isolation boundary on Railway).
# The uid must be unusual: RLIMIT_NPROC (the compile route's `ulimit -u`) is
# tallied per-uid across the HOST kernel, and Railway containers share hosts —
# a common uid like 10001 can land with its process budget already spent by a
# neighbouring tenant, and every fork fails EAGAIN ("Resource temporarily
# unavailable" from timeout/gcc).
RUN useradd -u 54737 -m appuser \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
# tini as PID 1 reaps orphaned zombies — untrusted programs that fork-and-detach
# would otherwise leave <defunct> entries that consume PID slots against the
# per-uid `-u` cap. (Railway's custom start command overrides CMD, not the
# ENTRYPOINT, so tini stays in front of it.)
ENTRYPOINT ["/usr/bin/tini", "--"]
# Standalone server binds $PORT / $HOSTNAME (Railway injects PORT).
CMD ["node", "server.js"]
