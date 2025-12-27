/**
 * End-to-end tests for cherry-pick functionality
 * Tests use real file operations in temporary directories
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { Repository } from "../../mod.ts";
import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

Deno.test("E2E Cherry-pick Tests", async (t) => {
  using _git = await setupLibrary();
    await t.step("cherry-pick commit to index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create initial commit
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const baseOid = ctx.repo.headOid();

      // Create a branch and add a commit
      ctx.repo.createBranch("feature", baseOid);

      // Switch to feature branch using git
      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["checkout", "feature"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Create a commit on feature branch
      await createCommitWithFiles(ctx, "Feature commit", {
        "feature.txt": "feature content\n",
      });
      const featureOid = ctx.repo.headOid();

      // Switch back to master
      ctx.repo.close();
      const cmd2 = new Deno.Command("git", {
        args: ["checkout", "master"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd2.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Cherry-pick the feature commit to index (against base, not HEAD)
      using index = ctx.repo.cherrypickCommit(featureOid, baseOid);
      assertExists(index, "Should return an index");

      // The index should contain the cherry-picked changes
      const entryCount = index.entryCount;
      assertExists(entryCount, "Index should have entries");
    });

    await t.step("cherry-pick modifies working directory", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create initial commit
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const baseOid = ctx.repo.headOid();

      // Create a branch and add a commit
      ctx.repo.createBranch("feature", baseOid);

      // Switch to feature branch
      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["checkout", "feature"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Create a commit on feature branch
      await createCommitWithFiles(ctx, "Feature commit", {
        "new_file.txt": "new file content\n",
      });
      const featureOid = ctx.repo.headOid();

      // Switch back to master
      ctx.repo.close();
      const cmd2 = new Deno.Command("git", {
        args: ["checkout", "master"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd2.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Cherry-pick the feature commit (modifies working directory)
      ctx.repo.cherrypick(featureOid);

      // Verify the file exists in working directory
      const filePath = `${ctx.repoPath}/new_file.txt`;
      const fileExists = await Deno.stat(filePath).then(() => true).catch(
        () => false,
      );
      assert(
        fileExists,
        "Cherry-picked file should exist in working directory",
      );

      // Verify file content
      const content = await Deno.readTextFile(filePath);
      assertEquals(content, "new file content\n");
    });

    await t.step("cherry-pick detects conflicts", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create initial commit
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const baseOid = ctx.repo.headOid();

      // Create feature branch
      ctx.repo.createBranch("feature", baseOid);

      // Modify file on master
      await createCommitWithFiles(ctx, "Master change", {
        "file.txt": "master version\n",
      });
      const masterOid = ctx.repo.headOid();

      // Switch to feature and modify same file
      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["checkout", "feature"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      await createCommitWithFiles(ctx, "Feature change", {
        "file.txt": "feature version\n",
      });
      const featureOid = ctx.repo.headOid();

      // Switch back to master
      ctx.repo.close();
      const cmd2 = new Deno.Command("git", {
        args: ["checkout", "master"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd2.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Cherry-pick should produce index with conflicts
      using index = ctx.repo.cherrypickCommit(featureOid, masterOid);
      assertExists(index, "Should return an index");

      // Check if there are conflicts
      const hasConflicts = index.hasConflicts;
      assert(hasConflicts, "Index should have conflicts");
    });

    await t.step("cherry-pick non-existent commit throws error", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const baseOid = ctx.repo.headOid();

      const fakeOid = "0000000000000000000000000000000000000000";

      let threw = false;
      try {
        ctx.repo.cherrypickCommit(fakeOid, baseOid);
      } catch {
        threw = true;
      }
      assert(threw, "Should throw error for non-existent commit");
    });

    // Skip: This test requires proper handling of cherry-pick state cleanup
    // The second cherry-pick fails because the first cherry-pick leaves the repo in CHERRYPICK state
    await t.step({
      name: "cherry-pick multiple commits with git commit between",
      fn: async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const baseOid = ctx.repo.headOid();

        // Create feature branch with multiple commits
        ctx.repo.createBranch("feature", baseOid);

        ctx.repo.close();
        const cmd = new Deno.Command("git", {
          args: ["checkout", "feature"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await cmd.output();
        ctx.repo = Repository.open(ctx.repoPath);

        await createCommitWithFiles(ctx, "Feature 1", {
          "feat1.txt": "feat1\n",
        });
        const feat1Oid = ctx.repo.headOid();

        await createCommitWithFiles(ctx, "Feature 2", {
          "feat2.txt": "feat2\n",
        });
        const feat2Oid = ctx.repo.headOid();

        // Switch back to master
        ctx.repo.close();
        const cmd2 = new Deno.Command("git", {
          args: ["checkout", "master"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await cmd2.output();
        ctx.repo = Repository.open(ctx.repoPath);

        // Cherry-pick first commit
        ctx.repo.cherrypick(feat1Oid);

        // Stage and commit the cherry-pick using git
        ctx.repo.close();
        const addCmd = new Deno.Command("git", {
          args: ["add", "-A"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await addCmd.output();
        const commitCmd = new Deno.Command("git", {
          args: ["commit", "-m", "Cherry-pick feat1"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await commitCmd.output();
        ctx.repo = Repository.open(ctx.repoPath);

        // Cherry-pick second commit
        ctx.repo.cherrypick(feat2Oid);

        // Verify both files exist
        const file1Exists = await Deno.stat(`${ctx.repoPath}/feat1.txt`).then(
          () => true,
        ).catch(() => false);
        const file2Exists = await Deno.stat(`${ctx.repoPath}/feat2.txt`).then(
          () => true,
        ).catch(() => false);

        assert(file1Exists, "First cherry-picked file should exist");
        assert(file2Exists, "Second cherry-picked file should exist");
      },
    });

    await t.step(
      "cherry-pick to index preserves working directory",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const baseOid = ctx.repo.headOid();

        // Create feature branch
        ctx.repo.createBranch("feature", baseOid);

        ctx.repo.close();
        const cmd = new Deno.Command("git", {
          args: ["checkout", "feature"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await cmd.output();
        ctx.repo = Repository.open(ctx.repoPath);

        await createCommitWithFiles(ctx, "Feature", {
          "feat.txt": "feature\n",
        });
        const featureOid = ctx.repo.headOid();

        // Switch back to master
        ctx.repo.close();
        const cmd2 = new Deno.Command("git", {
          args: ["checkout", "master"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await cmd2.output();
        ctx.repo = Repository.open(ctx.repoPath);

        // Cherry-pick to index only (doesn't modify working directory)
        using index = ctx.repo.cherrypickCommit(featureOid, baseOid);
        assertExists(index, "Should return an index");

        // Working directory should NOT have the file yet
        const filePath = `${ctx.repoPath}/feat.txt`;
        const fileExists = await Deno.stat(filePath).then(() => true).catch(
          () => false,
        );
        assert(
          !fileExists,
          "File should NOT exist in working directory after cherrypickCommit",
        );
      },
    );
});
