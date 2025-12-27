# Justfile for deno-libgit2

# Default recipe
default:
    @just --list

# Run all tests
test:
    deno test --allow-ffi --allow-read --allow-write --allow-env --allow-run tests/

# Run unit tests only
test-unit:
    deno test --allow-ffi --allow-read --allow-write --allow-env tests/repository_test.ts tests/file_history_test.ts

# Run E2E tests only
test-e2e:
    deno test --allow-ffi --allow-read --allow-write --allow-env tests/e2e/

# Run tests with coverage
test-coverage:
    deno test --allow-ffi --allow-read --allow-write --allow-env --coverage=coverage tests/
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
