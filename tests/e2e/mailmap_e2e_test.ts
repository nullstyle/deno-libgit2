/**
 * End-to-end tests for mailmap operations
 */

import { assertEquals, assertExists } from "@std/assert";
import { cleanupTestContext, createTestContext } from "./helpers.ts";
import { init, Mailmap, Repository, shutdown } from "../../mod.ts";

Deno.test("Mailmap E2E Tests", async (t) => {
  init();

  await t.step("create empty mailmap", async () => {
    const ctx = await createTestContext();
    try {
      const mailmap = Mailmap.create();
      assertExists(mailmap);
      mailmap.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("add entry to mailmap", async () => {
    const ctx = await createTestContext();
    try {
      const mailmap = Mailmap.create();

      // Add an entry mapping old email to new name/email
      mailmap.addEntry(
        "Real Name",
        "real@example.com",
        null,
        "old@example.com",
      );

      // Resolve the old email
      const result = mailmap.resolve("Old Name", "old@example.com");
      assertEquals(result.name, "Real Name");
      assertEquals(result.email, "real@example.com");

      mailmap.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("resolve unknown email returns original", async () => {
    const ctx = await createTestContext();
    try {
      const mailmap = Mailmap.create();

      // Resolve an email that's not in the mailmap
      const result = mailmap.resolve("Some Name", "unknown@example.com");
      assertEquals(result.name, "Some Name");
      assertEquals(result.email, "unknown@example.com");

      mailmap.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("load mailmap from buffer", async () => {
    const ctx = await createTestContext();
    try {
      const mailmapContent = `
# This is a comment
Real Name <real@example.com> <old@example.com>
Another Name <another@example.com> Old Name <oldname@example.com>
`;

      const mailmap = Mailmap.fromBuffer(mailmapContent);
      assertExists(mailmap);

      // Resolve the first entry
      const result1 = mailmap.resolve("Any Name", "old@example.com");
      assertEquals(result1.name, "Real Name");
      assertEquals(result1.email, "real@example.com");

      // Resolve the second entry (requires matching both name and email)
      const result2 = mailmap.resolve("Old Name", "oldname@example.com");
      assertEquals(result2.name, "Another Name");
      assertEquals(result2.email, "another@example.com");

      mailmap.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("load mailmap from repository", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      // Create a .mailmap file in the repository
      const mailmapPath = `${ctx.repoPath}/.mailmap`;
      await Deno.writeTextFile(
        mailmapPath,
        "Real Author <real@example.com> <commit@example.com>\n",
      );

      const repo = Repository.open(ctx.repoPath);
      const mailmap = repo.getMailmap();
      assertExists(mailmap);

      // Resolve using the mailmap
      const result = mailmap.resolve("Commit Author", "commit@example.com");
      assertEquals(result.name, "Real Author");
      assertEquals(result.email, "real@example.com");

      mailmap.free();
      repo.close();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("multiple entries with same email", async () => {
    const ctx = await createTestContext();
    try {
      const mailmap = Mailmap.create();

      // Add multiple entries for the same email
      mailmap.addEntry(
        "First Name",
        "first@example.com",
        null,
        "shared@example.com",
      );

      // The last entry should win (or first, depending on implementation)
      const result = mailmap.resolve("Any", "shared@example.com");
      assertEquals(result.email, "first@example.com");

      mailmap.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("resolve with name matching", async () => {
    const ctx = await createTestContext();
    try {
      const mailmapContent = `
Real Name <real@example.com> Specific Name <specific@example.com>
`;

      const mailmap = Mailmap.fromBuffer(mailmapContent);

      // Should only match when both name and email match
      const result1 = mailmap.resolve("Specific Name", "specific@example.com");
      assertEquals(result1.name, "Real Name");
      assertEquals(result1.email, "real@example.com");

      // Different name should not match
      const result2 = mailmap.resolve("Other Name", "specific@example.com");
      assertEquals(result2.name, "Other Name");
      assertEquals(result2.email, "specific@example.com");

      mailmap.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  shutdown();
});
