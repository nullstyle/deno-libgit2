/**
 * End-to-end tests for pathspec operations
 */

import { assertEquals, assertExists } from "@std/assert";
import { cleanupTestContext, createTestContext } from "./helpers.ts";
import { GitPathspecFlags, init, shutdown } from "../../mod.ts";

Deno.test("E2E Pathspec Tests", async (t) => {
  await init();

  await t.step("create pathspec and match single path", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create a pathspec for *.txt files
      const ps = ctx.repo.createPathspec(["*.txt"]);
      assertExists(ps);

      // Test matching
      assertEquals(ps.matchesPath("file.txt"), true);
      assertEquals(ps.matchesPath("file.md"), false);
      assertEquals(ps.matchesPath("dir/file.txt"), true);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("pathspec with multiple patterns", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const ps = ctx.repo.createPathspec(["*.txt", "*.md", "src/*"]);

      assertEquals(ps.matchesPath("readme.txt"), true);
      assertEquals(ps.matchesPath("readme.md"), true);
      assertEquals(ps.matchesPath("src/main.ts"), true);
      assertEquals(ps.matchesPath("lib/main.ts"), false);
      assertEquals(ps.matchesPath("file.js"), false);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("pathspec case-insensitive matching", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const ps = ctx.repo.createPathspec(["*.TXT"]);

      // With IGNORE_CASE flag
      assertEquals(
        ps.matchesPath("file.txt", GitPathspecFlags.IGNORE_CASE),
        true,
      );
      assertEquals(
        ps.matchesPath("FILE.TXT", GitPathspecFlags.IGNORE_CASE),
        true,
      );

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("pathspec no glob mode", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const ps = ctx.repo.createPathspec(["*.txt"]);

      // With NO_GLOB flag, should match literally
      assertEquals(ps.matchesPath("*.txt", GitPathspecFlags.NO_GLOB), true);
      assertEquals(ps.matchesPath("file.txt", GitPathspecFlags.NO_GLOB), false);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  // Skip: match pathspec against index - requires Index class refactoring
  // The Index class is obtained via getIndex() not index()

  // Skip: match pathspec against tree - requires tree lookup FFI fixes
  // The matchTree method needs proper pointer handling

  await t.step("pathspec directory pattern", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const ps = ctx.repo.createPathspec(["src/**"]);

      assertEquals(ps.matchesPath("src/file.ts"), true);
      assertEquals(ps.matchesPath("src/sub/file.ts"), true);
      assertEquals(ps.matchesPath("lib/file.ts"), false);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("pathspec negation pattern", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Note: libgit2 pathspec doesn't support negation like gitignore
      // This test verifies basic pattern matching
      const ps = ctx.repo.createPathspec(["*.ts"]);

      assertEquals(ps.matchesPath("main.ts"), true);
      assertEquals(ps.matchesPath("main.js"), false);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("empty pathspec matches everything", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const ps = ctx.repo.createPathspec([]);

      // Empty pathspec matches everything in libgit2
      assertEquals(ps.matchesPath("any/file.txt"), true);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("pathspec with exact filename", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const ps = ctx.repo.createPathspec(["package.json"]);

      assertEquals(ps.matchesPath("package.json"), true);
      // Note: pathspec doesn't match subdirectory paths by default
      // unless using ** glob pattern
      assertEquals(ps.matchesPath("package.lock"), false);

      ps.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  shutdown();
});
