/**
 * End-to-end tests for stash functionality
 * Tests use real file operations in temporary directories
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  Repository,
  StashApplyFlags,
  StashFlags,
} from "../../mod.ts";
import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

Deno.test("E2E Stash Tests", async (t) => {
  using _git = await setupLibrary();

  await t.step("stash save creates a stash entry", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      // Create initial commit
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Modify the file (uncommitted change)
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "modified\n");

      // Stash the changes
      const stashOid = ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "WIP: test stash",
      });

      assertExists(stashOid, "Stash should return an OID");
      assertEquals(stashOid.length, 40, "OID should be 40 characters");

      // Working directory should be clean now
      const content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
      assertEquals(
        content,
        "initial\n",
        "File should be restored to original",
      );
    });

    await t.step("stash save with KEEP_INDEX flag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Stage a change
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "staged\n");
      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["add", "file.txt"],
        cwd: ctx.repoPath,
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Stash with KEEP_INDEX
      const stashOid = ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "WIP with keep index",
        flags: StashFlags.KEEP_INDEX,
      });

      assertExists(stashOid);

      // Staged changes should still be in working directory
      const content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
      assertEquals(content, "staged\n", "Staged changes should be kept");
    });

    await t.step("stash save with INCLUDE_UNTRACKED flag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Create an untracked file
      await Deno.writeTextFile(
        `${ctx.repoPath}/untracked.txt`,
        "untracked\n",
      );

      // Stash with INCLUDE_UNTRACKED
      const stashOid = ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "WIP with untracked",
        flags: StashFlags.INCLUDE_UNTRACKED,
      });

      assertExists(stashOid);

      // Untracked file should be removed
      let exists = true;
      try {
        await Deno.stat(`${ctx.repoPath}/untracked.txt`);
      } catch {
        exists = false;
      }
      assertEquals(exists, false, "Untracked file should be removed");
    });

    await t.step("list stashes returns all stashed states", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Create first stash
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "change1\n");
      ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "First stash",
      });

      // Create second stash
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "change2\n");
      ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "Second stash",
      });

      // List stashes
      const stashes = ctx.repo.listStashes();
      assertEquals(stashes.length, 2, "Should have 2 stashes");
      assertEquals(
        stashes[0].message,
        "On master: Second stash",
        "Most recent stash first",
      );
      assertEquals(
        stashes[1].message,
        "On master: First stash",
        "Older stash second",
      );
    });

    await t.step({
      name: "stash apply restores changes",
      fn: async () => {
        await using ctx = await createTestContext({ withInitialCommit: false });
        // Create initial commit with file.txt
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "initial\n",
        });

        // Create and stash changes
        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "stashed\n");
        ctx.repo.stashSave({
          stasher: { name: "Test User", email: "test@example.com" },
          message: "Test stash",
        });

        // Verify file is restored to original
        let content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(content, "initial\n");

        // Apply the stash
        ctx.repo.stashApply(0);

        // Verify changes are restored
        content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(
          content,
          "stashed\n",
          "Stashed changes should be restored",
        );

        // Stash should still exist after apply
        const stashes = ctx.repo.listStashes();
        assertEquals(
          stashes.length,
          1,
          "Stash should still exist after apply",
        );
      },
    });

    await t.step({
      name: "stash pop applies and removes stash",
      fn: async () => {
        await using ctx = await createTestContext({ withInitialCommit: false });
        // Create initial commit with file.txt
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "initial\n",
        });

        // Create and stash changes
        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "stashed\n");
        ctx.repo.stashSave({
          stasher: { name: "Test User", email: "test@example.com" },
          message: "Test stash",
        });

        // Pop the stash
        ctx.repo.stashPop(0);

        // Verify changes are restored
        const content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(
          content,
          "stashed\n",
          "Stashed changes should be restored",
        );

        // Stash should be removed after pop
        const stashes = ctx.repo.listStashes();
        assertEquals(stashes.length, 0, "Stash should be removed after pop");
      },
    });

    await t.step("stash drop removes stash without applying", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Create stash
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "stashed\n");
      ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "Test stash",
      });

      // Drop the stash
      ctx.repo.stashDrop(0);

      // Verify file is still at original state
      const content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
      assertEquals(
        content,
        "initial\n",
        "File should remain at original state",
      );

      // Stash should be removed
      const stashes = ctx.repo.listStashes();
      assertEquals(stashes.length, 0, "Stash should be removed");
    });

    await t.step("stash apply with REINSTATE_INDEX flag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Stage a change
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "staged\n");
      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["add", "file.txt"],
        cwd: ctx.repoPath,
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Stash
      ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "Staged stash",
      });

      // Apply with REINSTATE_INDEX
      ctx.repo.stashApply(0, { flags: StashApplyFlags.REINSTATE_INDEX });

      // Verify changes are restored
      const content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
      assertEquals(content, "staged\n", "Staged changes should be restored");
    });

    await t.step("stash with nothing to stash returns null", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "initial\n",
      });

      // Try to stash with no changes
      const stashOid = ctx.repo.stashSave({
        stasher: { name: "Test User", email: "test@example.com" },
        message: "Empty stash",
      });

      assertEquals(
        stashOid,
        null,
        "Should return null when nothing to stash",
      );
    });

    await t.step({
      name: "multiple stashes can be managed independently",
      fn: async () => {
        await using ctx = await createTestContext({ withInitialCommit: false });
        // Create initial commit with file.txt
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "initial\n",
        });

        // Create three stashes
        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "change1\n");
        ctx.repo.stashSave({
          stasher: { name: "Test User", email: "test@example.com" },
          message: "Stash 1",
        });

        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "change2\n");
        ctx.repo.stashSave({
          stasher: { name: "Test User", email: "test@example.com" },
          message: "Stash 2",
        });

        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "change3\n");
        ctx.repo.stashSave({
          stasher: { name: "Test User", email: "test@example.com" },
          message: "Stash 3",
        });

        // Drop the middle stash (index 1)
        ctx.repo.stashDrop(1);

        // Should have 2 stashes left
        const stashes = ctx.repo.listStashes();
        assertEquals(stashes.length, 2);

        // Apply the oldest stash (now at index 1)
        ctx.repo.stashApply(1);
        let content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(content, "change1\n", "Should apply oldest stash");

        // Reset file to initial state using git checkout
        ctx.repo.close();
        const proc = new Deno.Command("git", {
          args: ["checkout", "--", "file.txt"],
          cwd: ctx.repoPath,
        });
        await proc.output();
        ctx.repo = Repository.open(ctx.repoPath);

        // Apply newest stash
        ctx.repo.stashApply(0);
        content = await Deno.readTextFile(`${ctx.repoPath}/file.txt`);
        assertEquals(content, "change3\n", "Should apply newest stash");
      },
    });
});
