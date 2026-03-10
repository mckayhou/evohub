# EvoHub v2.5.0 - Rust Implementation
# Multi-stage build for minimal image size

# Build stage
FROM rust:1.75-alpine AS builder

# Install dependencies
RUN apk add --no-cache musl-dev

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

# Build release binary
RUN cargo build --release --target x86_64-unknown-linux-musl

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S evohub && \
    adduser -u 1001 -S evohub -G evohub

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/evohub /app/evohub

# Change ownership
RUN chown -R evohub:evohub /app

# Switch to non-root user
USER evohub

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the binary
CMD ["./evohub"]
