/**
 * End-to-end tests for worktree functionality
 *
 * These tests validate worktree functionality including:
 * - Listing worktrees
 * - Adding worktrees with various options
 * - Looking up worktrees
 * - Worktree properties (name, path, ptr)
 * - Validation
 * - Locking/unlocking with reasons
 * - Pruning with flags
 * - Symbol.dispose support
 * - Error handling
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { WorktreePruneFlags } from "../../src/worktree.ts";
import { createCommitWithFiles, createTestContext, setupLibrary } from "./helpers.ts";

Deno.test("E2E Worktree Tests", async (t) => {
  using _git = await setupLibrary();

  // ==================== List Worktrees Tests ====================

    await t.step(
      "list worktrees returns empty array for repo without worktrees",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "content\n",
        });

        const worktrees = ctx.repo.listWorktrees();
        assertEquals(worktrees, [], "Should return empty array");
      },
    );

    await t.step("list worktrees returns added worktrees", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
    });

    await t.step("multiple worktrees", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
    });

    // ==================== Add Worktree Tests ====================

    await t.step("add worktree creates new working directory", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
    });

    await t.step("add worktree with lock option", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const worktreePath = `${ctx.repoPath}-worktree-locked`;
      const worktree = ctx.repo.addWorktree("locked-feature", worktreePath, {
        lock: true,
      });

      // Check if it's locked
      const lockInfo = worktree.isLocked();
      assertEquals(lockInfo.locked, true, "Worktree should be locked");

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("add worktree with checkoutExisting option", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const worktreePath = `${ctx.repoPath}-worktree-existing`;
      const worktree = ctx.repo.addWorktree("checkout-test", worktreePath, {
        checkoutExisting: true,
      });
      assertExists(worktree);

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("add worktree without options", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-no-opts`;
      // Pass undefined/null options
      const worktree = ctx.repo.addWorktree(
        "no-options",
        worktreePath,
        undefined,
      );
      assertExists(worktree);

      // Should not be locked by default
      const lockInfo = worktree.isLocked();
      assertEquals(lockInfo.locked, false);

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    // ==================== Lookup Worktree Tests ====================

    await t.step("lookup worktree by name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
    });

    await t.step("lookup non-existent worktree returns null", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const worktree = ctx.repo.lookupWorktree("nonexistent");
      assertEquals(
        worktree,
        null,
        "Should return null for non-existent worktree",
      );
    });

    // ==================== Worktree Properties Tests ====================

    await t.step("worktree name and path properties", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
    });

    await t.step("worktree ptr property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-ptr`;
      const worktree = ctx.repo.addWorktree("ptr-test", worktreePath);

      assertExists(worktree.ptr);
      assertNotEquals(worktree.ptr, null);

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    // ==================== Validate Tests ====================

    await t.step(
      "worktree validate returns true for valid worktree",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
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
      },
    );

    await t.step(
      "worktree validate returns false for invalid worktree",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

        const worktreePath = `${ctx.repoPath}-worktree-invalid`;
        const worktree = ctx.repo.addWorktree("invalid-test", worktreePath);
        worktree.free();

        // Remove the worktree directory to make it invalid
        await Deno.remove(worktreePath, { recursive: true });

        // Lookup again and validate
        const invalidWorktree = ctx.repo.lookupWorktree("invalid-test");
        assertExists(invalidWorktree);

        const isValid = invalidWorktree.validate();
        assertEquals(isValid, false, "Worktree should be invalid");

        invalidWorktree.free();
      },
    );

    // ==================== Lock/Unlock Tests ====================

    await t.step("lock and unlock worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
    });

    await t.step("lock worktree without reason", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-lock-no-reason`;
      const worktree = ctx.repo.addWorktree("lock-no-reason", worktreePath);

      // Lock without reason
      worktree.lock();

      const lockInfo = worktree.isLocked();
      assertEquals(lockInfo.locked, true);
      // Reason may be null or empty when not specified
      assertEquals(lockInfo.reason === null || lockInfo.reason === "", true);

      worktree.unlock();
      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("unlock already unlocked worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-unlock`;
      const worktree = ctx.repo.addWorktree("unlock-test", worktreePath);

      // Already unlocked, should not throw
      worktree.unlock();

      const lockInfo = worktree.isLocked();
      assertEquals(lockInfo.locked, false);

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("isLocked returns lock info structure", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-lock-info`;
      const worktree = ctx.repo.addWorktree("lock-info-test", worktreePath);

      // Check unlocked state
      const unlockInfo = worktree.isLocked();
      assertEquals(typeof unlockInfo.locked, "boolean");
      assertEquals(unlockInfo.locked, false);
      assertEquals(unlockInfo.reason, null);

      // Lock and check again
      worktree.lock("My reason");
      const lockInfo = worktree.isLocked();
      assertEquals(lockInfo.locked, true);
      assertEquals(lockInfo.reason, "My reason");

      worktree.unlock();
      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    // ==================== isPrunable Tests ====================

    await t.step("isPrunable returns false for valid worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-prunable`;
      const worktree = ctx.repo.addWorktree("prunable-test", worktreePath);

      // Valid worktree should not be prunable without flags
      const isPrunable = worktree.isPrunable();
      assertEquals(isPrunable, false);

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("isPrunable with VALID flag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-prunable-valid`;
      const worktree = ctx.repo.addWorktree("prunable-valid", worktreePath);

      // With VALID flag, valid worktree can be pruned
      const isPrunable = worktree.isPrunable({
        flags: WorktreePruneFlags.VALID,
      });
      assertEquals(isPrunable, true);

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("isPrunable returns true for invalid worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-invalid-prune`;
      const worktree = ctx.repo.addWorktree("invalid-prune", worktreePath);
      worktree.free();

      // Remove the worktree directory
      await Deno.remove(worktreePath, { recursive: true });

      // Lookup and check
      const invalidWorktree = ctx.repo.lookupWorktree("invalid-prune");
      assertExists(invalidWorktree);

      const isPrunable = invalidWorktree.isPrunable();
      assertEquals(isPrunable, true);

      invalidWorktree.free();
    });

    await t.step("isPrunable with LOCKED flag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-locked-prune`;
      const worktree = ctx.repo.addWorktree("locked-prune", worktreePath);

      worktree.lock("Test lock");

      // Without LOCKED flag, locked worktree may not be prunable
      const isPrunableWithoutFlag = worktree.isPrunable({
        flags: WorktreePruneFlags.VALID,
      });

      // With LOCKED flag, should be prunable
      const isPrunableWithFlag = worktree.isPrunable({
        flags: WorktreePruneFlags.VALID | WorktreePruneFlags.LOCKED,
      });
      assertEquals(isPrunableWithFlag, true);

      worktree.unlock();
      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    // ==================== Prune Tests ====================

    await t.step("prune worktree removes it", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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
      toprune.prune({ flags: WorktreePruneFlags.VALID });
      toprune.free();

      // Verify it's gone
      const worktrees = ctx.repo.listWorktrees();
      assertEquals(
        worktrees.length,
        0,
        "Should have no worktrees after prune",
      );
    });

    await t.step("prune with combined flags", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-combined-prune`;
      const worktree = ctx.repo.addWorktree("combined-prune", worktreePath);
      worktree.free();

      await Deno.remove(worktreePath, { recursive: true });

      const toPrune = ctx.repo.lookupWorktree("combined-prune");
      assertExists(toPrune);

      // Use combined flags
      toPrune.prune({
        flags: WorktreePruneFlags.VALID |
          WorktreePruneFlags.LOCKED |
          WorktreePruneFlags.WORKING_TREE,
      });
      toPrune.free();

      const remaining = ctx.repo.listWorktrees();
      assertEquals(remaining.length, 0);
    });

    // ==================== Symbol.dispose Tests ====================

    await t.step("worktree supports Symbol.dispose", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-dispose`;

      {
        using worktree = ctx.repo.addWorktree("dispose-test", worktreePath);
        assertExists(worktree);
        assertEquals(worktree.name, "dispose-test");
      }
      // Worktree disposed on scope exit

      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("worktree free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-free`;
      const worktree = ctx.repo.addWorktree("free-test", worktreePath);

      worktree.free();
      worktree.free();
      worktree.free();

      await Deno.remove(worktreePath, { recursive: true });
    });

    // ==================== Error Handling Tests ====================

    await t.step("throws when accessing freed worktree name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-freed`;
      const worktree = ctx.repo.addWorktree("freed-test", worktreePath);
      worktree.free();

      assertThrows(
        () => worktree.name,
        Error,
        "Worktree has been freed",
      );

      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("throws when accessing freed worktree path", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-freed-path`;
      const worktree = ctx.repo.addWorktree("freed-path-test", worktreePath);
      worktree.free();

      assertThrows(
        () => worktree.path,
        Error,
        "Worktree has been freed",
      );

      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("throws when validating freed worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-freed-validate`;
      const worktree = ctx.repo.addWorktree(
        "freed-validate-test",
        worktreePath,
      );
      worktree.free();

      assertThrows(
        () => worktree.validate(),
        Error,
        "Worktree has been freed",
      );

      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("throws when locking freed worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-freed-lock`;
      const worktree = ctx.repo.addWorktree("freed-lock-test", worktreePath);
      worktree.free();

      assertThrows(
        () => worktree.lock("test"),
        Error,
        "Worktree has been freed",
      );

      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("throws when unlocking freed worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-freed-unlock`;
      const worktree = ctx.repo.addWorktree("freed-unlock-test", worktreePath);
      worktree.free();

      assertThrows(
        () => worktree.unlock(),
        Error,
        "Worktree has been freed",
      );

      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step(
      "throws when checking isLocked on freed worktree",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

        const worktreePath = `${ctx.repoPath}-worktree-freed-locked`;
        const worktree = ctx.repo.addWorktree(
          "freed-isLocked-test",
          worktreePath,
        );
        worktree.free();

        assertThrows(
          () => worktree.isLocked(),
          Error,
          "Worktree has been freed",
        );

        await Deno.remove(worktreePath, { recursive: true });
      },
    );

    await t.step(
      "throws when checking isPrunable on freed worktree",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

        const worktreePath = `${ctx.repoPath}-worktree-freed-prunable`;
        const worktree = ctx.repo.addWorktree(
          "freed-prunable-test",
          worktreePath,
        );
        worktree.free();

        assertThrows(
          () => worktree.isPrunable(),
          Error,
          "Worktree has been freed",
        );

        await Deno.remove(worktreePath, { recursive: true });
      },
    );

    await t.step("throws when pruning freed worktree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-freed-prune`;
      const worktree = ctx.repo.addWorktree("freed-prune-test", worktreePath);
      worktree.free();

      assertThrows(
        () => worktree.prune(),
        Error,
        "Worktree has been freed",
      );

      await Deno.remove(worktreePath, { recursive: true });
    });

    // ==================== Edge Cases ====================

    await t.step("worktree with special characters in name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-special`;
      const worktree = ctx.repo.addWorktree(
        "feature-with-dashes",
        worktreePath,
      );
      assertExists(worktree);
      assertEquals(worktree.name, "feature-with-dashes");

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("worktree name with underscores", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-underscore`;
      const worktree = ctx.repo.addWorktree(
        "feature_with_underscores",
        worktreePath,
      );
      assertExists(worktree);
      assertEquals(worktree.name, "feature_with_underscores");

      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });

    await t.step("multiple sequential worktree operations", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const paths: string[] = [];

      // Create several worktrees
      for (let i = 0; i < 3; i++) {
        const worktreePath = `${ctx.repoPath}-worktree-seq-${i}`;
        paths.push(worktreePath);
        const wt = ctx.repo.addWorktree(`seq-${i}`, worktreePath);
        wt.free();
      }

      // Verify all exist
      const worktrees = ctx.repo.listWorktrees();
      assertEquals(worktrees.length, 3);

      // Look up each one
      for (let i = 0; i < 3; i++) {
        const wt = ctx.repo.lookupWorktree(`seq-${i}`);
        assertExists(wt);
        assertEquals(wt.name, `seq-${i}`);
        wt.free();
      }

      // Cleanup
      for (const p of paths) {
        await Deno.remove(p, { recursive: true });
      }
    });

    await t.step("worktree lock with long reason", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c" });

      const worktreePath = `${ctx.repoPath}-worktree-long-reason`;
      const worktree = ctx.repo.addWorktree("long-reason", worktreePath);

      const longReason = "A".repeat(1000);
      worktree.lock(longReason);

      const lockInfo = worktree.isLocked();
      assertEquals(lockInfo.locked, true);
      assertEquals(lockInfo.reason, longReason);

      worktree.unlock();
      worktree.free();
      await Deno.remove(worktreePath, { recursive: true });
    });
});
