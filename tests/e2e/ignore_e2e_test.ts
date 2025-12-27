/**
 * End-to-end tests for ignore operations
 */

import { assertEquals } from "@std/assert";
import { cleanupTestContext, createTestContext } from "./helpers.ts";
import { init, shutdown } from "../../mod.ts";

Deno.test("E2E Ignore Tests", async (t) => {
  await init();

  await t.step("check if path is ignored with no .gitignore", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create a file
      await Deno.writeTextFile(`${ctx.repoPath}/test.txt`, "content");

      // Check if it's ignored (should not be)
      const ignored = ctx.repo.pathIsIgnored("test.txt");
      assertEquals(ignored, false);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("check if path is ignored with .gitignore", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create .gitignore
      await Deno.writeTextFile(`${ctx.repoPath}/.gitignore`, "*.log\n");

      // Create files
      await Deno.writeTextFile(`${ctx.repoPath}/test.txt`, "content");
      await Deno.writeTextFile(`${ctx.repoPath}/debug.log`, "log content");

      // Check if they're ignored
      const txtIgnored = ctx.repo.pathIsIgnored("test.txt");
      const logIgnored = ctx.repo.pathIsIgnored("debug.log");

      assertEquals(txtIgnored, false);
      assertEquals(logIgnored, true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("add ignore rule programmatically", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create a file
      await Deno.writeTextFile(`${ctx.repoPath}/temp.tmp`, "temp content");

      // Initially not ignored
      assertEquals(ctx.repo.pathIsIgnored("temp.tmp"), false);

      // Add ignore rule
      ctx.repo.addIgnoreRule("*.tmp\n");

      // Now should be ignored
      assertEquals(ctx.repo.pathIsIgnored("temp.tmp"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("add multiple ignore rules at once", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create files
      await Deno.writeTextFile(`${ctx.repoPath}/file.tmp`, "tmp");
      await Deno.writeTextFile(`${ctx.repoPath}/file.bak`, "bak");
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "txt");

      // Add multiple rules
      ctx.repo.addIgnoreRule("*.tmp\n*.bak\n");

      // Check ignores
      assertEquals(ctx.repo.pathIsIgnored("file.tmp"), true);
      assertEquals(ctx.repo.pathIsIgnored("file.bak"), true);
      assertEquals(ctx.repo.pathIsIgnored("file.txt"), false);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("clear internal ignore rules", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Add ignore rule
      ctx.repo.addIgnoreRule("*.tmp\n");
      assertEquals(ctx.repo.pathIsIgnored("file.tmp"), true);

      // Clear internal rules
      ctx.repo.clearIgnoreRules();

      // Should no longer be ignored (unless in .gitignore file)
      assertEquals(ctx.repo.pathIsIgnored("file.tmp"), false);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("ignore directory pattern", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create directory and file
      await Deno.mkdir(`${ctx.repoPath}/build`, { recursive: true });
      await Deno.writeTextFile(`${ctx.repoPath}/build/output.js`, "code");

      // Add directory ignore rule
      ctx.repo.addIgnoreRule("build/\n");

      // Check if directory contents are ignored
      assertEquals(ctx.repo.pathIsIgnored("build/output.js"), true);
      assertEquals(ctx.repo.pathIsIgnored("build/"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("ignore with negation pattern", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create .gitignore with negation
      await Deno.writeTextFile(
        `${ctx.repoPath}/.gitignore`,
        "*.log\n!important.log\n",
      );

      // Check ignores
      assertEquals(ctx.repo.pathIsIgnored("debug.log"), true);
      assertEquals(ctx.repo.pathIsIgnored("important.log"), false);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("ignore nested directory pattern", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create nested directories
      await Deno.mkdir(`${ctx.repoPath}/src/node_modules`, { recursive: true });
      await Deno.mkdir(`${ctx.repoPath}/lib/node_modules`, { recursive: true });
      await Deno.writeTextFile(
        `${ctx.repoPath}/src/node_modules/package.json`,
        "{}",
      );

      // Add rule to ignore node_modules anywhere
      ctx.repo.addIgnoreRule("**/node_modules/\n");

      // Check ignores
      assertEquals(
        ctx.repo.pathIsIgnored("src/node_modules/package.json"),
        true,
      );
      assertEquals(ctx.repo.pathIsIgnored("lib/node_modules/"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("default internal ignores", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Default internal ignores should include ".", "..", ".git"
      assertEquals(ctx.repo.pathIsIgnored(".git"), true);
      assertEquals(ctx.repo.pathIsIgnored(".git/config"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("ignore rule with spaces in filename", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create file with spaces
      await Deno.writeTextFile(
        `${ctx.repoPath}/file with spaces.txt`,
        "content",
      );

      // Add ignore rule (escape with backslash or quotes)
      ctx.repo.addIgnoreRule("file\\ with\\ spaces.txt\n");

      // Check if ignored
      assertEquals(ctx.repo.pathIsIgnored("file with spaces.txt"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("check non-existent file path", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Add ignore rule
      ctx.repo.addIgnoreRule("*.log\n");

      // Check non-existent file (should still work based on pattern)
      assertEquals(ctx.repo.pathIsIgnored("nonexistent.log"), true);
      assertEquals(ctx.repo.pathIsIgnored("nonexistent.txt"), false);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  shutdown();
});
