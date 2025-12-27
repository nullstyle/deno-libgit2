/**
 * End-to-end test suite for deno-libgit2
 *
 * This module exports all E2E tests for the library.
 * Run with: deno test --allow-ffi --allow-read --allow-write --allow-env tests/e2e/
 *
 * The E2E tests use real file operations in temporary directories to validate
 * the library's functionality against actual git repositories.
 */

// Export test helpers for use in other tests
export * from "./helpers.ts";

// Import all test modules to ensure they run
import "./repository_e2e_test.ts";
import "./commit_e2e_test.ts";
import "./branch_e2e_test.ts";
import "./index_e2e_test.ts";
import "./file_history_e2e_test.ts";
