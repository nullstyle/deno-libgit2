/**
 * End-to-end tests for graph functionality (graph.ts)
 *
 * These tests validate graph traversal operations including ahead/behind
 * calculations and descendant relationship checking using real git repositories.
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertThrows,
} from "@std/assert";
import { init, Repository, shutdown } from "../../mod.ts";
import {
  createCommitWithFiles,
  createFile,
  createTestContext,
} from "./helpers.ts";
import {
  aheadBehind,
  type AheadBehindResult,
  isDescendantOf,
} from "../../src/graph.ts";
import { getLibrary } from "../../src/library.ts";

Deno.test({
  name: "E2E Graph Tests",
  async fn(t) {
    await init();

    try {
      // AheadBehindResult type tests
      await t.step("AheadBehindResult has correct structure", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Commit 1", {
          "file.txt": "content\n",
        });
        const headOid = ctx.repo.headOid()!;

        const result = ctx.repo.aheadBehind(headOid, headOid);
        assertExists(result);
        assertEquals(typeof result.ahead, "number");
        assertEquals(typeof result.behind, "number");
      });

      // aheadBehind tests
      await t.step("ahead_behind with same commit returns 0, 0", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Commit 1", {
          "file.txt": "content\n",
        });
        const headOid = ctx.repo.headOid()!;

        const result = ctx.repo.aheadBehind(headOid, headOid);
        assertEquals(result.ahead, 0, "Same commit should have 0 ahead");
        assertEquals(result.behind, 0, "Same commit should have 0 behind");
      });

      await t.step("ahead_behind with linear history (2 commits)", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Commit 1", {
          "file1.txt": "content1\n",
        });
        const commit1 = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Commit 2", {
          "file2.txt": "content2\n",
        });
        const commit2 = ctx.repo.headOid()!;

        // commit2 is 1 ahead of commit1
        const result1 = ctx.repo.aheadBehind(commit2, commit1);
        assertEquals(result1.ahead, 1);
        assertEquals(result1.behind, 0);

        // commit1 is 1 behind commit2
        const result2 = ctx.repo.aheadBehind(commit1, commit2);
        assertEquals(result2.ahead, 0);
        assertEquals(result2.behind, 1);
      });

      await t.step("ahead_behind with linear history (3 commits)", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Commit 1", {
          "file1.txt": "content1\n",
        });
        const commit1 = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Commit 2", {
          "file2.txt": "content2\n",
        });
        const commit2 = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Commit 3", {
          "file3.txt": "content3\n",
        });
        const commit3 = ctx.repo.headOid()!;

        // commit3 is 2 ahead of commit1
        const result1 = ctx.repo.aheadBehind(commit3, commit1);
        assertEquals(result1.ahead, 2);
        assertEquals(result1.behind, 0);

        // commit1 is 2 behind commit3
        const result2 = ctx.repo.aheadBehind(commit1, commit3);
        assertEquals(result2.ahead, 0);
        assertEquals(result2.behind, 2);

        // commit2 is 1 ahead of commit1
        const result3 = ctx.repo.aheadBehind(commit2, commit1);
        assertEquals(result3.ahead, 1);
        assertEquals(result3.behind, 0);

        // commit2 is 1 behind commit3
        const result4 = ctx.repo.aheadBehind(commit2, commit3);
        assertEquals(result4.ahead, 0);
        assertEquals(result4.behind, 1);
      });

      await t.step("ahead_behind with many commits", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Base", { "base.txt": "base\n" });
        const baseOid = ctx.repo.headOid()!;

        // Create 10 more commits
        for (let i = 1; i <= 10; i++) {
          await createCommitWithFiles(ctx, `Commit ${i}`, {
            [`file${i}.txt`]: `content${i}\n`,
          });
        }
        const headOid = ctx.repo.headOid()!;

        const result = ctx.repo.aheadBehind(headOid, baseOid);
        assertEquals(result.ahead, 10);
        assertEquals(result.behind, 0);

        const reverseResult = ctx.repo.aheadBehind(baseOid, headOid);
        assertEquals(reverseResult.ahead, 0);
        assertEquals(reverseResult.behind, 10);
      });

      await t.step(
        "ahead_behind useful for branch comparison",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          // Simulate a typical workflow: main branch and feature branch
          await createCommitWithFiles(ctx, "Main commit 1", {
            "main1.txt": "main1\n",
          });
          const mainOid = ctx.repo.headOid()!;

          // Create feature branch commits
          await createCommitWithFiles(ctx, "Feature commit 1", {
            "feature1.txt": "f1\n",
          });
          await createCommitWithFiles(ctx, "Feature commit 2", {
            "feature2.txt": "f2\n",
          });
          await createCommitWithFiles(ctx, "Feature commit 3", {
            "feature3.txt": "f3\n",
          });
          const featureOid = ctx.repo.headOid()!;

          // Feature branch is 3 commits ahead of main
          const result = ctx.repo.aheadBehind(featureOid, mainOid);
          assertEquals(result.ahead, 3);
          assertEquals(result.behind, 0);
        },
      );

      // Direct function call tests
      await t.step("aheadBehind function direct call", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Commit 1", {
          "file1.txt": "content1\n",
        });
        const commit1 = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Commit 2", {
          "file2.txt": "content2\n",
        });
        const commit2 = ctx.repo.headOid()!;

        const lib = getLibrary();
        const result = aheadBehind(lib, ctx.repo.pointer, commit2, commit1);

        assertEquals(result.ahead, 1);
        assertEquals(result.behind, 0);
      });

      // isDescendantOf tests
      await t.step("descendant_of with direct parent", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Parent commit", {
          "file1.txt": "content1\n",
        });
        const parentOid = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Child commit", {
          "file2.txt": "content2\n",
        });
        const childOid = ctx.repo.headOid()!;

        // Child is descendant of parent
        const isDescendant = ctx.repo.isDescendantOf(childOid, parentOid);
        assert(isDescendant, "Child should be descendant of parent");

        // Parent is NOT descendant of child
        const isNotDescendant = ctx.repo.isDescendantOf(parentOid, childOid);
        assertFalse(
          isNotDescendant,
          "Parent should not be descendant of child",
        );
      });

      await t.step("descendant_of with grandparent", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Grandparent", {
          "file1.txt": "content1\n",
        });
        const grandparentOid = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Parent", {
          "file2.txt": "content2\n",
        });

        await createCommitWithFiles(ctx, "Grandchild", {
          "file3.txt": "content3\n",
        });
        const grandchildOid = ctx.repo.headOid()!;

        // Grandchild is descendant of grandparent
        const isDescendant = ctx.repo.isDescendantOf(
          grandchildOid,
          grandparentOid,
        );
        assert(isDescendant, "Grandchild should be descendant of grandparent");
      });

      await t.step("descendant_of with same commit returns false", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Commit", { "file.txt": "content\n" });
        const commitOid = ctx.repo.headOid()!;

        // A commit is NOT considered a descendant of itself
        const isDescendant = ctx.repo.isDescendantOf(commitOid, commitOid);
        assertFalse(
          isDescendant,
          "A commit should not be descendant of itself",
        );
      });

      await t.step("descendant_of with deep ancestry", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Ancestor", {
          "file0.txt": "content0\n",
        });
        const ancestorOid = ctx.repo.headOid()!;

        // Create 10 generations
        for (let i = 1; i <= 10; i++) {
          await createCommitWithFiles(ctx, `Generation ${i}`, {
            [`file${i}.txt`]: `content${i}\n`,
          });
        }
        const descendantOid = ctx.repo.headOid()!;

        const isDescendant = ctx.repo.isDescendantOf(
          descendantOid,
          ancestorOid,
        );
        assert(isDescendant, "Should be descendant through 10 generations");
      });

      // Direct function call test
      await t.step("isDescendantOf function direct call", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Parent", {
          "file1.txt": "content1\n",
        });
        const parentOid = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Child", {
          "file2.txt": "content2\n",
        });
        const childOid = ctx.repo.headOid()!;

        const lib = getLibrary();
        const result = isDescendantOf(
          lib,
          ctx.repo.pointer,
          childOid,
          parentOid,
        );
        assert(result);
      });

      await t.step(
        "isDescendantOf returns false for unrelated branches",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          // Create base commit
          await createCommitWithFiles(ctx, "Base", { "base.txt": "base\n" });
          const baseOid = ctx.repo.headOid()!;

          // Create branch A commit
          await createCommitWithFiles(ctx, "Branch A", { "a.txt": "a\n" });
          const branchAOid = ctx.repo.headOid()!;

          // Go back to base and create branch B (requires git CLI)
          let gitAvailable = true;
          try {
            const cmd = new Deno.Command("git", {
              args: ["--version"],
              stdout: "null",
              stderr: "null",
            });
            const result = await cmd.output();
            gitAvailable = result.success;
          } catch {
            gitAvailable = false;
          }

          if (gitAvailable) {
            ctx.repo.close();
            const cmd = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await cmd.output();

            ctx.repo = Repository.open(ctx.repoPath);
            await createCommitWithFiles(ctx, "Branch B", { "b.txt": "b\n" });
            const branchBOid = ctx.repo.headOid()!;

            // Neither branch is descendant of the other
            const aDescOfB = ctx.repo.isDescendantOf(branchAOid, branchBOid);
            assertFalse(
              aDescOfB,
              "Branch A should not be descendant of Branch B",
            );

            const bDescOfA = ctx.repo.isDescendantOf(branchBOid, branchAOid);
            assertFalse(
              bDescOfA,
              "Branch B should not be descendant of Branch A",
            );

            // Both are descendants of base
            const aDescOfBase = ctx.repo.isDescendantOf(branchAOid, baseOid);
            assert(aDescOfBase, "Branch A should be descendant of base");

            const bDescOfBase = ctx.repo.isDescendantOf(branchBOid, baseOid);
            assert(bDescOfBase, "Branch B should be descendant of base");
          }
        },
      );

      await t.step(
        "ahead_behind with diverged branches",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          // Create base commit
          await createCommitWithFiles(ctx, "Base commit", {
            "base.txt": "base\n",
          });
          const baseOid = ctx.repo.headOid()!;

          // Create branch A commits
          await createCommitWithFiles(ctx, "Branch A commit 1", {
            "a1.txt": "a1\n",
          });
          await createCommitWithFiles(ctx, "Branch A commit 2", {
            "a2.txt": "a2\n",
          });
          const branchAOid = ctx.repo.headOid()!;

          // Check if git is available
          let gitAvailable = true;
          try {
            const cmd = new Deno.Command("git", {
              args: ["--version"],
              stdout: "null",
              stderr: "null",
            });
            const result = await cmd.output();
            gitAvailable = result.success;
          } catch {
            gitAvailable = false;
          }

          if (gitAvailable) {
            // Go back to base and create branch B
            ctx.repo.close();
            const cmd1 = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await cmd1.output();

            ctx.repo = Repository.open(ctx.repoPath);
            await createCommitWithFiles(ctx, "Branch B commit 1", {
              "b1.txt": "b1\n",
            });
            const branchBOid = ctx.repo.headOid()!;

            // Branch A is 2 ahead and 1 behind Branch B
            const result = ctx.repo.aheadBehind(branchAOid, branchBOid);
            assertEquals(
              result.ahead,
              2,
              "Branch A should be 2 ahead of Branch B",
            );
            assertEquals(
              result.behind,
              1,
              "Branch A should be 1 behind Branch B",
            );

            // Reverse: Branch B is 1 ahead and 2 behind Branch A
            const reverseResult = ctx.repo.aheadBehind(branchBOid, branchAOid);
            assertEquals(reverseResult.ahead, 1);
            assertEquals(reverseResult.behind, 2);
          }
        },
      );

      // Symmetry tests
      await t.step("aheadBehind is symmetric", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Commit 1", {
          "file1.txt": "content1\n",
        });
        const commit1 = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Commit 2", {
          "file2.txt": "content2\n",
        });
        const commit2 = ctx.repo.headOid()!;

        const result1 = ctx.repo.aheadBehind(commit2, commit1);
        const result2 = ctx.repo.aheadBehind(commit1, commit2);

        // ahead/behind should be swapped
        assertEquals(result1.ahead, result2.behind);
        assertEquals(result1.behind, result2.ahead);
      });

      await t.step("isDescendantOf is not symmetric", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        await createCommitWithFiles(ctx, "Parent", {
          "file1.txt": "content1\n",
        });
        const parentOid = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Child", {
          "file2.txt": "content2\n",
        });
        const childOid = ctx.repo.headOid()!;

        const childOfParent = ctx.repo.isDescendantOf(childOid, parentOid);
        const parentOfChild = ctx.repo.isDescendantOf(parentOid, childOid);

        // One should be true, the other false
        assert(childOfParent !== parentOfChild);
        assert(childOfParent === true);
        assert(parentOfChild === false);
      });

      // Initial commit edge cases
      await t.step("aheadBehind with initial commits", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        // Initial commit from test context
        const initialOid = ctx.repo.headOid()!;

        // Create another commit
        await createCommitWithFiles(ctx, "Second", { "file.txt": "content\n" });
        const secondOid = ctx.repo.headOid()!;

        const result = ctx.repo.aheadBehind(secondOid, initialOid);
        assertEquals(result.ahead, 1);
        assertEquals(result.behind, 0);
      });

      await t.step(
        "isDescendantOf with initial commit as ancestor",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          const initialOid = ctx.repo.headOid()!;

          await createCommitWithFiles(ctx, "Second", {
            "file.txt": "content\n",
          });
          await createCommitWithFiles(ctx, "Third", {
            "file2.txt": "content\n",
          });
          const thirdOid = ctx.repo.headOid()!;

          const isDescendant = ctx.repo.isDescendantOf(thirdOid, initialOid);
          assert(
            isDescendant,
            "All commits should be descendants of initial commit",
          );
        },
      );

      // Combined usage test
      await t.step(
        "aheadBehind and isDescendantOf are consistent",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          await createCommitWithFiles(ctx, "Commit 1", {
            "file1.txt": "content1\n",
          });
          const commit1 = ctx.repo.headOid()!;

          await createCommitWithFiles(ctx, "Commit 2", {
            "file2.txt": "content2\n",
          });
          const commit2 = ctx.repo.headOid()!;

          const ab = ctx.repo.aheadBehind(commit2, commit1);
          const isDesc = ctx.repo.isDescendantOf(commit2, commit1);

          // If ahead > 0 and behind == 0, then should be a descendant
          if (ab.ahead > 0 && ab.behind === 0) {
            assert(isDesc, "Should be descendant when only ahead");
          }
        },
      );

      // Error handling tests
      await t.step(
        "isDescendantOf throws error for non-existent OID",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          const headOid = ctx.repo.headOid()!;
          // Use a valid-format but non-existent OID
          const nonExistentOid = "0000000000000000000000000000000000000000";

          // Should throw when checking against a non-existent commit
          assertThrows(
            () => ctx.repo.isDescendantOf(nonExistentOid, headOid),
            Error,
          );

          // Should also throw when ancestor doesn't exist
          assertThrows(
            () => ctx.repo.isDescendantOf(headOid, nonExistentOid),
            Error,
          );
        },
      );

      await t.step(
        "isDescendantOf direct function call throws error for non-existent OID",
        async () => {
          await using ctx = await createTestContext({
            withInitialCommit: true,
          });

          const lib = getLibrary();
          const headOid = ctx.repo.headOid()!;
          const nonExistentOid = "1111111111111111111111111111111111111111";

          assertThrows(
            () =>
              isDescendantOf(
                lib,
                ctx.repo.pointer,
                nonExistentOid,
                headOid,
              ),
            Error,
          );
        },
      );
    } finally {
      shutdown();
    }
  },
});
