/**
 * End-to-end tests for describe functionality
 * Tests use real file operations in temporary directories
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "@std/assert";
import { DescribeStrategy, Repository } from "../../mod.ts";
import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

Deno.test("E2E Describe Tests", async (t) => {
  using _git = await setupLibrary();
  await t.step("describe commit with annotated tag", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    const headOid = ctx.repo.headOid()!;
    ctx.repo.close();

    // Create annotated tag with git
    const cmd = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd.output();

    ctx.repo = Repository.open(ctx.repoPath);
    const description = ctx.repo.describeCommit(headOid);
    assertExists(description, "Should return description");
    assertEquals(description, "v1.0.0", "Should match tag name");
  });

  await t.step(
    "describe commit with commits since annotated tag",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });
      ctx.repo.close();

      const cmd1 = new Deno.Command("git", {
        args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
        cwd: ctx.repoPath,
      });
      await cmd1.output();

      ctx.repo = Repository.open(ctx.repoPath);
      await createCommitWithFiles(ctx, "Second commit", {
        "file2.txt": "content2\n",
      });
      const headOid = ctx.repo.headOid()!;

      const description = ctx.repo.describeCommit(headOid);
      assertExists(description, "Should return description");
      assertStringIncludes(description, "v1.0.0", "Should include tag name");
      assertStringIncludes(
        description,
        "-1-g",
        "Should include commit count and hash prefix",
      );
    },
  );

  await t.step("describe workdir", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    ctx.repo.close();

    const cmd = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd.output();

    ctx.repo = Repository.open(ctx.repoPath);
    const description = ctx.repo.describeWorkdir();
    assertExists(description, "Should return description");
    assertEquals(description, "v1.0.0", "Should match tag name");
  });

  await t.step("describe workdir with dirty suffix", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    ctx.repo.close();

    const cmd = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd.output();

    // Make workdir dirty
    await Deno.writeTextFile(
      `${ctx.repoPath}/file.txt`,
      "modified content\n",
    );

    ctx.repo = Repository.open(ctx.repoPath);
    const description = ctx.repo.describeWorkdir({
      formatOptions: { dirtySuffix: "-dirty" },
    });
    assertExists(description, "Should return description");
    assertStringIncludes(
      description,
      "-dirty",
      "Should include dirty suffix",
    );
  });

  await t.step("describe with abbreviated size", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    ctx.repo.close();

    const cmd1 = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd1.output();

    ctx.repo = Repository.open(ctx.repoPath);
    await createCommitWithFiles(ctx, "Second commit", {
      "file2.txt": "content2\n",
    });
    const headOid = ctx.repo.headOid()!;

    const description = ctx.repo.describeCommit(headOid, {
      formatOptions: { abbreviatedSize: 12 },
    });
    assertExists(description, "Should return description");
    const match = description.match(/-g([a-f0-9]+)$/);
    assertExists(match, "Should have hash suffix");
    assertEquals(match![1].length, 12, "Hash should be 12 characters");
  });

  await t.step("describe with always long format", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    ctx.repo.close();

    const cmd = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd.output();

    ctx.repo = Repository.open(ctx.repoPath);
    const headOid = ctx.repo.headOid()!;
    const description = ctx.repo.describeCommit(headOid, {
      formatOptions: { alwaysUseLongFormat: true },
    });
    assertExists(description, "Should return description");
    assertStringIncludes(
      description,
      "-0-g",
      "Should use long format even at tag",
    );
  });

  await t.step(
    "describe with TAGS strategy finds lightweight tags",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });
      ctx.repo.close();

      // Create lightweight tag
      const cmd = new Deno.Command("git", {
        args: ["tag", "lightweight-tag"],
        cwd: ctx.repoPath,
      });
      await cmd.output();

      ctx.repo = Repository.open(ctx.repoPath);
      const headOid = ctx.repo.headOid()!;
      const description = ctx.repo.describeCommit(headOid, {
        strategy: DescribeStrategy.TAGS,
      });
      assertExists(description, "Should return description");
      assertEquals(
        description,
        "lightweight-tag",
        "Should find lightweight tag",
      );
    },
  );

  await t.step("describe with ALL strategy finds branches", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    const headOid = ctx.repo.headOid()!;

    const description = ctx.repo.describeCommit(headOid, {
      strategy: DescribeStrategy.ALL,
    });
    assertExists(description, "Should return description");
    assert(
      description.includes("heads/") || description.includes("master") ||
        description.includes("main"),
      "Should find branch reference",
    );
  });

  await t.step("describe with pattern filter", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    ctx.repo.close();

    // Create multiple annotated tags
    const cmd1 = new Deno.Command("git", {
      args: ["tag", "-a", "release-1.0", "-m", "Release 1.0"],
      cwd: ctx.repoPath,
    });
    await cmd1.output();
    const cmd2 = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Version 1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd2.output();

    ctx.repo = Repository.open(ctx.repoPath);
    const headOid = ctx.repo.headOid()!;
    const description = ctx.repo.describeCommit(headOid, {
      pattern: "release-*",
    });
    assertExists(description, "Should return description");
    assertEquals(description, "release-1.0", "Should match pattern");
  });

  await t.step("describe commit without tag falls back to OID", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    const headOid = ctx.repo.headOid()!;

    const description = ctx.repo.describeCommit(headOid, {
      showCommitOidAsFallback: true,
    });
    assertExists(description, "Should return description");
    assert(
      headOid.startsWith(description.slice(0, 7)),
      "Should be abbreviated OID",
    );
  });

  await t.step("describe with max candidates", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial commit", {
      "file.txt": "content\n",
    });
    ctx.repo.close();

    const cmd = new Deno.Command("git", {
      args: ["tag", "-a", "v1.0.0", "-m", "Release v1.0.0"],
      cwd: ctx.repoPath,
    });
    await cmd.output();

    ctx.repo = Repository.open(ctx.repoPath);
    const headOid = ctx.repo.headOid()!;
    const description = ctx.repo.describeCommit(headOid, {
      maxCandidatesTags: 5,
    });
    assertExists(description, "Should return description");
    assertEquals(description, "v1.0.0", "Should find tag");
  });
});
