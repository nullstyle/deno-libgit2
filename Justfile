# Justfile for deno-libgit2
# libgit2 version to build

libgit2_version := "1.9.2"

# Output directory for built libraries

dist_dir := "dist"

# Default recipe
default:
    @just --list

# Run all tests
test:
    deno test --allow-ffi --allow-read --allow-write --allow-env --allow-run tests/

# Run tests with coverage
test-coverage:
    deno test --allow-ffi --allow-read --allow-write --allow-env --allow-run --coverage=coverage tests/
    deno coverage coverage

# Run the basic usage example
run-basic:
    deno run --allow-ffi --allow-read --allow-write --allow-env examples/basic_usage.ts

# Run the inspect repository example
run-inspect path=".":
    deno run --allow-ffi --allow-read --allow-env examples/inspect_repo.ts {{ path }}

# Format all TypeScript files
fmt:
    deno fmt

# Check formatting
fmt-check:
    deno fmt --check

# Lint all TypeScript files
lint:
    deno lint

# Type check all files
check:
    deno check mod.ts

# Publish to JSR (dry run)
publish-dry:
    deno publish --dry-run

# Publish to JSR
publish:
    deno publish

# Clean up temporary files
clean:
    rm -rf coverage/

# Run all checks before publishing
pre-publish: fmt-check lint check test
    @echo "All checks passed!"

# Show libgit2 version
version:
    deno eval "import { init, shutdown, versionString } from './mod.ts'; init(); console.log('libgit2 version:', versionString()); shutdown();" --allow-ffi

# =============================================================================
# Library Build Tasks
# =============================================================================

# Create the dist directory
_ensure-dist:
    mkdir -p {{ dist_dir }}

# Build libgit2 for macOS (current architecture)
build-macos: _ensure-dist
    #!/usr/bin/env bash
    set -euo pipefail

    ARCH=$(uname -m)
    echo "Building libgit2 {{ libgit2_version }} for macOS ${ARCH}..."

    # Create temp build directory
    BUILD_DIR=$(mktemp -d)
    trap "rm -rf $BUILD_DIR" EXIT

    cd "$BUILD_DIR"

    # Download libgit2 source
    curl -L "https://github.com/libgit2/libgit2/archive/refs/tags/v{{ libgit2_version }}.tar.gz" | tar xz
    cd "libgit2-{{ libgit2_version }}"

    # Build
    mkdir build && cd build
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SHARED_LIBS=ON \
        -DUSE_SSH=ON \
        -DUSE_HTTPS=SecureTransport \
        -DBUILD_TESTS=OFF \
        -DBUILD_CLI=OFF \
        -DCMAKE_OSX_ARCHITECTURES="${ARCH}"

    cmake --build . --parallel

    # Copy to dist
    cp libgit2.*.dylib "{{ justfile_directory() }}/{{ dist_dir }}/"

    # Create a versioned copy and a symlink
    cd "{{ justfile_directory() }}/{{ dist_dir }}"
    DYLIB=$(ls libgit2.*.dylib | head -1)
    ln -sf "$DYLIB" "libgit2-darwin-${ARCH}.dylib"

    echo "Built: {{ dist_dir }}/libgit2-darwin-${ARCH}.dylib"

# Build libgit2 for macOS x86_64 (cross-compile on Apple Silicon)

# Note: SSH disabled for cross-compile as libssh2 is architecture-specific
build-macos-x86_64: _ensure-dist
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Building libgit2 {{ libgit2_version }} for macOS x86_64..."

    # Create temp build directory
    BUILD_DIR=$(mktemp -d)
    trap "rm -rf $BUILD_DIR" EXIT

    cd "$BUILD_DIR"

    # Download libgit2 source
    curl -L "https://github.com/libgit2/libgit2/archive/refs/tags/v{{ libgit2_version }}.tar.gz" | tar xz
    cd "libgit2-{{ libgit2_version }}"

    # Build for x86_64
    # Note: SSH disabled because libssh2 from Homebrew is arm64-only when cross-compiling
    mkdir build && cd build
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SHARED_LIBS=ON \
        -DUSE_SSH=OFF \
        -DUSE_HTTPS=SecureTransport \
        -DBUILD_TESTS=OFF \
        -DBUILD_CLI=OFF \
        -DCMAKE_OSX_ARCHITECTURES="x86_64"

    cmake --build . --parallel

    # Copy the versioned dylib to dist with architecture suffix
    # Use the most specific version (e.g., libgit2.1.8.4.dylib)
    DYLIB=$(ls -1 libgit2.*.*.*.dylib 2>/dev/null | head -1 || ls -1 libgit2.*.dylib | head -1)
    cp "$DYLIB" "{{ justfile_directory() }}/{{ dist_dir }}/libgit2-darwin-x86_64.dylib"

    echo "Built: {{ dist_dir }}/libgit2-darwin-x86_64.dylib"

