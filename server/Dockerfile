# === Builder Stage ===
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /server ./cmd/server

# === Runtime Stage ===
FROM scratch

# Copy binary
COPY --from=builder /server /server

# Expose default port
EXPOSE 8000

ENTRYPOINT ["/server"]
