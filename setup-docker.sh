#!/bin/bash
# Cross-platform Docker setup script for PrashnaSārathi
# Supports Docker Desktop on Windows and Mac

set -e

echo "=========================================="
echo "PrashnaSārathi Docker Setup"
echo "=========================================="

# Detect OS
OS="$(uname -s)"
echo "Detected OS: $OS"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "Docker version: $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'unknown')"

# Check for docker-compose vs docker compose
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    echo "Using: docker compose (V2)"
else
    COMPOSE_CMD="docker-compose"
    echo "Using: docker-compose (V1)"
fi

# Linux: Check if uid/gid match Docker socket permissions
if [ "$OS" = "Linux" ]; then
    UID=$(id -u)
    GID=$(id -g)
    echo "Host UID: $UID, GID: $GID"
    export UID GID
fi

# Windows/macOS: Ensure Docker Desktop has enough resources
if [ "$OS" = "Darwin" ] || [ "$OS" = "MINGW"* ] || [ "$OS" = "MSYS"* ]; then
    echo ""
    echo "For macOS/Windows, ensure Docker Desktop has:"
    echo "  - At least 4 CPU cores"
    echo "  - At least 4GB RAM"
    echo "  - At least 2GB swap"
    echo ""
fi

# Create required files if missing
echo ""
echo "Checking required files..."
if [ ! -f "./metadata.json" ]; then
    echo "Warning: metadata.json not found"
fi
if [ ! -f "./faqs-complete.json" ]; then
    echo "Warning: faqs-complete.json not found"
fi

# Build and start containers
echo ""
echo "Building and starting containers..."
echo "This may take several minutes on first run..."
echo ""

if [ "$OS" = "Darwin" ]; then
    # macOS: Use standard build without buildx (Rosetta handles arm64)
    echo "Building for macOS..."
fi

eval $COMPOSE_CMD up --build -d

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Frontend:  http://localhost:3000"
echo "  - Backend:   http://localhost:5000/api"
echo "  - MongoDB:   localhost:27017"
echo "  - Redis:     localhost:6379"
echo "  - Elastic:   http://localhost:9200"
echo ""
echo "Logs:"
echo "  $COMPOSE_CMD logs -f"
echo ""
echo "Stop:"
echo "  $COMPOSE_CMD down"
echo "=========================================="