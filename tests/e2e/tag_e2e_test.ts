/**
 * End-to-end tests for tag operations
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assert,
} from "@std/assert";

import {
  createTestContext,
  cleanupTestContext,
  createCommitWithFiles,
} from "./helpers.ts";

import { init, shutdown, Repository } from "../../mod.ts";

Deno.test("E2E Tag Tests", async (t) => {
  init();

  try {
    await t.step("create annotated tag on commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create annotated tag
        const tagOid = ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        assertExists(tagOid);
        assertEquals(tagOid.length, 40);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("create lightweight tag on commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create lightweight tag
        const tagOid = ctx.repo.createLightweightTag({
          name: "v1.0.0-light",
          targetOid: commitOid,
        });

        assertExists(tagOid);
        assertEquals(tagOid.length, 40);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("list all tags", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create multiple tags
        ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        ctx.repo.createTag({
          name: "v2.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v2.0.0",
        });

        ctx.repo.createLightweightTag({
          name: "latest",
          targetOid: commitOid,
        });

        // List all tags
        const tags = ctx.repo.listTags();
        assertEquals(tags.length, 3);
        assert(tags.includes("v1.0.0"));
        assert(tags.includes("v2.0.0"));
        assert(tags.includes("latest"));
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("list tags matching pattern", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create multiple tags
        ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        ctx.repo.createTag({
          name: "v2.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v2.0.0",
        });

        ctx.repo.createLightweightTag({
          name: "latest",
          targetOid: commitOid,
        });

        // List tags matching pattern
        const vTags = ctx.repo.listTags("v*");
        assertEquals(vTags.length, 2);
        assert(vTags.includes("v1.0.0"));
        assert(vTags.includes("v2.0.0"));
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("lookup annotated tag by OID", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create annotated tag
        const tagOid = ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        // Lookup tag
        const tag = ctx.repo.lookupTag(tagOid);
        assertExists(tag);
        assertEquals(tag.name, "v1.0.0");
        assert(tag.message.startsWith("Release v1.0.0"));
        assertEquals(tag.targetOid, commitOid);
        assertExists(tag.tagger);
        assertEquals(tag.tagger.name, "Test User");
        assertEquals(tag.tagger.email, "test@example.com");

        tag.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("delete tag by name", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create tag
        ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        // Verify tag exists
        let tags = ctx.repo.listTags();
        assertEquals(tags.length, 1);

        // Delete tag
        ctx.repo.deleteTag("v1.0.0");

        // Verify tag is deleted
        tags = ctx.repo.listTags();
        assertEquals(tags.length, 0);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("iterate over tags with foreach", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create multiple tags
        ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        ctx.repo.createLightweightTag({
          name: "v2.0.0",
          targetOid: commitOid,
        });

        // Iterate over tags
        const tagInfos = ctx.repo.foreachTag();
        assertEquals(tagInfos.length, 2);

        // Each tag should have name and oid
        for (const info of tagInfos) {
          assertExists(info.name);
          assertExists(info.oid);
          assertEquals(info.oid.length, 40);
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("create tag with force flag overwrites existing", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commit1 = await createCommitWithFiles(ctx, "First commit", {
          "file.txt": "content1\n",
        });

        const commit2 = await createCommitWithFiles(ctx, "Second commit", {
          "file.txt": "content2\n",
        });

        // Create tag pointing to first commit
        ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commit1,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
          force: false,
        });

        // Create tag with same name pointing to second commit with force
        const newTagOid = ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commit2,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0 (updated)",
          force: true,
        });

        // Lookup tag and verify it points to second commit
        const tag = ctx.repo.lookupTag(newTagOid);
        assertEquals(tag.targetOid, commit2);
        assert(tag.message.startsWith("Release v1.0.0 (updated)"));

        tag.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("peel annotated tag to target commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create annotated tag
        const tagOid = ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        // Lookup and peel tag
        const tag = ctx.repo.lookupTag(tagOid);
        const peeledOid = tag.peel();

        assertEquals(peeledOid, commitOid);

        tag.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("empty repository has no tags", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        // Create initial commit (needed for repo to be valid)
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const tags = ctx.repo.listTags();
        assertEquals(tags.length, 0);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("tag target type is commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: false });
      try {
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create annotated tag
        const tagOid = ctx.repo.createTag({
          name: "v1.0.0",
          targetOid: commitOid,
          tagger: { name: "Test User", email: "test@example.com" },
          message: "Release v1.0.0",
        });

        // Lookup tag and check target type
        const tag = ctx.repo.lookupTag(tagOid);
        assertEquals(tag.targetType, "commit");

        tag.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
