FROM node:22-bookworm-slim

# Tools I actually use: git for commits, ripgrep for search, curl for one-off fetches,
# procps/less so shells behave normally. Emscripten added on first WASM iteration.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates ripgrep procps less build-essential python3 \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

# Match the host user's home path so ~ references inside memory files and inside
# ~/.claude/projects/<slug> resolve identically to how they do on the host.
ENV HOME=/Users/aidenlee

# --dangerously-skip-permissions refuses to run as root. The node base image
# ships with a non-root `node` user (UID 1000) — Docker Desktop for Mac handles
# UID remapping to the host owner transparently on bind mounts.
USER node

WORKDIR /Users/aidenlee/Developer/personal-site

CMD ["bash"]
