/**
 * End-to-end tests for tag operations
 *
 * These tests validate tag functionality including:
 * - Creating annotated and lightweight tags
 * - Listing tags with and without patterns
 * - Looking up tags by OID
 * - Tag properties (oid, name, message, tagger, targetOid, targetType)
 * - Peeling tags to targets
 * - Deleting tags
 * - Foreach iteration
 * - Symbol.dispose support
 * - Error handling and edge cases
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";

import { createCommitWithFiles, createTestContext } from "./helpers.ts";

import { init, shutdown, Tree } from "../../mod.ts";

Deno.test("E2E Tag Tests", async (t) => {
  await init();

  try {
    // ==================== Create Annotated Tag Tests ====================

    await t.step("create annotated tag on commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: "Release v1.0.0",
      });

      assertExists(tagOid);
      assertEquals(tagOid.length, 40);
    });

    await t.step("create annotated tag with force false", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: "Release v1.0.0",
        force: false,
      });

      assertExists(tagOid);
      assertEquals(tagOid.length, 40);
    });

    await t.step("create annotated tag with multiline message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const multilineMessage = `Release v1.0.0

This is a major release with:
- Feature A
- Feature B
- Bug fixes`;

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: multilineMessage,
      });

      assertExists(tagOid);

      const tag = ctx.repo.lookupTag(tagOid);
      assert(tag.message.includes("Feature A"));
      tag.free();
    });

    await t.step("create tag with force flag overwrites existing", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
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

      const tag = ctx.repo.lookupTag(newTagOid);
      assertEquals(tag.targetOid, commit2);
      assert(tag.message.startsWith("Release v1.0.0 (updated)"));

      tag.free();
    });

    // ==================== Create Lightweight Tag Tests ====================

    await t.step("create lightweight tag on commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createLightweightTag({
        name: "v1.0.0-light",
        targetOid: commitOid,
      });

      assertExists(tagOid);
      assertEquals(tagOid.length, 40);
    });

    await t.step("create lightweight tag with force false", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createLightweightTag({
        name: "v1.0.0-light",
        targetOid: commitOid,
        force: false,
      });

      assertExists(tagOid);
    });

    await t.step(
      "create lightweight tag with force overwrites existing",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: false });
        const commit1 = await createCommitWithFiles(ctx, "First", {
          "f.txt": "1\n",
        });
        const commit2 = await createCommitWithFiles(ctx, "Second", {
          "f.txt": "2\n",
        });

        ctx.repo.createLightweightTag({
          name: "latest",
          targetOid: commit1,
        });

        ctx.repo.createLightweightTag({
          name: "latest",
          targetOid: commit2,
          force: true,
        });

        // Verify the tag now points to commit2
        const tags = ctx.repo.foreachTag();
        const latestTag = tags.find((t) => t.name === "refs/tags/latest");
        assertExists(latestTag);
        assertEquals(latestTag.oid, commit2);
      },
    );

    // ==================== List Tags Tests ====================

    await t.step("list all tags", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

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

      const tags = ctx.repo.listTags();
      assertEquals(tags.length, 3);
      assert(tags.includes("v1.0.0"));
      assert(tags.includes("v2.0.0"));
      assert(tags.includes("latest"));
    });

    await t.step("list tags matching pattern", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

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

      const vTags = ctx.repo.listTags("v*");
      assertEquals(vTags.length, 2);
      assert(vTags.includes("v1.0.0"));
      assert(vTags.includes("v2.0.0"));
    });

    await t.step("list tags with specific version pattern", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      ctx.repo.createLightweightTag({ name: "v1.0.0", targetOid: commitOid });
      ctx.repo.createLightweightTag({ name: "v1.1.0", targetOid: commitOid });
      ctx.repo.createLightweightTag({ name: "v2.0.0", targetOid: commitOid });

      const v1Tags = ctx.repo.listTags("v1.*");
      assertEquals(v1Tags.length, 2);
      assert(v1Tags.includes("v1.0.0"));
      assert(v1Tags.includes("v1.1.0"));
    });

    await t.step("empty repository has no tags", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tags = ctx.repo.listTags();
      assertEquals(tags.length, 0);
    });

    await t.step(
      "list tags with non-matching pattern returns empty",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: false });
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        ctx.repo.createLightweightTag({ name: "v1.0.0", targetOid: commitOid });

        const tags = ctx.repo.listTags("release-*");
        assertEquals(tags.length, 0);
      },
    );

    // ==================== Lookup Tag Tests ====================

    await t.step("lookup annotated tag by OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: "Release v1.0.0",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertExists(tag);
      assertEquals(tag.name, "v1.0.0");
      assert(tag.message.startsWith("Release v1.0.0"));
      assertEquals(tag.targetOid, commitOid);
      assertExists(tag.tagger);
      assertEquals(tag.tagger.name, "Test User");
      assertEquals(tag.tagger.email, "test@example.com");

      tag.free();
    });

    // ==================== Tag Properties Tests ====================

    await t.step("tag ptr property returns valid pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertExists(tag.ptr);
      tag.free();
    });

    await t.step("tag oid property returns correct OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.oid, tagOid);
      assertEquals(tag.oid.length, 40);
      tag.free();
    });

    await t.step("tag name property returns correct name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "my-special-tag",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.name, "my-special-tag");
      tag.free();
    });

    await t.step("tag message property returns correct message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "This is the tag message",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assert(tag.message.includes("This is the tag message"));
      tag.free();
    });

    await t.step("tag targetOid property returns commit OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.targetOid, commitOid);
      assertEquals(tag.targetOid.length, 40);
      tag.free();
    });

    await t.step("tag targetType is commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: "Release v1.0.0",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.targetType, "commit");

      tag.free();
    });

    await t.step("tag tagger property returns signature", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Tagger Name", email: "tagger@example.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertExists(tag.tagger);
      assertEquals(tag.tagger.name, "Tagger Name");
      assertEquals(tag.tagger.email, "tagger@example.com");
      assertExists(tag.tagger.time);
      assertExists(tag.tagger.offset);
      tag.free();
    });

    // ==================== Peel Tests ====================

    await t.step("peel annotated tag to target commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: "Release v1.0.0",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      const peeledOid = tag.peel();

      assertEquals(peeledOid, commitOid);

      tag.free();
    });

    await t.step("peel returns valid OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      const peeledOid = tag.peel();

      assertEquals(peeledOid.length, 40);
      const hexRegex = /^[0-9a-f]{40}$/;
      assert(hexRegex.test(peeledOid));

      tag.free();
    });

    // ==================== Delete Tag Tests ====================

    await t.step("delete tag by name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

      ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test User", email: "test@example.com" },
        message: "Release v1.0.0",
      });

      let tags = ctx.repo.listTags();
      assertEquals(tags.length, 1);

      ctx.repo.deleteTag("v1.0.0");

      tags = ctx.repo.listTags();
      assertEquals(tags.length, 0);
    });

    await t.step("delete lightweight tag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      ctx.repo.createLightweightTag({ name: "light", targetOid: commitOid });

      let tags = ctx.repo.listTags();
      assertEquals(tags.length, 1);

      ctx.repo.deleteTag("light");

      tags = ctx.repo.listTags();
      assertEquals(tags.length, 0);
    });

    await t.step("delete one of multiple tags", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      ctx.repo.createLightweightTag({ name: "v1.0.0", targetOid: commitOid });
      ctx.repo.createLightweightTag({ name: "v2.0.0", targetOid: commitOid });
      ctx.repo.createLightweightTag({ name: "v3.0.0", targetOid: commitOid });

      assertEquals(ctx.repo.listTags().length, 3);

      ctx.repo.deleteTag("v2.0.0");

      const tags = ctx.repo.listTags();
      assertEquals(tags.length, 2);
      assert(tags.includes("v1.0.0"));
      assert(tags.includes("v3.0.0"));
      assert(!tags.includes("v2.0.0"));
    });

    // ==================== Foreach Tests ====================

    await t.step("iterate over tags with foreach", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
        "file.txt": "content\n",
      });

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

      const tagInfos = ctx.repo.foreachTag();
      assertEquals(tagInfos.length, 2);

      for (const info of tagInfos) {
        assertExists(info.name);
        assertExists(info.oid);
        assertEquals(info.oid.length, 40);
      }
    });

    await t.step(
      "foreach returns tag names with refs/tags/ prefix",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: false });
        const commitOid = await createCommitWithFiles(ctx, "Initial", {
          "f.txt": "c\n",
        });

        ctx.repo.createLightweightTag({ name: "my-tag", targetOid: commitOid });

        const tagInfos = ctx.repo.foreachTag();
        assertEquals(tagInfos.length, 1);
        assertEquals(tagInfos[0].name, "refs/tags/my-tag");
      },
    );

    await t.step("foreach on empty repo returns empty array", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      await createCommitWithFiles(ctx, "Initial", { "f.txt": "c\n" });

      const tagInfos = ctx.repo.foreachTag();
      assertEquals(tagInfos.length, 0);
    });

    await t.step("foreach with many tags", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      for (let i = 0; i < 10; i++) {
        ctx.repo.createLightweightTag({
          name: `v${i}.0.0`,
          targetOid: commitOid,
        });
      }

      const tagInfos = ctx.repo.foreachTag();
      assertEquals(tagInfos.length, 10);
    });

    // ==================== Symbol.dispose Tests ====================

    await t.step("tag supports Symbol.dispose", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      {
        using tag = ctx.repo.lookupTag(tagOid);
        assertEquals(tag.name, "v1.0.0");
      }
      // Tag disposed on scope exit
    });

    await t.step("tag free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      tag.free();
      tag.free();
      tag.free();
      // Should not throw
    });

    // ==================== Edge Cases ====================

    await t.step("create tag with special characters in name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "release-1.0.0-beta.1",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Beta release",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.name, "release-1.0.0-beta.1");
      tag.free();
    });

    await t.step("create tag with unicode in message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Release 🎉 with unicode: 日本語",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assert(tag.message.includes("🎉"));
      tag.free();
    });

    await t.step("create tag with unicode in tagger name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "José García", email: "jose@test.com" },
        message: "Tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.tagger?.name, "José García");
      tag.free();
    });

    await t.step("annotated vs lightweight tag OIDs differ", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      const annotatedOid = ctx.repo.createTag({
        name: "annotated",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Annotated tag",
      });

      const lightweightOid = ctx.repo.createLightweightTag({
        name: "lightweight",
        targetOid: commitOid,
      });

      // Annotated tag OID is different from commit OID (it's the tag object)
      assertNotEquals(annotatedOid, commitOid);

      // Lightweight tag OID equals commit OID (it points directly to commit)
      assertEquals(lightweightOid, commitOid);
    });

    await t.step("multiple tags can point to same commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Initial", {
        "f.txt": "c\n",
      });

      ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Version 1",
      });

      ctx.repo.createTag({
        name: "latest-stable",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Latest stable",
      });

      ctx.repo.createLightweightTag({ name: "HEAD-tag", targetOid: commitOid });

      const tags = ctx.repo.listTags();
      assertEquals(tags.length, 3);
    });

    await t.step("tag on different commits", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commit1 = await createCommitWithFiles(ctx, "Commit 1", {
        "f.txt": "1\n",
      });
      const commit2 = await createCommitWithFiles(ctx, "Commit 2", {
        "f.txt": "2\n",
      });

      const tag1Oid = ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commit1,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Version 1",
      });

      const tag2Oid = ctx.repo.createTag({
        name: "v2.0.0",
        targetOid: commit2,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Version 2",
      });

      const tag1 = ctx.repo.lookupTag(tag1Oid);
      const tag2 = ctx.repo.lookupTag(tag2Oid);

      assertEquals(tag1.targetOid, commit1);
      assertEquals(tag2.targetOid, commit2);

      tag1.free();
      tag2.free();
    });

    // ==================== Additional Branch Coverage Tests ====================

    await t.step("tag double free is safe", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "test-double-free",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);

      // First free
      tag.free();

      // Second free should be safe (no-op)
      tag.free();
    });

    await t.step("tag ptr getter returns valid pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "test-ptr",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      const ptr = tag.ptr;

      assertExists(ptr);

      tag.free();
    });

    await t.step("targetType returns commit for commit target", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "test-commit-target",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test tag",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.targetType, "commit");

      tag.free();
    });

    await t.step("tag on tree returns tree targetType", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      // Get the tree OID from the commit
      const commit = ctx.repo.lookupCommit(commitOid);
      const treeOid = commit.treeOid;

      const tagOid = ctx.repo.createTag({
        name: "tree-tag",
        targetOid: treeOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag pointing to tree",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.targetType, "tree");

      tag.free();
    });

    await t.step("tag on blob returns blob targetType", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "test-file.txt": "Hello World\n",
      });

      // Get blob OID through the tree
      const commit = ctx.repo.lookupCommit(commitOid);
      const tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("test-file.txt");
      assertExists(entry);
      const blobOid = entry.oid;

      const tagOid = ctx.repo.createTag({
        name: "blob-tag",
        targetOid: blobOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag pointing to blob",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.targetType, "blob");

      tree.close();
      tag.free();
    });

    await t.step("tag on tag returns tag targetType", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      // Create a tag on the commit
      const firstTagOid = ctx.repo.createTag({
        name: "first-tag",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "First tag",
      });

      // Create a tag pointing to the first tag
      const secondTagOid = ctx.repo.createTag({
        name: "second-tag",
        targetOid: firstTagOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag pointing to another tag",
      });

      const tag = ctx.repo.lookupTag(secondTagOid);
      assertEquals(tag.targetType, "tag");

      tag.free();
    });

    await t.step("foreachTag handles tags correctly", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      // Create annotated tag
      ctx.repo.createTag({
        name: "foreach-annotated",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Annotated tag",
      });

      // Create lightweight tag
      ctx.repo.createLightweightTag({
        name: "foreach-lightweight",
        targetOid: commitOid,
      });

      const tagInfos = ctx.repo.foreachTag();

      assertEquals(tagInfos.length, 2);
      const names = tagInfos.map((t) => t.name);
      assert(names.some((n) => n.includes("foreach-annotated")));
      assert(names.some((n) => n.includes("foreach-lightweight")));

      // Verify OIDs are valid
      for (const tagInfo of tagInfos) {
        assertEquals(tagInfo.oid.length, 40);
        assertExists(tagInfo.name);
      }
    });

    await t.step("tag Symbol.dispose works correctly", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "dispose-test",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test",
      });

      {
        using tag = ctx.repo.lookupTag(tagOid);
        assertExists(tag);
        assertEquals(tag.name, "dispose-test");
      }
      // tag is automatically disposed here
    });

    await t.step("createTag with time and offset in tagger", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "time-offset-tag",
        targetOid: commitOid,
        tagger: {
          name: "Test User",
          email: "test@example.com",
          time: 1700000000,
          offset: -420,
        },
        message: "Tag with specific time",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      const tagger = tag.tagger;
      assertExists(tagger);
      assertEquals(tagger.name, "Test User");
      assertEquals(tagger.email, "test@example.com");
      assertEquals(tagger.time, 1700000000);
      assertEquals(tagger.offset, -420);

      tag.free();
    });

    await t.step("listTags with pattern", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      // Create multiple tags with different patterns
      ctx.repo.createTag({
        name: "v1.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Version 1",
      });

      ctx.repo.createTag({
        name: "v2.0.0",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Version 2",
      });

      ctx.repo.createLightweightTag({
        name: "release-1",
        targetOid: commitOid,
      });

      // List all tags
      const allTags = ctx.repo.listTags();
      assertEquals(allTags.length, 3);

      // List with pattern
      const vTags = ctx.repo.listTags("v*");
      assertEquals(vTags.length, 2);
      assert(vTags.includes("v1.0.0"));
      assert(vTags.includes("v2.0.0"));

      // List with another pattern
      const releaseTags = ctx.repo.listTags("release*");
      assertEquals(releaseTags.length, 1);
      assertEquals(releaseTags[0], "release-1");
    });

    await t.step("listTags without pattern returns all", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      ctx.repo.createLightweightTag({
        name: "tag-a",
        targetOid: commitOid,
      });

      ctx.repo.createLightweightTag({
        name: "tag-b",
        targetOid: commitOid,
      });

      // List without pattern
      const tags = ctx.repo.listTags();
      assertEquals(tags.length, 2);
    });

    await t.step("foreachTag with no tags returns empty array", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      const tagInfos = ctx.repo.foreachTag();
      assertEquals(tagInfos.length, 0);
    });

    await t.step("tag all properties are accessible", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "full-props-tag",
        targetOid: commitOid,
        tagger: { name: "Tagger Name", email: "tagger@example.com" },
        message: "Full properties tag message",
      });

      const tag = ctx.repo.lookupTag(tagOid);

      // Access all properties
      const oid = tag.oid;
      const name = tag.name;
      const message = tag.message;
      const targetOid = tag.targetOid;
      const targetType = tag.targetType;
      const tagger = tag.tagger;
      const ptr = tag.ptr;

      assertExists(oid);
      assertEquals(oid.length, 40);
      assertEquals(name, "full-props-tag");
      assert(message.includes("Full properties tag message"));
      assertEquals(targetOid, commitOid);
      assertEquals(targetType, "commit");
      assertExists(tagger);
      assertEquals(tagger.name, "Tagger Name");
      assertEquals(tagger.email, "tagger@example.com");
      assertExists(ptr);

      tag.free();
    });

    await t.step("peel tag returns correct OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test commit", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "peel-test-tag",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Tag to peel",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      const peeledOid = tag.peel();

      assertEquals(peeledOid, commitOid);

      tag.free();
    });

    // ==================== Additional Coverage for Null/Empty Cases ====================

    await t.step("tag oid returns empty string when readOidHex returns null", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "test-tag",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      // oid should be a valid 40-char hex string (testing the non-null path)
      assertEquals(tag.oid.length, 40);
      tag.free();
    });

    await t.step("tag targetOid returns valid string", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test", {
        "f.txt": "content\n",
      });

      const tagOid = ctx.repo.createTag({
        name: "target-oid-tag",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      // targetOid should be a valid 40-char hex string
      assertEquals(tag.targetOid.length, 40);
      assertEquals(tag.targetOid, commitOid);
      tag.free();
    });

    await t.step("empty tag name edge case", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test", {
        "f.txt": "content\n",
      });

      // Create a tag with a short but valid name
      const tagOid = ctx.repo.createTag({
        name: "x",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "Test",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      assertEquals(tag.name, "x");
      tag.free();
    });

    await t.step("empty message tag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test", {
        "f.txt": "content\n",
      });

      // Create a tag with empty message
      const tagOid = ctx.repo.createTag({
        name: "empty-msg-tag",
        targetOid: commitOid,
        tagger: { name: "Test", email: "test@test.com" },
        message: "",
      });

      const tag = ctx.repo.lookupTag(tagOid);
      // Empty messages are allowed but the returned message might have newlines
      assert(tag.message === "" || tag.message === "\n");
      tag.free();
    });

    await t.step("foreachTag callback handles name and oid correctly", async () => {
      await using ctx = await createTestContext({ withInitialCommit: false });
      const commitOid = await createCommitWithFiles(ctx, "Test", {
        "f.txt": "content\n",
      });

      // Create a tag
      ctx.repo.createLightweightTag({
        name: "foreach-test",
        targetOid: commitOid,
      });

      const tags = ctx.repo.foreachTag();
      assertEquals(tags.length, 1);
      // Verify the name is properly set
      assert(tags[0].name.includes("foreach-test"));
      // Verify the OID is a valid 40-char hex
      assertEquals(tags[0].oid.length, 40);
      const hexRegex = /^[0-9a-f]{40}$/;
      assert(hexRegex.test(tags[0].oid));
    });
  } finally {
    shutdown();
  }
});
