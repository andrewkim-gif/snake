# === Builder Stage ===
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates tzdata git

WORKDIR /app

# Cache dependencies first (layer caching optimization)
# Build context is project root, so go.mod is at server/go.mod
COPY server/go.mod server/go.sum ./
RUN go mod download && go mod verify

# Copy server source code
COPY server/ .

# Build static binary
ARG VERSION=dev
ARG BUILD_TIME=""
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w \
      -X main.version=${VERSION} \
      -X main.buildTime=${BUILD_TIME}" \
    -o /server ./cmd/server

# === Runtime Stage ===
FROM alpine:3.21

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server
COPY --from=builder /app/data /data

RUN mkdir -p /data/agents /data/players && chown -R appuser:appgroup /data

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["/server"]
