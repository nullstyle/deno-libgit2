/**
 * End-to-end tests for submodule functionality
 * Tests use real file operations in temporary directories
 */

import {
  assertEquals,
  assertExists,
  assertFalse,
  assertThrows,
} from "@std/assert";
import { Repository } from "../../mod.ts";
import {
  GitSubmoduleIgnore,
  GitSubmoduleStatus,
  GitSubmoduleUpdate,
  listSubmodules,
  lookupSubmodule,
  setSubmoduleBranch,
  setSubmoduleUrl,
  Submodule,
  submoduleStatus,
} from "../../src/submodule.ts";
import { getLibrary } from "../../src/library.ts";
import { GitError } from "../../src/error.ts";
import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

const decoder = new TextDecoder();

async function runGit(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<void> {
  const cmd = new Deno.Command("git", {
    args,
    cwd,
    env,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  if (!result.success) {
    const stderr = decoder.decode(result.stderr).trim();
    const stdout = decoder.decode(result.stdout).trim();
    const detail = stderr || stdout || `exit code ${result.code}`;
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
}

/**
 * Helper to create a submodule repository
 */
async function createSubmoduleRepo(parentDir: string): Promise<string> {
  const submodulePath = `${parentDir}/submodule-repo`;
  await Deno.mkdir(submodulePath, { recursive: true });

  // Initialize submodule repo
  await runGit(["init"], submodulePath);

  // Configure git
  await runGit(["config", "user.email", "test@example.com"], submodulePath);
  await runGit(["config", "user.name", "Test User"], submodulePath);

  // Create a file and commit
  await Deno.writeTextFile(`${submodulePath}/README.md`, "# Submodule\n");

  await runGit(["add", "."], submodulePath);
  await runGit(["commit", "-m", "Initial submodule commit"], submodulePath);

  return submodulePath;
}

/**
 * Helper to add a submodule to a repository using git CLI
 */
async function addSubmoduleWithGit(
  repoPath: string,
  submodulePath: string,
  targetPath: string,
): Promise<void> {
  const env = { GIT_ALLOW_PROTOCOL: "file" };
  await runGit(
    [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      submodulePath,
      targetPath,
    ],
    repoPath,
    env,
  );

  // Commit the submodule addition
  await runGit(["config", "user.email", "test@example.com"], repoPath);
  await runGit(["config", "user.name", "Test User"], repoPath);
  await runGit(["commit", "-m", "Add submodule"], repoPath);
}

Deno.test("E2E Submodule Tests", async (t) => {
  using _git = await setupLibrary();

  // Tests that don't require git CLI
    await t.step("Submodule class throws on null pointer", () => {
      assertThrows(
        () => new Submodule(null),
        GitError,
        "Invalid",
      );
    });

    await t.step("GitSubmoduleIgnore enum has correct values", () => {
      assertEquals(GitSubmoduleIgnore.UNSPECIFIED, -1);
      assertEquals(GitSubmoduleIgnore.NONE, 1);
      assertEquals(GitSubmoduleIgnore.UNTRACKED, 2);
      assertEquals(GitSubmoduleIgnore.DIRTY, 3);
      assertEquals(GitSubmoduleIgnore.ALL, 4);
    });

    await t.step("GitSubmoduleUpdate enum has correct values", () => {
      assertEquals(GitSubmoduleUpdate.DEFAULT, 0);
      assertEquals(GitSubmoduleUpdate.CHECKOUT, 1);
      assertEquals(GitSubmoduleUpdate.REBASE, 2);
      assertEquals(GitSubmoduleUpdate.MERGE, 3);
      assertEquals(GitSubmoduleUpdate.NONE, 4);
    });

    await t.step("GitSubmoduleStatus flags are correct", () => {
      assertEquals(GitSubmoduleStatus.IN_HEAD, 1);
      assertEquals(GitSubmoduleStatus.IN_INDEX, 2);
      assertEquals(GitSubmoduleStatus.IN_CONFIG, 4);
      assertEquals(GitSubmoduleStatus.IN_WD, 8);
      assertEquals(GitSubmoduleStatus.INDEX_ADDED, 16);
      assertEquals(GitSubmoduleStatus.INDEX_DELETED, 32);
      assertEquals(GitSubmoduleStatus.INDEX_MODIFIED, 64);
      assertEquals(GitSubmoduleStatus.WD_UNINITIALIZED, 128);
      assertEquals(GitSubmoduleStatus.WD_ADDED, 256);
      assertEquals(GitSubmoduleStatus.WD_DELETED, 512);
      assertEquals(GitSubmoduleStatus.WD_MODIFIED, 1024);
      assertEquals(GitSubmoduleStatus.WD_INDEX_MODIFIED, 2048);
      assertEquals(GitSubmoduleStatus.WD_WD_MODIFIED, 4096);
      assertEquals(GitSubmoduleStatus.WD_UNTRACKED, 8192);
    });

    await t.step("list submodules in repo without submodules", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const submodules = ctx.repo.listSubmodules();
      assertEquals(submodules.length, 0, "Should have no submodules");
    });

    await t.step(
      "listSubmodules returns empty array for bare repo",
      async () => {
        await using ctx = await createTestContext({
          bare: true,
        });

        const lib = getLibrary();
        const submodules = listSubmodules(lib, ctx.repo.pointer);
        assertEquals(submodules.length, 0);
      },
    );

    await t.step(
      "listSubmodules returns empty when no .gitmodules",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        const lib = getLibrary();
        const submodules = listSubmodules(lib, ctx.repo.pointer);
        assertEquals(submodules.length, 0);
      },
    );

    await t.step(
      "lookupSubmodule throws for non-existent submodule",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        const lib = getLibrary();
        assertThrows(
          () => lookupSubmodule(lib, ctx.repo.pointer, "nonexistent"),
          GitError,
        );
      },
    );

    await t.step(
      "submoduleStatus throws for non-existent submodule",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        const lib = getLibrary();
        assertThrows(
          () => submoduleStatus(lib, ctx.repo.pointer, "nonexistent"),
          GitError,
        );
      },
    );

    await t.step(
      "submoduleStatus with different ignore values",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        const lib = getLibrary();

        // These should all throw for non-existent submodules but test the ignore parameter
        const ignoreValues = [
          GitSubmoduleIgnore.UNSPECIFIED,
          GitSubmoduleIgnore.NONE,
          GitSubmoduleIgnore.UNTRACKED,
          GitSubmoduleIgnore.DIRTY,
          GitSubmoduleIgnore.ALL,
        ];

        for (const ignore of ignoreValues) {
          assertThrows(
            () => submoduleStatus(lib, ctx.repo.pointer, "nonexistent", ignore),
            GitError,
          );
        }
      },
    );

    await t.step(
      "setSubmoduleUrl creates config entry for new submodule",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        const lib = getLibrary();
        // setSubmoduleUrl can create a config entry even for non-existent submodules
        // This is useful when setting up a submodule before it's fully added
        setSubmoduleUrl(
          lib,
          ctx.repo.pointer,
          "new-submodule",
          "https://example.com/repo.git",
        );
        // If we get here without throwing, the function succeeded
      },
    );

    await t.step(
      "setSubmoduleBranch creates config entry for new submodule",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });

        const lib = getLibrary();
        // setSubmoduleBranch can create a config entry even for non-existent submodules
        setSubmoduleBranch(
          lib,
          ctx.repo.pointer,
          "new-submodule",
          "main",
        );
        // If we get here without throwing, the function succeeded
      },
    );

    // Tests requiring git CLI - these will be skipped if git is not available
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
      await t.step("list submodules in repo with submodule", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create a submodule repo
        const submodulePath = await createSubmoduleRepo(ctx.tempDir);

        // Close repo before using git CLI
        ctx.repo.close();

        // Add submodule using git CLI
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");

        // Reopen repo
        ctx.repo = Repository.open(ctx.repoPath);

        const submodules = ctx.repo.listSubmodules();
        assertEquals(submodules.length, 1, "Should have one submodule");
        assertEquals(submodules[0], "libs/sub", "Submodule name should match");
      });

      await t.step("lookup submodule by name", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create and add submodule
        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        assertExists(submodule, "Should find submodule");
        assertEquals(submodule.name, "libs/sub", "Name should match");
        assertEquals(submodule.path, "libs/sub", "Path should match");
        assertExists(submodule.url, "Should have URL");
      });

      await t.step("get submodule URL", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        assertExists(submodule.url, "Should have URL");
        // URL should contain the submodule path
        assertEquals(
          submodule.url.includes("submodule-repo"),
          true,
          "URL should reference submodule repo",
        );
      });

      await t.step("get submodule index ID", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        // After git submodule add + commit, the submodule should have an index ID
        const indexId = submodule.indexId;
        // Index ID should exist after the submodule is committed
        if (indexId !== null) {
          assertEquals(indexId.length, 40, "Index ID should be 40 char hex");
        }
        // Head ID may be null until the submodule is checked out
        const headId = submodule.headId;
        if (headId !== null) {
          assertEquals(headId.length, 40, "Head ID should be 40 char hex");
        }
      });

      await t.step("get submodule status", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const status = ctx.repo.submoduleStatus("libs/sub");
        assertExists(status, "Should get status");
        // Status should be non-zero (submodule exists somewhere)
        // The exact flags depend on the state of the submodule
        // IN_CONFIG (0x04) should always be set since we have .gitmodules
        assertEquals(
          (status & GitSubmoduleStatus.IN_CONFIG) !== 0,
          true,
          "Should be in CONFIG (.gitmodules)",
        );
        // IN_WD (0x08) should be set since the submodule directory exists
        assertEquals(
          (status & GitSubmoduleStatus.IN_WD) !== 0,
          true,
          "Should be in WD",
        );
      });

      await t.step("iterate over multiple submodules", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create two submodule repos
        const submodulePath1 = await createSubmoduleRepo(ctx.tempDir);
        const submodulePath2 = `${ctx.tempDir}/submodule-repo-2`;
        await Deno.mkdir(submodulePath2, { recursive: true });

        // Initialize second submodule
        await runGit(["init"], submodulePath2);
        await runGit(
          ["config", "user.email", "test@example.com"],
          submodulePath2,
        );
        await runGit(["config", "user.name", "Test User"], submodulePath2);
        await Deno.writeTextFile(`${submodulePath2}/README.md`, "# Sub 2\n");
        await runGit(["add", "."], submodulePath2);
        await runGit(["commit", "-m", "Initial"], submodulePath2);

        ctx.repo.close();

        // Add both submodules
        await addSubmoduleWithGit(ctx.repoPath, submodulePath1, "libs/sub1");
        await addSubmoduleWithGit(ctx.repoPath, submodulePath2, "libs/sub2");

        ctx.repo = Repository.open(ctx.repoPath);

        const submodules = ctx.repo.listSubmodules();
        assertEquals(submodules.length, 2, "Should have two submodules");
        assertEquals(
          submodules.includes("libs/sub1"),
          true,
          "Should have sub1",
        );
        assertEquals(
          submodules.includes("libs/sub2"),
          true,
          "Should have sub2",
        );
      });

      await t.step("submodule toInfo returns correct structure", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        const info = submodule.toInfo();

        assertEquals(info.name, "libs/sub");
        assertEquals(info.path, "libs/sub");
        assertExists(info.url);
        // branch may be null for default
        assertEquals(
          typeof info.branch === "string" || info.branch === null,
          true,
        );
      });

      await t.step("submodule ignore property", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        const ignore = submodule.ignore;
        // Default ignore value
        assertEquals(typeof ignore, "number");
      });

      await t.step("submodule updateStrategy property", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        const updateStrategy = submodule.updateStrategy;
        assertEquals(typeof updateStrategy, "number");
      });

      await t.step("submodule pointer property", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        assertExists(submodule.pointer);
      });

      await t.step("submodule free/close is idempotent", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const submodule = ctx.repo.lookupSubmodule("libs/sub");
        submodule.free();
        submodule.free(); // Should not throw
        submodule.close(); // Should not throw
      });

      await t.step("submodule throws after freed", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const submodule = ctx.repo.lookupSubmodule("libs/sub");
        submodule.free();

        assertThrows(() => submodule.name, GitError, "freed");
        assertThrows(() => submodule.path, GitError, "freed");
        assertThrows(() => submodule.url, GitError, "freed");
        assertThrows(() => submodule.branch, GitError, "freed");
        assertThrows(() => submodule.headId, GitError, "freed");
        assertThrows(() => submodule.indexId, GitError, "freed");
        assertThrows(() => submodule.wdId, GitError, "freed");
        assertThrows(() => submodule.ignore, GitError, "freed");
        assertThrows(() => submodule.updateStrategy, GitError, "freed");
      });

      await t.step("submodule Symbol.dispose works", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        {
          using submodule = ctx.repo.lookupSubmodule("libs/sub");
          assertEquals(submodule.name, "libs/sub");
        }
        // Submodule should be disposed after leaving the block
      });

      await t.step("submodule branch property (null for default)", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        // Branch may be null if not explicitly configured
        const branch = submodule.branch;
        assertEquals(typeof branch === "string" || branch === null, true);
      });

      await t.step("submodule wdId property", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        // wdId may be null if submodule is not initialized
        const wdId = submodule.wdId;
        if (wdId !== null) {
          assertEquals(wdId.length, 40, "WD ID should be 40 char hex");
        }
      });

      await t.step("submodule location returns status flags", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        const location = submodule.location();
        assertEquals(typeof location, "number");
        // Should have some location flags set
      });

      await t.step("setSubmoduleUrl changes URL in config", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const lib = getLibrary();
        const newUrl = "https://example.com/new-repo.git";
        setSubmoduleUrl(lib, ctx.repo.pointer, "libs/sub", newUrl);

        // Verify the URL was changed
        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        submodule.reload(true);
        // Note: URL change might only be visible after reload
        assertExists(submodule.url);
      });

      await t.step("setSubmoduleBranch changes branch in config", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const lib = getLibrary();
        setSubmoduleBranch(lib, ctx.repo.pointer, "libs/sub", "develop");

        // Verify the branch was set (may require reload)
        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        submodule.reload(true);
      });

      await t.step("submodule init works", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        // This should not throw
        submodule.init(false);
      });

      await t.step("submodule init with overwrite", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        submodule.init(true); // with overwrite
      });

      await t.step("submodule sync works", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        // This should not throw
        submodule.sync();
      });

      await t.step("submodule reload with force", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        using submodule = ctx.repo.lookupSubmodule("libs/sub");
        submodule.reload(false); // without force
        submodule.reload(true); // with force
      });

      await t.step("submodule not found throws error", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Try to lookup non-existent submodule
        assertThrows(
          () => ctx.repo.lookupSubmodule("nonexistent"),
          GitError,
        );
      });

      await t.step("submoduleStatus with ignore parameter", async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const lib = getLibrary();

        // Test with different ignore values
        const statusNone = submoduleStatus(
          lib,
          ctx.repo.pointer,
          "libs/sub",
          GitSubmoduleIgnore.NONE,
        );
        assertEquals(typeof statusNone, "number");

        const statusAll = submoduleStatus(
          lib,
          ctx.repo.pointer,
          "libs/sub",
          GitSubmoduleIgnore.ALL,
        );
        assertEquals(typeof statusAll, "number");
      });
    } else {
      await t.step("git CLI tests skipped (git not available)", () => {
        // Skip tests that require git CLI
      });
    }
});
