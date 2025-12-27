/**
 * End-to-end tests for worktree functionality
 * Tests use real file operations in temporary directories
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { init, shutdown } from "../../mod.ts";
import {
  cleanupTestContext,
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";

Deno.test("E2E Worktree Tests", async (t) => {
  await init();

  try {
    await t.step(
      "list worktrees returns empty array for repo without worktrees",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Initial", {
            "file.txt": "content\n",
          });

          const worktrees = ctx.repo.listWorktrees();
          assertEquals(worktrees, [], "Should return empty array");
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step("add worktree creates new working directory", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create a worktree
        const worktreePath = `${ctx.repoPath}-worktree`;
        const worktree = ctx.repo.addWorktree("feature", worktreePath);
        assertExists(worktree, "Should return worktree object");

        // Check that the worktree directory was created
        const stat = await Deno.stat(worktreePath);
        assert(stat.isDirectory, "Worktree path should be a directory");

        // Check that the file exists in the worktree
        const content = await Deno.readTextFile(`${worktreePath}/file.txt`);
        assertEquals(content, "content\n", "File should exist in worktree");

        worktree.free();

        // Cleanup worktree directory
        await Deno.remove(worktreePath, { recursive: true });
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("list worktrees returns added worktrees", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create a worktree
        const worktreePath = `${ctx.repoPath}-worktree`;
        const worktree = ctx.repo.addWorktree("feature", worktreePath);
        worktree.free();

        // List worktrees
        const worktrees = ctx.repo.listWorktrees();
        assertEquals(worktrees.length, 1, "Should have one worktree");
        assertEquals(worktrees[0], "feature", "Worktree name should match");

        // Cleanup worktree directory
        await Deno.remove(worktreePath, { recursive: true });
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("lookup worktree by name", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create a worktree
        const worktreePath = `${ctx.repoPath}-worktree`;
        const worktree = ctx.repo.addWorktree("feature", worktreePath);
        worktree.free();

        // Lookup the worktree
        const lookedUp = ctx.repo.lookupWorktree("feature");
        assertExists(lookedUp, "Should find worktree");
        assertEquals(lookedUp.name, "feature", "Name should match");

        lookedUp.free();

        // Cleanup worktree directory
        await Deno.remove(worktreePath, { recursive: true });
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("worktree name and path properties", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create a worktree
        const worktreePath = `${ctx.repoPath}-worktree`;
        const worktree = ctx.repo.addWorktree("feature", worktreePath);

        assertEquals(worktree.name, "feature", "Name should match");
        assert(
          worktree.path.includes("worktree"),
          "Path should contain worktree",
        );

        worktree.free();

        // Cleanup worktree directory
        await Deno.remove(worktreePath, { recursive: true });
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step(
      "worktree validate returns true for valid worktree",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Initial", {
            "file.txt": "content\n",
          });

          // Create a worktree
          const worktreePath = `${ctx.repoPath}-worktree`;
          const worktree = ctx.repo.addWorktree("feature", worktreePath);

          const isValid = worktree.validate();
          assert(isValid, "Worktree should be valid");

          worktree.free();

          // Cleanup worktree directory
          await Deno.remove(worktreePath, { recursive: true });
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step("lock and unlock worktree", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create a worktree
        const worktreePath = `${ctx.repoPath}-worktree`;
        const worktree = ctx.repo.addWorktree("feature", worktreePath);

        // Lock the worktree
        worktree.lock("Testing lock");

        // Check if locked
        const lockInfo = worktree.isLocked();
        assert(lockInfo.locked, "Worktree should be locked");
        assertEquals(
          lockInfo.reason,
          "Testing lock",
          "Lock reason should match",
        );

        // Unlock the worktree
        worktree.unlock();

        // Check if unlocked
        const unlockInfo = worktree.isLocked();
        assert(!unlockInfo.locked, "Worktree should be unlocked");

        worktree.free();

        // Cleanup worktree directory
        await Deno.remove(worktreePath, { recursive: true });
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("prune worktree removes it", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create a worktree
        const worktreePath = `${ctx.repoPath}-worktree`;
        const worktree = ctx.repo.addWorktree("feature", worktreePath);
        worktree.free();

        // Remove the worktree directory to make it prunable
        await Deno.remove(worktreePath, { recursive: true });

        // Lookup and prune
        const toprune = ctx.repo.lookupWorktree("feature");
        assertExists(toprune, "Should find worktree");

        // Prune with VALID flag to force pruning
        toprune.prune({ flags: 1 }); // VALID = 1
        toprune.free();

        // Verify it's gone
        const worktrees = ctx.repo.listWorktrees();
        assertEquals(
          worktrees.length,
          0,
          "Should have no worktrees after prune",
        );
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("multiple worktrees", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        // Create multiple worktrees
        const worktreePath1 = `${ctx.repoPath}-worktree1`;
        const worktreePath2 = `${ctx.repoPath}-worktree2`;

        const wt1 = ctx.repo.addWorktree("feature1", worktreePath1);
        const wt2 = ctx.repo.addWorktree("feature2", worktreePath2);

        wt1.free();
        wt2.free();

        // List worktrees
        const worktrees = ctx.repo.listWorktrees();
        assertEquals(worktrees.length, 2, "Should have two worktrees");
        assert(worktrees.includes("feature1"), "Should include feature1");
        assert(worktrees.includes("feature2"), "Should include feature2");

        // Cleanup worktree directories
        await Deno.remove(worktreePath1, { recursive: true });
        await Deno.remove(worktreePath2, { recursive: true });
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("lookup non-existent worktree returns null", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        const worktree = ctx.repo.lookupWorktree("nonexistent");
        assertEquals(
          worktree,
          null,
          "Should return null for non-existent worktree",
        );
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
