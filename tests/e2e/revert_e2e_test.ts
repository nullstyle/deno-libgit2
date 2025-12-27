/**
 * End-to-end tests for revert functionality
 * Tests use real file operations in temporary directories
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { init, shutdown } from "../../mod.ts";
import {
  cleanupTestContext,
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";

Deno.test("E2E Revert Tests", async (t) => {
  await init();

  try {
    await t.step("revert commit to index", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const _baseOid = ctx.repo.headOid();

        // Add a commit that we'll revert
        await createCommitWithFiles(ctx, "Add feature", {
          "feature.txt": "feature content\n",
        });
        const featureOid = ctx.repo.headOid();

        // Revert the feature commit to index
        const index = ctx.repo.revertCommit(featureOid, featureOid);
        assertExists(index, "Should return an index");

        // The index should contain the revert result
        const entryCount = index.entryCount;
        assertExists(entryCount, "Index should have entries");

        index.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("revert modifies working directory", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });

        // Add a commit that we'll revert
        await createCommitWithFiles(ctx, "Add feature", {
          "feature.txt": "feature content\n",
        });
        const featureOid = ctx.repo.headOid();

        // Verify file exists before revert
        const filePath = `${ctx.repoPath}/feature.txt`;
        let fileExists = await Deno.stat(filePath).then(() => true).catch(() =>
          false
        );
        assert(fileExists, "Feature file should exist before revert");

        // Revert the feature commit (modifies working directory)
        ctx.repo.revert(featureOid);

        // Verify the file is removed in working directory
        fileExists = await Deno.stat(filePath).then(() => true).catch(() =>
          false
        );
        assert(!fileExists, "Feature file should be removed after revert");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("revert file modification", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create initial commit with a file
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "original content\n",
        });

        // Modify the file
        await createCommitWithFiles(ctx, "Modify file", {
          "file.txt": "modified content\n",
        });
        const modifyOid = ctx.repo.headOid();

        // Verify modified content
        let content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(content, "modified content\n");

        // Revert the modification
        ctx.repo.revert(modifyOid);

        // Verify content is reverted
        content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(content, "original content\n");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("revert detects conflicts", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });

        // Add a commit that modifies the file
        await createCommitWithFiles(ctx, "First change", {
          "file.txt": "first change\n",
        });
        const firstOid = ctx.repo.headOid();

        // Add another commit that modifies the same file differently
        await createCommitWithFiles(ctx, "Second change", {
          "file.txt": "second change\n",
        });
        const secondOid = ctx.repo.headOid();

        // Revert the first commit should cause conflict
        const index = ctx.repo.revertCommit(firstOid, secondOid);
        assertExists(index, "Should return an index");

        // Check if there are conflicts
        const hasConflicts = index.hasConflicts;
        assert(hasConflicts, "Index should have conflicts");

        index.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("revert non-existent commit throws error", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const baseOid = ctx.repo.headOid();

        const fakeOid = "0000000000000000000000000000000000000000";

        let threw = false;
        try {
          ctx.repo.revertCommit(fakeOid, baseOid);
        } catch {
          threw = true;
        }
        assert(threw, "Should throw error for non-existent commit");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("revert to index preserves working directory", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });

        // Add a feature
        await createCommitWithFiles(ctx, "Add feature", {
          "feature.txt": "feature\n",
        });
        const featureOid = ctx.repo.headOid();

        // Revert to index only (doesn't modify working directory)
        const index = ctx.repo.revertCommit(featureOid, featureOid);
        assertExists(index, "Should return an index");

        // Working directory should still have the file
        const filePath = `${ctx.repoPath}/feature.txt`;
        const fileExists = await Deno.stat(filePath).then(() => true).catch(
          () => false
        );
        assert(
          fileExists,
          "File should still exist in working directory after revertCommit",
        );

        index.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
