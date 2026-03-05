# ─── Stage 1: Build ───
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go.mod and go.sum first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /agent-survivor \
    ./cmd/server/

# ─── Stage 2: Runtime ───
FROM scratch

# Copy CA certificates for HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary
COPY --from=builder /agent-survivor /agent-survivor

# Expose port (Railway uses $PORT)
EXPOSE 9001

# Health check endpoint: /health
# Railway handles health checks via HTTP probe

ENTRYPOINT ["/agent-survivor"]
