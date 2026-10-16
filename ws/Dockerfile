# meraat-timer-hub
#
# The live-refresh hub for the panel: a tiny WebSocket server that tells open
# panels the moment a punch is recorded, so the site shows a phone registration
# instantly instead of waiting for the next poll.
#
# Node.js LTS on Alpine because this image only runs the hub itself, and the hub
# has zero npm dependencies (see timer-hub.mjs) - nothing to install, nothing to
# audit, and the image stays around 60 MB.
#
# It is deliberately NOT part of the PHP image: the app image stays PHP-only, and
# a crash loop in the hub cannot take down attendance registration.

FROM node:20-alpine

# The whole process is one file. Copying it explicitly (instead of the folder)
# documents that and keeps the image from accidentally shipping anything else.
WORKDIR /app
COPY timer-hub.mjs ./timer-hub.mjs

# Unprivileged by default: the hub only needs to accept connections.
USER node

ENV NODE_ENV=production \
    HUB_PORT=8090

EXPOSE 8090

# `wget` ships with Alpine's busybox, so the check needs no extra package.
HEALTHCHECK --interval=20s --timeout=4s --start-period=5s --retries=5 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${HUB_PORT}/health" || exit 1

# exec form: PID 1 is node itself, so it receives SIGTERM and shuts down cleanly.
CMD ["node", "timer-hub.mjs"]
