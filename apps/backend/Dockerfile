# ============================================================
# Build stage: server, worker and seed binaries
# ============================================================
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN for b in server worker seed; do \
      CGO_ENABLED=0 go build -ldflags="-w -s" -o /app/bin/$b ./cmd/$b || exit 1; \
    done

# ============================================================
# Runtime stage
# ============================================================
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/bin/ ./
COPY --from=builder /app/configs ./configs

EXPOSE 8080

CMD ["./server"]
