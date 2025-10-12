# Builder stage
FROM rust:1.83-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconfig libssh2-dev libssh2-static zlib-dev zlib-static

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source tree
COPY src ./src
COPY migrations ./migrations

# Build for release
RUN cargo build --release

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libgcc openssl libssh2 ca-certificates

# Copy the binary from builder
COPY --from=builder /app/target/release/deuseda /app/deuseda

# Copy migrations
COPY --from=builder /app/migrations /app/migrations

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./deuseda"]
