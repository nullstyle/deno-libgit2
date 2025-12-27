/**
 * End-to-end tests for graph functionality
 * Tests use real file operations in temporary directories
 */

import {
  assert,
  assertEquals,
  assertFalse,
} from "@std/assert";
import {
  init,
  shutdown,
  Repository,
} from "../../mod.ts";
import {
  createTestContext,
  
  createCommitWithFiles,
} from "./helpers.ts";

Deno.test("E2E Graph Tests", async (t) => {
  await init();

  try {
    await t.step("ahead_behind with same commit returns 0, 0", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Commit 1", { "file.txt": "content\n" });
        const headOid = ctx.repo.headOid()!;

        const result = ctx.repo.aheadBehind(headOid, headOid);
        assertEquals(result.ahead, 0, "Same commit should have 0 ahead");
        assertEquals(result.behind, 0, "Same commit should have 0 behind");
      
    });

    await t.step("ahead_behind with linear history", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create first commit
        await createCommitWithFiles(ctx, "Commit 1", { "file1.txt": "content1\n" });
        const commit1 = ctx.repo.headOid()!;

        // Create second commit
        await createCommitWithFiles(ctx, "Commit 2", { "file2.txt": "content2\n" });
        const commit2 = ctx.repo.headOid()!;

        // Create third commit
        await createCommitWithFiles(ctx, "Commit 3", { "file3.txt": "content3\n" });
        const commit3 = ctx.repo.headOid()!;

        // commit3 is 2 ahead of commit1
        const result1 = ctx.repo.aheadBehind(commit3, commit1);
        assertEquals(result1.ahead, 2, "commit3 should be 2 ahead of commit1");
        assertEquals(result1.behind, 0, "commit3 should be 0 behind commit1");

        // commit1 is 2 behind commit3
        const result2 = ctx.repo.aheadBehind(commit1, commit3);
        assertEquals(result2.ahead, 0, "commit1 should be 0 ahead of commit3");
        assertEquals(result2.behind, 2, "commit1 should be 2 behind commit3");

        // commit2 is 1 ahead of commit1 and 1 behind commit3
        const result3 = ctx.repo.aheadBehind(commit2, commit1);
        assertEquals(result3.ahead, 1, "commit2 should be 1 ahead of commit1");
        assertEquals(result3.behind, 0, "commit2 should be 0 behind commit1");
      
    });

    await t.step("ahead_behind with diverged branches", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create base commit
        await createCommitWithFiles(ctx, "Base commit", { "base.txt": "base\n" });
        const baseOid = ctx.repo.headOid()!;

        // Create branch A commits
        await createCommitWithFiles(ctx, "Branch A commit 1", { "a1.txt": "a1\n" });
        await createCommitWithFiles(ctx, "Branch A commit 2", { "a2.txt": "a2\n" });
        const branchAOid = ctx.repo.headOid()!;

        // Go back to base and create branch B
        ctx.repo.close();
        const cmd1 = new Deno.Command("git", {
          args: ["checkout", baseOid],
          cwd: ctx.repoPath,
        });
        await cmd1.output();

        ctx.repo = Repository.open(ctx.repoPath);
        await createCommitWithFiles(ctx, "Branch B commit 1", { "b1.txt": "b1\n" });
        const branchBOid = ctx.repo.headOid()!;

        // Branch A is 2 ahead and 1 behind Branch B
        const result = ctx.repo.aheadBehind(branchAOid, branchBOid);
        assertEquals(result.ahead, 2, "Branch A should be 2 ahead of Branch B");
        assertEquals(result.behind, 1, "Branch A should be 1 behind Branch B");
      
    });

    await t.step("descendant_of with direct parent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create first commit
        await createCommitWithFiles(ctx, "Parent commit", { "file1.txt": "content1\n" });
        const parentOid = ctx.repo.headOid()!;

        // Create child commit
        await createCommitWithFiles(ctx, "Child commit", { "file2.txt": "content2\n" });
        const childOid = ctx.repo.headOid()!;

        // Child is descendant of parent
        const isDescendant = ctx.repo.isDescendantOf(childOid, parentOid);
        assert(isDescendant, "Child should be descendant of parent");

        // Parent is NOT descendant of child
        const isNotDescendant = ctx.repo.isDescendantOf(parentOid, childOid);
        assertFalse(isNotDescendant, "Parent should not be descendant of child");
      
    });

    await t.step("descendant_of with grandparent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create grandparent commit
        await createCommitWithFiles(ctx, "Grandparent", { "file1.txt": "content1\n" });
        const grandparentOid = ctx.repo.headOid()!;

        // Create parent commit
        await createCommitWithFiles(ctx, "Parent", { "file2.txt": "content2\n" });

        // Create grandchild commit
        await createCommitWithFiles(ctx, "Grandchild", { "file3.txt": "content3\n" });
        const grandchildOid = ctx.repo.headOid()!;

        // Grandchild is descendant of grandparent
        const isDescendant = ctx.repo.isDescendantOf(grandchildOid, grandparentOid);
        assert(isDescendant, "Grandchild should be descendant of grandparent");
      
    });

    await t.step("descendant_of with same commit returns false", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Commit", { "file.txt": "content\n" });
        const commitOid = ctx.repo.headOid()!;

        // A commit is NOT considered a descendant of itself
        const isDescendant = ctx.repo.isDescendantOf(commitOid, commitOid);
        assertFalse(isDescendant, "A commit should not be descendant of itself");
      
    });

    await t.step("descendant_of with unrelated commits", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create base commit
        await createCommitWithFiles(ctx, "Base", { "base.txt": "base\n" });
        const baseOid = ctx.repo.headOid()!;

        // Create branch A commit
        await createCommitWithFiles(ctx, "Branch A", { "a.txt": "a\n" });
        const branchAOid = ctx.repo.headOid()!;

        // Go back to base and create branch B
        ctx.repo.close();
        const cmd = new Deno.Command("git", {
          args: ["checkout", baseOid],
          cwd: ctx.repoPath,
        });
        await cmd.output();

        ctx.repo = Repository.open(ctx.repoPath);
        await createCommitWithFiles(ctx, "Branch B", { "b.txt": "b\n" });
        const branchBOid = ctx.repo.headOid()!;

        // Neither branch is descendant of the other
        const aDescOfB = ctx.repo.isDescendantOf(branchAOid, branchBOid);
        assertFalse(aDescOfB, "Branch A should not be descendant of Branch B");

        const bDescOfA = ctx.repo.isDescendantOf(branchBOid, branchAOid);
        assertFalse(bDescOfA, "Branch B should not be descendant of Branch A");

        // Both are descendants of base
        const aDescOfBase = ctx.repo.isDescendantOf(branchAOid, baseOid);
        assert(aDescOfBase, "Branch A should be descendant of base");

        const bDescOfBase = ctx.repo.isDescendantOf(branchBOid, baseOid);
        assert(bDescOfBase, "Branch B should be descendant of base");
      
    });

    await t.step("ahead_behind useful for branch comparison", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Simulate a typical workflow: main branch and feature branch
        await createCommitWithFiles(ctx, "Main commit 1", { "main1.txt": "main1\n" });
        const mainOid = ctx.repo.headOid()!;

        // Create feature branch commits
        await createCommitWithFiles(ctx, "Feature commit 1", { "feature1.txt": "f1\n" });
        await createCommitWithFiles(ctx, "Feature commit 2", { "feature2.txt": "f2\n" });
        await createCommitWithFiles(ctx, "Feature commit 3", { "feature3.txt": "f3\n" });
        const featureOid = ctx.repo.headOid()!;

        // Feature branch is 3 commits ahead of main
        const result = ctx.repo.aheadBehind(featureOid, mainOid);
        assertEquals(result.ahead, 3, "Feature should be 3 ahead of main");
        assertEquals(result.behind, 0, "Feature should be 0 behind main (no new commits on main)");
      
    });
  } finally {
    shutdown();
  }
});
