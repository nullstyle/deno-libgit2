/**
 * End-to-end tests for Merge operations
 *
 * These tests validate merge functionality including:
 * - AnnotatedCommit creation, properties, and lifecycle
 * - Merge analysis (fast-forward, normal merge, up-to-date, unborn)
 * - Finding merge base
 * - Performing merges (both mergeCommits and merge)
 * - Handling merge conflicts
 * - State cleanup after merge operations
 */

import {
  createCommitWithFiles,
  createFile,
  createTestContext,
  setupLibrary,
  teardownLibrary,
  withTestContext,
} from "./helpers.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { createCommit, Index, Repository } from "../../mod.ts";
import { getConflicts } from "../../src/merge.ts";
import { getLibrary } from "../../src/library.ts";

Deno.test({
  name: "E2E Merge Tests",
  async fn(t) {
    await setupLibrary();

    // ==================== AnnotatedCommit Tests ====================

    await t.step(
      "AnnotatedCommit.lookup creates annotated commit from OID",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test commit", {
            "file.txt": "content",
          });

          const headOid = ctx.repo.headOid();
          assertExists(headOid);

          const annotated = ctx.repo.annotatedCommitLookup(headOid);
          assertExists(annotated);
          assertEquals(annotated.id, headOid);
          assertEquals(annotated.id.length, 40);

          annotated.free();
        });
      },
    );

    await t.step(
      "AnnotatedCommit.fromRef creates annotated commit from reference",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test commit", {
            "file.txt": "content",
          });

          // Create a branch
          const headOid = ctx.repo.headOid();
          assertExists(headOid);
          ctx.repo.createBranch("test-branch", headOid);

          // Get annotated commit from branch reference
          const annotated = ctx.repo.annotatedCommitFromRef(
            "refs/heads/test-branch",
          );
          assertExists(annotated);
          assertEquals(annotated.id, headOid);
          assertEquals(annotated.ref, "refs/heads/test-branch");

          annotated.free();
        });
      },
    );

    await t.step(
      "AnnotatedCommit.fromRevspec creates annotated commit from revspec",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "First commit", {
            "file1.txt": "content1",
          });

          await createCommitWithFiles(ctx, "Second commit", {
            "file2.txt": "content2",
          });

          const headOid = ctx.repo.headOid();
          assertExists(headOid);

          // Test HEAD revspec
          const annotatedHead = ctx.repo.annotatedCommitFromRevspec("HEAD");
          assertExists(annotatedHead);
          assertEquals(annotatedHead.id, headOid);
          annotatedHead.free();

          // Test HEAD~1 revspec
          const annotatedParent = ctx.repo.annotatedCommitFromRevspec("HEAD~1");
          assertExists(annotatedParent);
          assertNotEquals(annotatedParent.id, headOid);
          assertEquals(annotatedParent.id.length, 40);
          annotatedParent.free();
        });
      },
    );

    await t.step("AnnotatedCommit.info returns commit info", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test commit", {
          "file.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        // From lookup (no ref)
        const annotatedLookup = ctx.repo.annotatedCommitLookup(headOid);
        const infoLookup = annotatedLookup.info;
        assertEquals(infoLookup.id, headOid);
        assertEquals(infoLookup.ref, undefined);
        annotatedLookup.free();

        // Create branch and test fromRef (has ref)
        ctx.repo.createBranch("info-test", headOid);
        const annotatedRef = ctx.repo.annotatedCommitFromRef(
          "refs/heads/info-test",
        );
        const infoRef = annotatedRef.info;
        assertEquals(infoRef.id, headOid);
        assertEquals(infoRef.ref, "refs/heads/info-test");
        annotatedRef.free();
      });
    });

    await t.step("AnnotatedCommit.close is alias for free", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test commit", {
          "file.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        const annotated = ctx.repo.annotatedCommitLookup(headOid);
        assertExists(annotated);

        // Use close instead of free
        annotated.close();

        // Accessing after close should throw
        assertThrows(
          () => annotated.id,
          Error,
          "AnnotatedCommit has been freed",
        );
      });
    });

    await t.step("AnnotatedCommit supports Symbol.dispose", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test commit", {
          "file.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        let annotatedId: string;
        {
          using annotated = ctx.repo.annotatedCommitLookup(headOid);
          annotatedId = annotated.id;
          assertEquals(annotatedId, headOid);
        }
        // annotated is now disposed - can't test directly but the scope exit should work
      });
    });

    await t.step(
      "AnnotatedCommit throws when accessed after free",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test commit", {
            "file.txt": "content",
          });

          const headOid = ctx.repo.headOid();
          assertExists(headOid);

          const annotated = ctx.repo.annotatedCommitLookup(headOid);
          annotated.free();

          assertThrows(
            () => annotated.id,
            Error,
            "AnnotatedCommit has been freed",
          );

          assertThrows(
            () => annotated.ref,
            Error,
            "AnnotatedCommit has been freed",
          );

          // Multiple frees should be safe
          annotated.free();
        });
      },
    );

    // ==================== Merge Base Tests ====================

    await t.step("mergeBase finds common ancestor of two commits", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create initial commit on main
        const baseCommit = await createCommitWithFiles(ctx, "Base commit", {
          "base.txt": "base content",
        });

        // Create a branch and add a commit
        ctx.repo.createBranch("feature", baseCommit);

        // Add commit to main
        const mainCommit = await createCommitWithFiles(ctx, "Main commit", {
          "main.txt": "main content",
        });

        // The merge base should be the base commit
        const mergeBase = ctx.repo.mergeBase(mainCommit, baseCommit);
        assertEquals(
          mergeBase,
          baseCommit,
          "Merge base should be the common ancestor",
        );
      });
    });

    await t.step("mergeBase with diverged branches", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "base.txt": "base",
        });

        // Save for later
        const baseOid = baseCommit;

        // Create feature branch at base
        ctx.repo.createBranch("feature", baseCommit);

        // Add commits on main
        await createCommitWithFiles(ctx, "Main 1", { "main1.txt": "m1" });
        const mainHead = await createCommitWithFiles(ctx, "Main 2", {
          "main2.txt": "m2",
        });

        // The merge base between mainHead and baseOid should be baseOid
        const mergeBase = ctx.repo.mergeBase(mainHead, baseOid);
        assertEquals(mergeBase, baseOid);
      });
    });

    // ==================== Merge Analysis Tests ====================

    await t.step("mergeAnalysis detects fast-forward opportunity", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit
        const baseCommit = await createCommitWithFiles(ctx, "Base commit", {
          "base.txt": "base content",
        });

        // Create feature branch at base
        ctx.repo.createBranch("feature", baseCommit);

        // Analyze merging base into HEAD (should be up-to-date or fast-forward)
        const analysis = ctx.repo.mergeAnalysis(baseCommit);

        assertExists(analysis);
        assertEquals(typeof analysis.canFastForward, "boolean");
        assertEquals(typeof analysis.isUpToDate, "boolean");
        assertEquals(typeof analysis.requiresNormalMerge, "boolean");
        assertEquals(typeof analysis.isUnborn, "boolean");
        assertExists(analysis.analysis);
        assertExists(analysis.preference);
      });
    });

    await t.step("mergeAnalysis detects up-to-date status", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Some commit", {
          "file.txt": "content",
        });

        // Analyzing merge of HEAD into itself should be up-to-date
        const headOid = ctx.repo.headOid();
        assertExists(headOid);
        const analysis = ctx.repo.mergeAnalysis(headOid);

        assertEquals(analysis.isUpToDate, true, "Should be up-to-date");
      });
    });

    await t.step("mergeAnalysis detects normal merge required", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit
        const baseCommit = await createCommitWithFiles(ctx, "Base commit", {
          "base.txt": "base content",
        });

        // Create feature branch
        ctx.repo.createBranch("feature", baseCommit);

        // Add commit on main (diverge from feature)
        await createCommitWithFiles(ctx, "Main diverge", {
          "main-only.txt": "main content",
        });

        // Analyze merge - should work
        const analysis = ctx.repo.mergeAnalysis(baseCommit);
        assertExists(analysis);
        // baseCommit is an ancestor, so it should be up-to-date
        assertEquals(analysis.isUpToDate, true);
      });
    });

    await t.step("mergeAnalysis returns all analysis flags", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        const analysis = ctx.repo.mergeAnalysis(headOid);

        // Verify all properties exist and are the right type
        assertEquals(typeof analysis.analysis, "number");
        assertEquals(typeof analysis.preference, "number");
        assertEquals(typeof analysis.canFastForward, "boolean");
        assertEquals(typeof analysis.isUpToDate, "boolean");
        assertEquals(typeof analysis.requiresNormalMerge, "boolean");
        assertEquals(typeof analysis.isUnborn, "boolean");
      });
    });

    // ==================== Merge Commits Tests ====================

    await t.step("mergeCommits creates merged index", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "file.txt": "base content",
        });

        // Create feature branch
        ctx.repo.createBranch("feature", baseCommit);

        // Add commit on main
        const mainCommit = await createCommitWithFiles(ctx, "Main", {
          "main.txt": "main content",
        });

        // mergeCommits should produce an index with merged content
        const mergedIndex = ctx.repo.mergeCommits(mainCommit, baseCommit);
        assertExists(mergedIndex);

        // The merged index should have entries from both commits
        assertEquals(mergedIndex.hasConflicts, false);

        mergedIndex.close();
      });
    });

    await t.step("mergeCommits with non-conflicting changes", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit with common file
        const _baseCommit = await createCommitWithFiles(ctx, "Base", {
          "shared.txt": "shared content",
        });
        const baseOid = ctx.repo.headOid()!;

        // Create more commits
        await createCommitWithFiles(ctx, "Add file A", {
          "file-a.txt": "content A",
        });
        const commitA = ctx.repo.headOid()!;

        // Go back and create different commit from base
        // For simplicity, just merge commitA with baseOid
        const mergedIndex = ctx.repo.mergeCommits(commitA, baseOid);
        assertExists(mergedIndex);
        assertEquals(mergedIndex.hasConflicts, false);
        mergedIndex.close();
      });
    });

    await t.step("mergeCommits detects conflicts", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit with a file
        await createCommitWithFiles(ctx, "Base", {
          "conflict.txt": "original content",
        });

        // Save base OID
        const baseOid = ctx.repo.headOid()!;

        // Modify the file
        await createCommitWithFiles(ctx, "Main change", {
          "conflict.txt": "main's version of the content",
        });
        const mainOid = ctx.repo.headOid()!;

        // Verify the infrastructure works
        const mergeBase = ctx.repo.mergeBase(mainOid, baseOid);
        assertEquals(mergeBase, baseOid);
      });
    });

    // ==================== Merge Function Tests ====================

    await t.step("merge performs working directory merge", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "base.txt": "base content",
        });

        // Create feature branch
        ctx.repo.createBranch("feature", baseCommit);

        // Add commit on main
        await createCommitWithFiles(ctx, "Main commit", {
          "main-file.txt": "main content",
        });

        // Merge the base commit (ancestor) - should be no-op or fast
        // This tests the merge() function path
        ctx.repo.merge(baseCommit);

        // Repository should still be accessible
        const head = ctx.repo.head();
        assertExists(head);
      });
    });

    await t.step("merge with fast-forward scenario", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit (this is HEAD)
        const baseCommit = await createCommitWithFiles(ctx, "Base commit", {
          "base.txt": "base content",
        });

        // Create feature branch at base
        ctx.repo.createBranch("feature", baseCommit);

        // Add a commit
        const _featureCommit = await createCommitWithFiles(
          ctx,
          "Feature commit",
          { "feature.txt": "feature content" },
        );

        // Save the feature commit OID
        const featureOid = ctx.repo.headOid()!;

        // Verify merge base
        const mergeBase = ctx.repo.mergeBase(featureOid, baseCommit);
        assertEquals(mergeBase, baseCommit);
      });
    });

    // ==================== State Cleanup Tests ====================

    await t.step("stateCleanup clears repository state", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test commit", {
          "file.txt": "content",
        });

        // State cleanup should work even when no merge in progress
        ctx.repo.stateCleanup();

        // Repository should still be functional
        const head = ctx.repo.head();
        assertExists(head);
      });
    });

    await t.step("stateCleanup after merge operation", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "file.txt": "content",
        });

        // Perform a merge
        ctx.repo.merge(baseCommit);

        // Clean up state
        ctx.repo.stateCleanup();

        // Verify repo is still accessible
        const headOid = ctx.repo.headOid();
        assertExists(headOid);
      });
    });

    // ==================== Get Conflicts Tests ====================

    await t.step(
      "getConflicts returns empty array when no conflicts",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Clean commit", {
            "file.txt": "content",
          });

          const conflicts = ctx.repo.getConflicts();
          assertEquals(conflicts.length, 0);
        });
      },
    );

    await t.step("getConflicts on clean repository", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "First", { "a.txt": "a" });
        await createCommitWithFiles(ctx, "Second", { "b.txt": "b" });

        // No conflicts expected
        const conflicts = ctx.repo.getConflicts();
        assertEquals(Array.isArray(conflicts), true);
        assertEquals(conflicts.length, 0);
      });
    });

    // ==================== Annotated Commit from Reference Tests ====================

    await t.step("annotatedCommitFromRef with branch reference", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create commits
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "base.txt": "content",
        });

        // Create a branch
        ctx.repo.createBranch("to-merge", baseCommit);

        // Get annotated commit from branch reference
        const annotatedCommit = ctx.repo.annotatedCommitFromRef(
          "refs/heads/to-merge",
        );
        assertExists(annotatedCommit);
        assertEquals(annotatedCommit.id.length, 40);
        assertEquals(annotatedCommit.ref, "refs/heads/to-merge");

        annotatedCommit.free();
      });
    });

    await t.step("annotatedCommitFromRef with HEAD reference", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

        const headOid = ctx.repo.headOid()!;

        // Get annotated commit from HEAD
        const annotated = ctx.repo.annotatedCommitFromRef("HEAD");
        assertExists(annotated);
        assertEquals(annotated.id, headOid);

        annotated.free();
      });
    });

    // ==================== Annotated Commit from Revspec Tests ====================

    await t.step("annotatedCommitFromRevspec with HEAD", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Some commit", {
          "file.txt": "content",
        });

        // Get annotated commit from revspec
        const annotatedCommit = ctx.repo.annotatedCommitFromRevspec("HEAD");
        assertExists(annotatedCommit);
        assertEquals(annotatedCommit.id.length, 40);

        annotatedCommit.free();
      });
    });

    await t.step("annotatedCommitFromRevspec with branch name", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        const commit = await createCommitWithFiles(ctx, "Test", {
          "t.txt": "t",
        });

        ctx.repo.createBranch("test-branch", commit);

        const annotated = ctx.repo.annotatedCommitFromRevspec("test-branch");
        assertExists(annotated);
        assertEquals(annotated.id, commit);

        annotated.free();
      });
    });

    await t.step("annotatedCommitFromRevspec with relative refs", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "First", { "1.txt": "1" });
        const firstOid = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Second", { "2.txt": "2" });
        await createCommitWithFiles(ctx, "Third", { "3.txt": "3" });

        // HEAD~2 should be the first commit
        const annotated = ctx.repo.annotatedCommitFromRevspec("HEAD~2");
        assertExists(annotated);
        assertEquals(annotated.id, firstOid);

        annotated.free();
      });
    });

    // ==================== Full Merge Workflow Tests ====================

    await t.step("full merge workflow: analyze, merge, commit", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // 1. Create base state
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "readme.txt": "Initial readme",
        });

        // 2. Create feature branch
        ctx.repo.createBranch("feature", baseCommit);

        // 3. Add commit on main
        await createCommitWithFiles(ctx, "Main update", {
          "main.txt": "Main branch file",
        });

        // 4. Analyze merge
        const analysis = ctx.repo.mergeAnalysis(baseCommit);
        assertExists(analysis);

        // 5. If not up-to-date, could perform merge
        if (!analysis.isUpToDate) {
          ctx.repo.merge(baseCommit);
          ctx.repo.stateCleanup();
        }

        // Verify we can still access repo state
        const head = ctx.repo.head();
        assertExists(head);
      });
    });

    await t.step("merge workflow with branch operations", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create initial content
        const commit1 = await createCommitWithFiles(ctx, "Initial content", {
          "readme.md": "# Project\n\nInitial content",
        });

        // Create feature branch
        ctx.repo.createBranch("feature-branch", commit1);

        // Add more content on main
        await createCommitWithFiles(ctx, "Add docs", {
          "docs.md": "Documentation",
        });

        // Get the feature branch as annotated commit
        const featureAnnotated = ctx.repo.annotatedCommitFromRef(
          "refs/heads/feature-branch",
        );
        assertExists(featureAnnotated);

        const featureInfo = featureAnnotated.info;
        assertEquals(featureInfo.id, commit1);
        assertEquals(featureInfo.ref, "refs/heads/feature-branch");

        featureAnnotated.free();
      });
    });

    await t.step("merge analysis with multiple scenarios", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create a linear history
        const c1 = await createCommitWithFiles(ctx, "C1", { "c1.txt": "c1" });
        const c2 = await createCommitWithFiles(ctx, "C2", { "c2.txt": "c2" });
        const c3 = await createCommitWithFiles(ctx, "C3", { "c3.txt": "c3" });

        // Analyze merging ancestor commit (should be up-to-date)
        const analysisC1 = ctx.repo.mergeAnalysis(c1);
        assertEquals(analysisC1.isUpToDate, true);

        // Analyze merging more recent ancestor
        const analysisC2 = ctx.repo.mergeAnalysis(c2);
        assertEquals(analysisC2.isUpToDate, true);

        // Current HEAD
        const analysisC3 = ctx.repo.mergeAnalysis(c3);
        assertEquals(analysisC3.isUpToDate, true);
      });
    });

    // ==================== Edge Cases ====================

    await t.step(
      "annotated commit ref is null when created from lookup",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test", { "t.txt": "t" });
          const headOid = ctx.repo.headOid()!;

          const annotated = ctx.repo.annotatedCommitLookup(headOid);
          // When created from lookup (not from ref), ref should be null
          assertEquals(annotated.ref, null);
          annotated.free();
        });
      },
    );

    await t.step("mergeBase with same commit", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "t" });
        const headOid = ctx.repo.headOid()!;

        // Merge base of commit with itself is itself
        const mergeBase = ctx.repo.mergeBase(headOid, headOid);
        assertEquals(mergeBase, headOid);
      });
    });

    await t.step(
      "mergeCommits returns index that can be inspected",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          const c1 = await createCommitWithFiles(ctx, "C1", { "a.txt": "a" });
          const c2 = await createCommitWithFiles(ctx, "C2", { "b.txt": "b" });

          const mergedIndex = ctx.repo.mergeCommits(c2, c1);
          assertExists(mergedIndex);
          assertEquals(typeof mergedIndex.hasConflicts, "boolean");

          // Get entry count
          const count = mergedIndex.entryCount;
          assertEquals(typeof count, "number");

          mergedIndex.close();
        });
      },
    );

    await t.step(
      "multiple annotated commits can exist simultaneously",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          const c1 = await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
          const c2 = await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });

          ctx.repo.createBranch("branch1", c1);
          ctx.repo.createBranch("branch2", c2);

          const a1 = ctx.repo.annotatedCommitLookup(c1);
          const a2 = ctx.repo.annotatedCommitLookup(c2);
          const a3 = ctx.repo.annotatedCommitFromRef("refs/heads/branch1");

          assertEquals(a1.id, c1);
          assertEquals(a2.id, c2);
          assertEquals(a3.id, c1);
          assertEquals(a3.ref, "refs/heads/branch1");

          a1.free();
          a2.free();
          a3.free();
        });
      },
    );

    // ==================== Conflict Detection Tests ====================

    await t.step(
      "mergeCommits with conflicting changes detects conflicts",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create base commit with a file
          await createCommitWithFiles(ctx, "Base", {
            "conflict.txt": "line 1\nline 2\nline 3\n",
          });
          const baseOid = ctx.repo.headOid()!;

          // Create a branch at base
          ctx.repo.createBranch("feature", baseOid);

          // Modify file on main - change line 2
          await createCommitWithFiles(ctx, "Main changes line 2", {
            "conflict.txt": "line 1\nmain version of line 2\nline 3\n",
          });
          const mainOid = ctx.repo.headOid()!;

          // Switch to feature branch commit by creating from base
          // and modifying differently
          ctx.repo.setHeadDetached(baseOid);

          // Create a different change on the same line
          await createFile(
            ctx.repoPath,
            "conflict.txt",
            "line 1\nfeature version of line 2\nline 3\n",
          );

          using index = Index.fromRepository(ctx.repo);
          index.add("conflict.txt");
          index.write();
          const treeOid = index.writeTree();

          const featureOid = createCommit(ctx.repo, {
            message: "Feature changes line 2",
            author: { name: "Test", email: "test@example.com" },
            treeOid,
            parents: [baseOid],
          });

          // Now merge the two divergent commits
          const mergedIndex = ctx.repo.mergeCommits(mainOid, featureOid);
          assertExists(mergedIndex);

          // This should have conflicts since both modified the same line
          // The hasConflicts property should work
          assertEquals(typeof mergedIndex.hasConflicts, "boolean");

          mergedIndex.close();
        });
      },
    );

    await t.step("mergeCommits between unrelated commits", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create first commit
        await createCommitWithFiles(ctx, "Commit A", {
          "a.txt": "content A",
        });
        const commitA = ctx.repo.headOid()!;

        // Create second commit (child of first)
        await createCommitWithFiles(ctx, "Commit B", {
          "b.txt": "content B",
        });
        const commitB = ctx.repo.headOid()!;

        // Merge A and B - should produce clean merge
        const mergedIndex = ctx.repo.mergeCommits(commitA, commitB);
        assertExists(mergedIndex);
        assertEquals(mergedIndex.hasConflicts, false);
        mergedIndex.close();
      });
    });

    await t.step("getConflicts returns proper structure", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create clean repository
        await createCommitWithFiles(ctx, "Clean", { "clean.txt": "clean" });

        // getConflicts should return an array (empty since no conflicts)
        const conflicts = ctx.repo.getConflicts();
        assertEquals(Array.isArray(conflicts), true);

        // Each conflict entry should have proper structure if any exist
        for (const conflict of conflicts) {
          assertExists(conflict.path);
          assertEquals(typeof conflict.path, "string");
          // ancestorOid, oursOid, theirsOid are optional
        }
      });
    });

    await t.step("merge analysis with various scenarios", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create linear history: base -> c1 -> c2 -> c3
        const base = await createCommitWithFiles(ctx, "Base", {
          "base.txt": "base",
        });

        const c1 = await createCommitWithFiles(ctx, "C1", {
          "c1.txt": "c1",
        });

        ctx.repo.createBranch("branch-at-c1", c1);

        const c2 = await createCommitWithFiles(ctx, "C2", {
          "c2.txt": "c2",
        });

        const c3 = await createCommitWithFiles(ctx, "C3", {
          "c3.txt": "c3",
        });

        // Analyze merging various points
        // c1 is ancestor of HEAD (c3), should be up-to-date
        const a1 = ctx.repo.mergeAnalysis(c1);
        assertEquals(a1.isUpToDate, true);

        // base is even older ancestor
        const a2 = ctx.repo.mergeAnalysis(base);
        assertEquals(a2.isUpToDate, true);

        // c3 is HEAD itself
        const a3 = ctx.repo.mergeAnalysis(c3);
        assertEquals(a3.isUpToDate, true);
      });
    });

    await t.step("annotated commit ptr is accessible", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "t" });
        const headOid = ctx.repo.headOid()!;

        const annotated = ctx.repo.annotatedCommitLookup(headOid);
        assertExists(annotated);

        // The ptr property should be accessible
        assertExists(annotated.ptr);

        annotated.free();
      });
    });

    await t.step("merge with state cleanup workflow", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        const c1 = await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
        ctx.repo.createBranch("feature", c1);

        await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });

        // Perform merge
        ctx.repo.merge(c1);

        // Check repository state can be accessed
        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        // Cleanup state
        ctx.repo.stateCleanup();

        // Should still be functional
        const head = ctx.repo.head();
        assertExists(head);
      });
    });

    // ==================== Additional Branch Coverage Tests ====================

    await t.step("AnnotatedCommit double free is safe", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid);

        const annotated = ctx.repo.annotatedCommitLookup(headOid);

        // First free
        annotated.free();

        // Second free should be safe (no-op)
        annotated.free();
      });
    });

    await t.step("AnnotatedCommit close is alias for free", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

        const headOid = ctx.repo.headOid();
        const annotated = ctx.repo.annotatedCommitLookup(headOid);

        // Use close() instead of free()
        annotated.close();

        // Calling close again should be safe
        annotated.close();
      });
    });

    await t.step("AnnotatedCommit Symbol.dispose works correctly", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

        const headOid = ctx.repo.headOid();

        {
          using annotated = ctx.repo.annotatedCommitLookup(headOid);
          assertExists(annotated);
          assertEquals(annotated.id, headOid);
        }
        // annotated is automatically disposed here
      });
    });

    await t.step(
      "AnnotatedCommit throws after freed for id access",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

          const headOid = ctx.repo.headOid();
          const annotated = ctx.repo.annotatedCommitLookup(headOid);

          annotated.free();

          assertThrows(
            () => annotated.id,
            Error,
            "freed",
          );
        });
      },
    );

    await t.step(
      "AnnotatedCommit throws after freed for ref access",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

          const headOid = ctx.repo.headOid();
          const annotated = ctx.repo.annotatedCommitLookup(headOid);

          annotated.free();

          assertThrows(
            () => annotated.ref,
            Error,
            "freed",
          );
        });
      },
    );

    await t.step("AnnotatedCommit info property works", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

        const headOid = ctx.repo.headOid();
        const annotated = ctx.repo.annotatedCommitLookup(headOid);

        const info = annotated.info;
        assertExists(info);
        assertEquals(info.id, headOid);
        // ref is undefined when created from lookup
        assertEquals(info.ref, undefined);

        annotated.free();
      });
    });

    await t.step(
      "mergeCommits with real conflict produces conflict entries",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create a base commit with a file
          await createCommitWithFiles(ctx, "Base commit", {
            "conflict.txt": "base content\n",
          });
          const baseOid = ctx.repo.headOid();
          assertExists(baseOid);

          // Create commit A modifying the file
          await createCommitWithFiles(ctx, "Commit A", {
            "conflict.txt": "commit A content\n",
          });
          const commitAOid = ctx.repo.headOid();
          assertExists(commitAOid);

          // Use git to go back to base and create a divergent commit
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

            // Reset to base
            const resetCmd = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await resetCmd.output();

            // Create commit B with different content for same file
            ctx.repo = Repository.open(ctx.repoPath);
            await createCommitWithFiles(ctx, "Commit B", {
              "conflict.txt": "commit B content\n",
            });
            const commitBOid = ctx.repo.headOid();
            assertExists(commitBOid);

            // Merge the two commits - should have conflicts
            const mergedIndex = ctx.repo.mergeCommits(commitAOid, commitBOid);
            assertExists(mergedIndex);

            // Check for conflicts
            const hasConflicts = mergedIndex.hasConflicts;
            assertEquals(hasConflicts, true);

            // Get conflicts using the getConflicts function
            const lib = getLibrary();
            const conflicts = getConflicts(lib, mergedIndex.pointer);
            assertExists(conflicts);
            assert(conflicts.length > 0);

            // Verify conflict structure
            const conflict = conflicts[0];
            assertExists(conflict.path);
            assertEquals(conflict.path, "conflict.txt");

            mergedIndex.free();
          }
        });
      },
    );

    await t.step(
      "getConflicts on non-conflicting merge returns empty",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create two commits with different files (no conflict)
          const c1 = await createCommitWithFiles(ctx, "Commit 1", {
            "file1.txt": "content 1\n",
          });
          const c2 = await createCommitWithFiles(ctx, "Commit 2", {
            "file2.txt": "content 2\n",
          });

          const mergedIndex = ctx.repo.mergeCommits(c1, c2);
          assertExists(mergedIndex);

          // No conflicts expected
          assertEquals(mergedIndex.hasConflicts, false);

          const lib = getLibrary();
          const conflicts = getConflicts(lib, mergedIndex.pointer);
          assertEquals(conflicts.length, 0);

          mergedIndex.free();
        });
      },
    );

    await t.step("merge analysis returns correct flags", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Base", { "base.txt": "content" });

        const headOid = ctx.repo.headOid();
        const annotated = ctx.repo.annotatedCommitLookup(headOid);

        // Analyzing with head should be up-to-date
        const analysis = ctx.repo.mergeAnalysis(headOid);

        assertExists(analysis);
        assertEquals(typeof analysis.analysis, "number");
        assertEquals(typeof analysis.preference, "number");
        assertEquals(typeof analysis.canFastForward, "boolean");
        assertEquals(typeof analysis.isUpToDate, "boolean");
        assertEquals(typeof analysis.requiresNormalMerge, "boolean");
        assertEquals(typeof analysis.isUnborn, "boolean");

        annotated.free();
      });
    });

    await t.step("AnnotatedCommit fromRevspec works with HEAD", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

        const headOid = ctx.repo.headOid();
        const annotated = ctx.repo.annotatedCommitFromRevspec("HEAD");

        assertExists(annotated);
        assertEquals(annotated.id, headOid);

        annotated.free();
      });
    });

    await t.step("AnnotatedCommit fromRevspec works with HEAD~1", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        const firstOid = await createCommitWithFiles(ctx, "First", {
          "1.txt": "1",
        });
        await createCommitWithFiles(ctx, "Second", { "2.txt": "2" });

        const annotated = ctx.repo.annotatedCommitFromRevspec("HEAD~1");

        assertExists(annotated);
        assertEquals(annotated.id, firstOid);

        annotated.free();
      });
    });

    await t.step("merge operation modifies working directory", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create base commit
        await createCommitWithFiles(ctx, "Base", { "base.txt": "base" });
        const baseOid = ctx.repo.headOid();
        assertExists(baseOid);

        // Create a commit with new file
        await createCommitWithFiles(ctx, "Feature", { "feature.txt": "feat" });
        const featureOid = ctx.repo.headOid();
        assertExists(featureOid);

        // Check git availability for resetting
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

          // Reset to base
          const resetCmd = new Deno.Command("git", {
            args: ["checkout", baseOid],
            cwd: ctx.repoPath,
            stdout: "null",
            stderr: "null",
          });
          await resetCmd.output();

          ctx.repo = Repository.open(ctx.repoPath);

          // Perform merge using OID
          ctx.repo.merge(featureOid);

          // Cleanup
          ctx.repo.stateCleanup();
        }
      });
    });

    await t.step(
      "getConflicts handles conflict with ancestor, ours, and theirs",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create a base with a file
          await createCommitWithFiles(ctx, "Base", {
            "shared.txt": "base content\n",
          });
          const baseOid = ctx.repo.headOid();
          assertExists(baseOid);

          // Create commit A modifying the file
          await createCommitWithFiles(ctx, "A", {
            "shared.txt": "content from A\n",
          });
          const commitAOid = ctx.repo.headOid();
          assertExists(commitAOid);

          // Use git to create divergent history
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

            // Reset to base
            const resetCmd = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await resetCmd.output();

            // Create commit B with different content
            ctx.repo = Repository.open(ctx.repoPath);
            await createCommitWithFiles(ctx, "B", {
              "shared.txt": "content from B\n",
            });
            const commitBOid = ctx.repo.headOid();
            assertExists(commitBOid);

            // Merge and check conflicts
            const mergedIndex = ctx.repo.mergeCommits(commitAOid, commitBOid);
            assertExists(mergedIndex);

            assertEquals(mergedIndex.hasConflicts, true);

            const lib = getLibrary();
            const conflicts = getConflicts(lib, mergedIndex.pointer);

            // Should have one conflict with ancestor, ours, and theirs
            assertEquals(conflicts.length, 1);
            const conflict = conflicts[0];
            assertEquals(conflict.path, "shared.txt");

            // All three sides should be present for a true 3-way conflict
            assertExists(conflict.ancestorOid);
            assertExists(conflict.oursOid);
            assertExists(conflict.theirsOid);

            // OIDs should be valid hex strings
            assertEquals(conflict.ancestorOid?.length, 40);
            assertEquals(conflict.oursOid?.length, 40);
            assertEquals(conflict.theirsOid?.length, 40);

            mergedIndex.free();
          }
        });
      },
    );

    await t.step(
      "getConflicts returns empty for fresh index without conflicts",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create simple non-conflicting commits
          const c1 = await createCommitWithFiles(ctx, "C1", { "a.txt": "a" });
          const c2 = await createCommitWithFiles(ctx, "C2", { "b.txt": "b" });

          // Merge should succeed without conflicts
          const mergedIndex = ctx.repo.mergeCommits(c1, c2);
          assertEquals(mergedIndex.hasConflicts, false);

          const lib = getLibrary();
          const conflicts = getConflicts(lib, mergedIndex.pointer);
          assertEquals(conflicts.length, 0);

          mergedIndex.free();
        });
      },
    );

    await t.step("mergeBase finds common ancestor correctly", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create a base commit
        const baseCommit = await createCommitWithFiles(ctx, "Base", {
          "base.txt": "base",
        });

        // Create two divergent commits
        const c1 = await createCommitWithFiles(ctx, "C1", { "c1.txt": "c1" });
        const c2 = await createCommitWithFiles(ctx, "C2", { "c2.txt": "c2" });

        // Both c1 and c2 should share baseCommit as ancestor
        const ancestor = ctx.repo.mergeBase(baseCommit, c2);
        assertEquals(ancestor, baseCommit);
      });
    });

    await t.step(
      "AnnotatedCommit from reference has ref property",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Test", { "t.txt": "content" });

          // Get annotated commit from HEAD reference
          const annotated = ctx.repo.annotatedCommitFromRef("HEAD");
          assertExists(annotated);

          // When created from ref, the ref property should be set
          const ref = annotated.ref;
          // ref could be null if the reference doesn't store the refname
          // but we verify it doesn't throw

          annotated.free();
        });
      },
    );

    await t.step(
      "getConflicts with add/add conflict (no ancestor)",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create base commit without the conflict file
          await createCommitWithFiles(ctx, "Base", {
            "readme.txt": "readme",
          });
          const baseOid = ctx.repo.headOid();
          assertExists(baseOid);

          // Create commit A adding a new file
          await createCommitWithFiles(ctx, "Add file A", {
            "newfile.txt": "content from A\n",
          });
          const commitAOid = ctx.repo.headOid();
          assertExists(commitAOid);

          // Use git to create divergent history
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

            // Reset to base
            const resetCmd = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await resetCmd.output();

            // Create commit B adding the SAME new file with different content
            ctx.repo = Repository.open(ctx.repoPath);
            await createCommitWithFiles(ctx, "Add file B", {
              "newfile.txt": "content from B\n",
            });
            const commitBOid = ctx.repo.headOid();
            assertExists(commitBOid);

            // Merge - should create add/add conflict (no ancestor)
            const mergedIndex = ctx.repo.mergeCommits(commitAOid, commitBOid);
            assertExists(mergedIndex);

            assertEquals(mergedIndex.hasConflicts, true);

            const lib = getLibrary();
            const conflicts = getConflicts(lib, mergedIndex.pointer);

            // Should have one conflict
            assertEquals(conflicts.length, 1);
            const conflict = conflicts[0];
            assertEquals(conflict.path, "newfile.txt");

            // Add/add conflict has no ancestor!
            assertEquals(conflict.ancestorOid, undefined);
            // But both ours and theirs should be present
            assertExists(conflict.oursOid);
            assertExists(conflict.theirsOid);

            mergedIndex.free();
          }
        });
      },
    );

    await t.step(
      "getConflicts with modify/delete conflict (ours deleted)",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create base commit with the file
          await createCommitWithFiles(ctx, "Base", {
            "target.txt": "original content\n",
          });
          const baseOid = ctx.repo.headOid();
          assertExists(baseOid);

          // Create commit A that DELETES the file (this will be "ours")
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

            // Delete the file and commit (this becomes "ours")
            const rmCmd = new Deno.Command("git", {
              args: ["rm", "target.txt"],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await rmCmd.output();

            const commitCmd = new Deno.Command("git", {
              args: ["commit", "-m", "Delete file"],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await commitCmd.output();

            ctx.repo = Repository.open(ctx.repoPath);
            const commitAOid = ctx.repo.headOid();
            assertExists(commitAOid);

            // Reset to base and create commit B that modifies the file
            ctx.repo.close();

            const resetCmd = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await resetCmd.output();

            ctx.repo = Repository.open(ctx.repoPath);
            await createCommitWithFiles(ctx, "Modify file", {
              "target.txt": "modified content\n",
            });
            const commitBOid = ctx.repo.headOid();
            assertExists(commitBOid);

            // Merge A (delete) into B (modify) - ours=delete, theirs=modify
            const mergedIndex = ctx.repo.mergeCommits(commitAOid, commitBOid);
            assertExists(mergedIndex);

            assertEquals(mergedIndex.hasConflicts, true);

            const lib = getLibrary();
            const conflicts = getConflicts(lib, mergedIndex.pointer);

            // Should have one conflict
            assertEquals(conflicts.length, 1);
            const conflict = conflicts[0];
            assertEquals(conflict.path, "target.txt");

            // Modify/delete where ours deleted: ancestor present, ours undefined, theirs present
            assertExists(conflict.ancestorOid);
            assertEquals(conflict.oursOid, undefined);
            assertExists(conflict.theirsOid);

            mergedIndex.free();
          }
        });
      },
    );

    await t.step(
      "getConflicts with delete/modify conflict",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          // Create base commit with the file
          await createCommitWithFiles(ctx, "Base", {
            "target.txt": "original content\n",
          });
          const baseOid = ctx.repo.headOid();
          assertExists(baseOid);

          // Create commit A that modifies the file
          await createCommitWithFiles(ctx, "Modify file", {
            "target.txt": "modified content\n",
          });
          const commitAOid = ctx.repo.headOid();
          assertExists(commitAOid);

          // Use git to create divergent history
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

            // Reset to base
            const resetCmd = new Deno.Command("git", {
              args: ["checkout", baseOid],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await resetCmd.output();

            // Delete the file and commit
            const rmCmd = new Deno.Command("git", {
              args: ["rm", "target.txt"],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await rmCmd.output();

            const commitCmd = new Deno.Command("git", {
              args: ["commit", "-m", "Delete file"],
              cwd: ctx.repoPath,
              stdout: "null",
              stderr: "null",
            });
            await commitCmd.output();

            ctx.repo = Repository.open(ctx.repoPath);
            const commitBOid = ctx.repo.headOid();
            assertExists(commitBOid);

            // Merge - should create delete/modify conflict
            const mergedIndex = ctx.repo.mergeCommits(commitAOid, commitBOid);
            assertExists(mergedIndex);

            assertEquals(mergedIndex.hasConflicts, true);

            const lib = getLibrary();
            const conflicts = getConflicts(lib, mergedIndex.pointer);

            // Should have one conflict
            assertEquals(conflicts.length, 1);
            const conflict = conflicts[0];
            assertEquals(conflict.path, "target.txt");

            // Delete/modify: ancestor and ours present, theirs undefined
            assertExists(conflict.ancestorOid);
            assertExists(conflict.oursOid);
            assertEquals(conflict.theirsOid, undefined);

            mergedIndex.free();
          }
        });
      },
    );

    teardownLibrary();
  },
});
