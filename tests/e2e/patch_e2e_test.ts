/**
 * End-to-end tests for patch functionality
 * Tests use real file operations in temporary directories
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { init, shutdown } from "../../mod.ts";
import {
  cleanupTestContext,
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";

Deno.test("E2E Patch Tests", async (t) => {
  await init();

  try {
    await t.step("create patch from diff", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "modified\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Create patch from diff
        const patch = ctx.repo.patchFromDiff(diff, 0);
        assertExists(patch, "Should return a patch");

        // Get patch as string
        const patchStr = patch.toString();
        assert(patchStr.includes("file.txt"), "Patch should mention file.txt");
        assert(patchStr.includes("-initial"), "Patch should show removed line");
        assert(patchStr.includes("+modified"), "Patch should show added line");

        patch.free();
        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("patch num hunks", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "line1\nline2\nline3\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "line1\nmodified\nline3\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff and patch
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        const patch = ctx.repo.patchFromDiff(diff, 0);
        assertExists(patch, "Should return a patch");

        // Check number of hunks
        const numHunks = patch.numHunks;
        assertEquals(numHunks, 1, "Should have 1 hunk");

        patch.free();
        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("patch get delta", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "modified\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff and patch
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        const patch = ctx.repo.patchFromDiff(diff, 0);
        assertExists(patch, "Should return a patch");

        // Get delta from patch
        const delta = patch.getDelta();
        assertExists(delta, "Should return a delta");
        assertEquals(delta.oldFile.path, "file.txt");
        assertEquals(delta.newFile.path, "file.txt");

        patch.free();
        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("patch for added file", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with new file
        await createCommitWithFiles(ctx, "Add file", {
          "file.txt": "initial\n",
          "new.txt": "new content\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertEquals(diff.numDeltas, 1, "Should have 1 delta");

        // Create patch for the added file
        const patch = ctx.repo.patchFromDiff(diff, 0);
        assertExists(patch, "Should return a patch");

        // Get patch as string
        const patchStr = patch.toString();
        assert(patchStr.includes("new.txt"), "Patch should mention new.txt");
        assert(
          patchStr.includes("+new content"),
          "Patch should show added content",
        );

        patch.free();
        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("patch line stats", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "line1\nline2\nline3\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "line1\nmodified\nline3\nnew line\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff and patch
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        const patch = ctx.repo.patchFromDiff(diff, 0);
        assertExists(patch, "Should return a patch");

        // Get line stats
        const stats = patch.lineStats;
        assertExists(stats, "Should return line stats");
        // 1 line deleted (line2), 2 lines added (modified, new line)
        assert(stats.additions >= 1, "Should have additions");
        assert(stats.deletions >= 1, "Should have deletions");

        patch.free();
        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