# Build libgit2 for macOS aarch64 (Apple Silicon)

# Note: SSH disabled for cross-compile as libssh2 is architecture-specific
build-macos-aarch64: _ensure-dist
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Building libgit2 {{ libgit2_version }} for macOS aarch64..."

    # Create temp build directory
    BUILD_DIR=$(mktemp -d)
    trap "rm -rf $BUILD_DIR" EXIT

    cd "$BUILD_DIR"

    # Download libgit2 source
    curl -L "https://github.com/libgit2/libgit2/archive/refs/tags/v{{ libgit2_version }}.tar.gz" | tar xz
    cd "libgit2-{{ libgit2_version }}"

    # Build for aarch64
    # Note: SSH disabled because libssh2 from Homebrew may be x86_64-only when cross-compiling
    mkdir build && cd build
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SHARED_LIBS=ON \
        -DUSE_SSH=OFF \
        -DUSE_HTTPS=SecureTransport \
        -DBUILD_TESTS=OFF \
        -DBUILD_CLI=OFF \
        -DCMAKE_OSX_ARCHITECTURES="arm64"

    cmake --build . --parallel

    # Copy the versioned dylib to dist with architecture suffix
    # Use the most specific version (e.g., libgit2.1.8.4.dylib)
    DYLIB=$(ls -1 libgit2.*.*.*.dylib 2>/dev/null | head -1 || ls -1 libgit2.*.dylib | head -1)
    cp "$DYLIB" "{{ justfile_directory() }}/{{ dist_dir }}/libgit2-darwin-aarch64.dylib"

    echo "Built: {{ dist_dir }}/libgit2-darwin-aarch64.dylib"

# Build libgit2 for Linux x86_64 using Docker
build-linux-x86_64: _ensure-dist
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Building libgit2 {{ libgit2_version }} for Linux x86_64 using Docker..."

    # Build using Docker with multi-stage build
    docker build \
        --platform linux/amd64 \
        --build-arg LIBGIT2_VERSION={{ libgit2_version }} \
        -f docker/Dockerfile.linux-x86_64 \
        --target export \
        --output "type=local,dest={{ dist_dir }}/linux-x86_64-tmp" \
        .

    # Move and rename the library
    mv {{ dist_dir }}/linux-x86_64-tmp/libgit2.so.{{ libgit2_version }} {{ dist_dir }}/libgit2-linux-x86_64.so || \
    mv {{ dist_dir }}/linux-x86_64-tmp/libgit2.so {{ dist_dir }}/libgit2-linux-x86_64.so

    # Clean up temp directory
    rm -rf {{ dist_dir }}/linux-x86_64-tmp

    echo "Built: {{ dist_dir }}/libgit2-linux-x86_64.so"

# Build libgit2 for Linux aarch64 using Docker
build-linux-aarch64: _ensure-dist
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Building libgit2 {{ libgit2_version }} for Linux aarch64 using Docker..."

    # Build using Docker with multi-stage build
    docker build \
        --platform linux/arm64 \
        --build-arg LIBGIT2_VERSION={{ libgit2_version }} \
        -f docker/Dockerfile.linux-aarch64 \
        --target export \
        --output "type=local,dest={{ dist_dir }}/linux-aarch64-tmp" \
        .

    # Move and rename the library
    mv {{ dist_dir }}/linux-aarch64-tmp/libgit2.so.{{ libgit2_version }} {{ dist_dir }}/libgit2-linux-aarch64.so || \
    mv {{ dist_dir }}/linux-aarch64-tmp/libgit2.so {{ dist_dir }}/libgit2-linux-aarch64.so

    # Clean up temp directory
    rm -rf {{ dist_dir }}/linux-aarch64-tmp

    echo "Built: {{ dist_dir }}/libgit2-linux-aarch64.so"

# Build all Linux targets using Docker
build-linux: build-linux-x86_64 build-linux-aarch64
    @echo "Built all Linux targets"

# Build all macOS targets
build-macos-all: build-macos-x86_64 build-macos-aarch64
    @echo "Built all macOS targets"

# Build all targets (macOS and Linux)
build-all: build-macos-all build-linux
    @echo "Built all targets"
    @echo ""
    @echo "Artifacts in {{ dist_dir }}/:"
    @ls -la {{ dist_dir }}/

# Clean build artifacts
clean-dist:
    rm -rf {{ dist_dir }}/

# Create release archives for GitHub
package-release: build-all
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Creating release archives..."

    cd {{ dist_dir }}

    # Create individual archives for each platform
    for lib in libgit2-*.dylib libgit2-*.so; do
        if [ -f "$lib" ]; then
            name="${lib%.*}"
            ext="${lib##*.}"
            tar -czvf "${name}.tar.gz" "$lib"
            echo "Created: {{ dist_dir }}/${name}.tar.gz"
        fi
    done

    echo ""
    echo "Release archives created in {{ dist_dir }}/"
    ls -la *.tar.gz
