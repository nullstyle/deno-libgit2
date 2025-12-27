/**
 * End-to-end tests for Branch and Reference operations
 *
 * These tests validate branch creation, listing, and reference handling
 * using real git repositories in temporary directories.
 */

import {
  createCommitWithFiles,
  setupLibrary,
  teardownLibrary,
  withTestContext,
} from "./helpers.ts";
import { assertEquals, assertExists } from "@std/assert";

Deno.test({
  name: "E2E Branch Tests",
  async fn(t) {
    await setupLibrary();

    await t.step("New repository has no branches", async () => {
      await withTestContext({}, (ctx) => {
        const branches = ctx.repo.listBranches();
        assertEquals(
          branches.length,
          0,
          "New repository should have no branches",
        );
      });
    });

    await t.step("Repository with commit has a branch", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        const branches = ctx.repo.listBranches();
        assertEquals(branches.length, 1, "Should have one branch");
      });
    });

    await t.step("Create and list multiple branches", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        // Get HEAD commit for branch creation
        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        // Create additional branches
        ctx.repo.createBranch("feature-1", headOid);
        ctx.repo.createBranch("feature-2", headOid);
        ctx.repo.createBranch("bugfix", headOid);

        const branches = ctx.repo.listBranches();
        assertEquals(branches.length, 4, "Should have 4 branches");
      });
    });

    await t.step("Delete a branch", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        // Create and then delete a branch
        ctx.repo.createBranch("to-delete", headOid);

        let branches = ctx.repo.listBranches();
        const initialCount = branches.length;

        ctx.repo.deleteBranch("to-delete");

        branches = ctx.repo.listBranches();
        assertEquals(
          branches.length,
          initialCount - 1,
          "Branch should be deleted",
        );
      });
    });

    await t.step("List references includes branches", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        const refs = ctx.repo.listReferences();
        assertEquals(
          refs.length >= 1,
          true,
          "Should have at least one reference",
        );
      });
    });

    await t.step("Resolve reference returns reference info", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        const head = ctx.repo.head();
        const refInfo = ctx.repo.resolveReference(head.name);
        assertExists(refInfo);
        assertExists(refInfo.target);
        assertEquals(refInfo.target.length, 40, "OID should be 40 characters");
      });
    });

    await t.step("HEAD points to a branch", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        const head = ctx.repo.head();
        assertExists(head);
        assertEquals(
          head.name.includes("refs/heads/"),
          true,
          "HEAD should point to a branch",
        );
      });
    });

    await t.step("Branches point to correct commits", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create a commit
        const mainCommit = await createCommitWithFiles(ctx, "Main commit", {
          "main.txt": "main content",
        });

        // Create a branch at this commit
        ctx.repo.createBranch("feature", mainCommit);

        // Create another commit (advances HEAD)
        await createCommitWithFiles(ctx, "Another main commit", {
          "main2.txt": "more main content",
        });

        // Verify branches point to different commits
        const head = ctx.repo.head();
        const mainRef = ctx.repo.resolveReference(head.name);
        const featureRef = ctx.repo.resolveReference("refs/heads/feature");

        assertExists(mainRef.target);
        assertExists(featureRef.target);
        assertEquals(
          mainRef.target !== featureRef.target,
          true,
          "Branches should point to different commits",
        );
        assertEquals(
          featureRef.target,
          mainCommit,
          "Feature branch should point to original commit",
        );
      });
    });

    await t.step(
      "isHeadDetached returns false for branch checkout",
      async () => {
        await withTestContext({ withInitialCommit: true }, (ctx) => {
          assertEquals(ctx.repo.isHeadDetached, false);
        });
      },
    );

    await t.step("Multiple branches can point to same commit", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        // Create multiple branches at the same commit
        ctx.repo.createBranch("branch-a", headOid);
        ctx.repo.createBranch("branch-b", headOid);
        ctx.repo.createBranch("branch-c", headOid);

        // All should point to the same commit
        const refA = ctx.repo.resolveReference("refs/heads/branch-a");
        const refB = ctx.repo.resolveReference("refs/heads/branch-b");
        const refC = ctx.repo.resolveReference("refs/heads/branch-c");

        assertEquals(refA.target, headOid);
        assertEquals(refB.target, headOid);
        assertEquals(refC.target, headOid);
      });
    });

    teardownLibrary();
  },
});
