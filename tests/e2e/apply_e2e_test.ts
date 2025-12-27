/**
 * End-to-end tests for apply functionality
 * Tests use real file operations in temporary directories
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { ApplyLocation, Index } from "../../mod.ts";
import {
  createCommitWithFiles,
  createTestContext,
  readFile,
  setupLibrary,
} from "./helpers.ts";

Deno.test("E2E Apply Tests", async (t) => {
  using _git = await setupLibrary();
  await t.step("apply diff to workdir", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

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

    // Reset workdir to first commit state
    await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "initial\n");

    // Get diff between first and second commit
    using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
    assertExists(diff, "Should return a diff");

    // Apply diff to workdir
    ctx.repo.apply(diff, ApplyLocation.WORKDIR);

    // Check that file was modified
    const content = await readFile(`${ctx.repoPath}/file.txt`);
    assertEquals(content, "modified\n", "File should be modified");
  });

  await t.step({
    name: "apply diff to index",
    fn: async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

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

      // Reset workdir and index to first commit state
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "initial\n");
      using index = Index.fromRepository(ctx.repo);
      index.add("file.txt");
      index.write();

      // Get diff between first and second commit
      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff, "Should return a diff");

      // Apply diff to index
      ctx.repo.apply(diff, ApplyLocation.INDEX);
    },
  });

  await t.step({
    name: "apply diff to both workdir and index",
    fn: async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

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

      // Reset workdir and index to first commit state
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "initial\n");
      using index = Index.fromRepository(ctx.repo);
      index.add("file.txt");
      index.write();

      // Get diff between first and second commit
      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff, "Should return a diff");

      // Apply diff to both workdir and index
      ctx.repo.apply(diff, ApplyLocation.BOTH);

      // Check that file still has modified content
      const content = await readFile(`${ctx.repoPath}/file.txt`);
      assertEquals(content, "modified\n", "File should be modified");
    },
  });

  await t.step("apply diff to tree (returns index)", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

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

    // Get diff between first and second commit
    using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
    assertExists(diff, "Should return a diff");

    // Apply diff to tree (first commit's tree)
    using index = ctx.repo.applyToTree(firstOid, diff);
    assertExists(index, "Should return an index");

    // Index should have the modified file
    const entryCount = index.entryCount;
    assert(entryCount > 0, "Index should have entries");
  });

  await t.step("apply diff with added file", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

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

    // Remove the new file from workdir
    try {
      await Deno.remove(`${ctx.repoPath}/new.txt`);
    } catch {
      // File might not exist
    }

    // Get diff between first and second commit
    using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
    assertExists(diff, "Should return a diff");

    // Apply diff to workdir
    ctx.repo.apply(diff, ApplyLocation.WORKDIR);

    // Check that new file was created
    const content = await readFile(`${ctx.repoPath}/new.txt`);
    assertEquals(content, "new content\n", "New file should be created");
  });
});
