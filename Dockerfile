# syntax=docker/dockerfile:1
#
# Single Railway-deployable image for the personal site + compiler live-run.
#
#   Stage A (compiler): Ubuntu 24.04 (amd64), build the five compiler stage
#                       binaries from compiler-src with make + g++.
#   Stage B (web):      Node 22, build the Next.js app (standalone output).
#   Final (runtime):    Ubuntu 24.04 + Node 22 + gcc + libc dev + the built
#                       stage binaries + runtime.c + the Next server. Runs as a
#                       non-root user. gcc stays because linking happens per
#                       request; the C++ build toolchain and source do NOT ship.
#
# Ubuntu 24.04 ships g++ 13, which accepts the compilers' `-std=c++23`. Build
# and runtime share the same base so the stage binaries' glibc/libstdc++ ABI
# matches at run time.

########################  Stage A: compiler binaries  ########################
FROM --platform=linux/amd64 ubuntu:24.04 AS compiler

RUN apt-get update && apt-get install -y --no-install-recommends \
      make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY compiler-src/ ./compiler-src/

# Build each stage FRESH (never trust checked-in host-arch .bin/bin artifacts).
RUN set -eux; \
    for d in L1 L2 L3 IR LA; do \
      make -C "compiler-src/$d" clean || true; \
      make -C "compiler-src/$d"; \
      test -x "compiler-src/$d/bin/$d"; \
    done

# Assemble a minimal runtime tree: just the stage binaries + runtime.c.
RUN set -eux; \
    mkdir -p /opt/compiler/lib; \
    for d in LA IR L3 L2 L1; do \
      mkdir -p "/opt/compiler/$d/bin"; \
      cp "compiler-src/$d/bin/$d" "/opt/compiler/$d/bin/$d"; \
    done; \
    cp compiler-src/lib/runtime.c /opt/compiler/lib/runtime.c

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

# Compiler binaries + runtime.c (no toolchain, no C++ source).
COPY --from=compiler /opt/compiler /opt/compiler

# Next.js standalone server: server.js + traced node_modules, then static/public.
# Tracing root is /app/site (its lockfile), so server.js sits at the standalone
# root and expects ./.next/static and ./public beside it.
WORKDIR /app
COPY --from=web /app/site/.next/standalone ./
COPY --from=web /app/site/.next/static ./.next/static
COPY --from=web /app/site/public ./public

# Non-root runtime user — the app, every compiler stage, and prog_exec all run
# unprivileged (the container is the only isolation boundary on Railway).
RUN useradd -u 10001 -m appuser \
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
