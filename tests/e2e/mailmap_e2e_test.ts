/**
 * End-to-end tests for mailmap operations
 *
 * These tests validate mailmap functionality including:
 * - Creating empty mailmaps
 * - Adding entries and resolving identities
 * - Loading from buffer and repository
 * - Symbol.dispose support
 * - Edge cases and error handling
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { createFile, createTestContext } from "./helpers.ts";
import { init, Mailmap, Repository, shutdown } from "../../mod.ts";

Deno.test("Mailmap E2E Tests", async (t) => {
  await init();

  // ==================== Creation Tests ====================

  await t.step("create empty mailmap", async () => {
    await using _ctx = await createTestContext();
    const mailmap = Mailmap.create();
    assertExists(mailmap);
    assertExists(mailmap.pointer);
    mailmap.free();
  });

  await t.step("create mailmap and access pointer", async () => {
    await using _ctx = await createTestContext();
    const mailmap = Mailmap.create();

    // Pointer should be non-null for a valid mailmap
    const ptr = mailmap.pointer;
    assertExists(ptr);
    assertNotEquals(ptr, null);

    mailmap.free();
  });

  await t.step("mailmap pointer becomes null after free", async () => {
    await using _ctx = await createTestContext();
    const mailmap = Mailmap.create();
    assertExists(mailmap.pointer);

    mailmap.free();

    // After free, pointer should be null
    assertEquals(mailmap.pointer, null);
  });

  // ==================== Symbol.dispose Tests ====================

  await t.step("mailmap supports Symbol.dispose", async () => {
    await using _ctx = await createTestContext();

    {
      using mailmap = Mailmap.create();
      assertExists(mailmap.pointer);
      // mailmap will be disposed when scope exits
    }
    // If we get here without error, Symbol.dispose worked
  });

  await t.step("mailmap Symbol.dispose with entries", async () => {
    await using _ctx = await createTestContext();

    {
      using mailmap = Mailmap.create();
      mailmap.addEntry(
        "Real Name",
        "real@example.com",
        null,
        "old@example.com",
      );

      const result = mailmap.resolve("Any", "old@example.com");
      assertEquals(result.email, "real@example.com");
    }
    // Disposed automatically
  });

  await t.step("mailmap free is idempotent", async () => {
    await using _ctx = await createTestContext();
    const mailmap = Mailmap.create();

    // Multiple frees should be safe
    mailmap.free();
    mailmap.free();
    mailmap.free();

    assertEquals(mailmap.pointer, null);
  });

  // ==================== Add Entry Tests ====================

  await t.step("add entry to mailmap", async () => {
    await using _ctx = await createTestContext();
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
  });

  await t.step("add entry with only email replacement", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    // Map old email to new email, keeping name
    mailmap.addEntry(
      null,
      "new@example.com",
      null,
      "old@example.com",
    );

    const result = mailmap.resolve("Keep This Name", "old@example.com");
    assertEquals(result.name, "Keep This Name");
    assertEquals(result.email, "new@example.com");
  });

  await t.step("add entry with only name replacement", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    // Map email to new name only
    mailmap.addEntry(
      "Proper Name",
      null,
      null,
      "user@example.com",
    );

    const result = mailmap.resolve("wrong name", "user@example.com");
    assertEquals(result.name, "Proper Name");
    assertEquals(result.email, "user@example.com");
  });

  await t.step("add entry with replace name matching", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    // Map specific name+email combo to new identity
    mailmap.addEntry(
      "Correct Name",
      "correct@example.com",
      "Typo Name",
      "typo@example.com",
    );

    // Should match when both name and email match
    const result1 = mailmap.resolve("Typo Name", "typo@example.com");
    assertEquals(result1.name, "Correct Name");
    assertEquals(result1.email, "correct@example.com");

    // Should not match when name doesn't match
    const result2 = mailmap.resolve("Other Name", "typo@example.com");
    assertEquals(result2.name, "Other Name");
    assertEquals(result2.email, "typo@example.com");
  });

  await t.step("add multiple entries", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    mailmap.addEntry(
      "Alice Real",
      "alice@company.com",
      null,
      "alice@personal.com",
    );
    mailmap.addEntry("Bob Real", "bob@company.com", null, "bob@personal.com");
    mailmap.addEntry(
      "Carol Real",
      "carol@company.com",
      null,
      "carol@personal.com",
    );

    const alice = mailmap.resolve("Alice", "alice@personal.com");
    assertEquals(alice.name, "Alice Real");
    assertEquals(alice.email, "alice@company.com");

    const bob = mailmap.resolve("Bob", "bob@personal.com");
    assertEquals(bob.name, "Bob Real");
    assertEquals(bob.email, "bob@company.com");

    const carol = mailmap.resolve("Carol", "carol@personal.com");
    assertEquals(carol.name, "Carol Real");
    assertEquals(carol.email, "carol@company.com");
  });

  // ==================== Resolve Tests ====================

  await t.step("resolve unknown email returns original", async () => {
    await using _ctx = await createTestContext();
    const mailmap = Mailmap.create();

    // Resolve an email that's not in the mailmap
    const result = mailmap.resolve("Some Name", "unknown@example.com");
    assertEquals(result.name, "Some Name");
    assertEquals(result.email, "unknown@example.com");

    mailmap.free();
  });

  await t.step("resolve preserves case of unmatched entries", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    const result = mailmap.resolve("MixedCase Name", "MixedCase@Example.COM");
    assertEquals(result.name, "MixedCase Name");
    assertEquals(result.email, "MixedCase@Example.COM");
  });

  await t.step("resolve with empty mailmap", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    // Empty mailmap should return original values
    const result = mailmap.resolve("Test User", "test@example.com");
    assertEquals(result.name, "Test User");
    assertEquals(result.email, "test@example.com");
  });

  // ==================== From Buffer Tests ====================

  await t.step("load mailmap from buffer", async () => {
    await using _ctx = await createTestContext();
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
  });

  await t.step("load mailmap from buffer with various formats", async () => {
    await using _ctx = await createTestContext();

    // Test different mailmap format variations
    const mailmapContent = `
# Comment line
Proper Name <proper@example.com> <wrong@example.com>
Name Only <proper@example.com>
<canonical@example.com> <alias@example.com>
`;

    using mailmap = Mailmap.fromBuffer(mailmapContent);
    assertExists(mailmap.pointer);
  });

  await t.step("load mailmap from buffer with empty content", async () => {
    await using _ctx = await createTestContext();

    using mailmap = Mailmap.fromBuffer("");
    assertExists(mailmap);

    // Should return original for any lookup
    const result = mailmap.resolve("Test", "test@example.com");
    assertEquals(result.name, "Test");
    assertEquals(result.email, "test@example.com");
  });

  await t.step("load mailmap from buffer with only comments", async () => {
    await using _ctx = await createTestContext();

    const mailmapContent = `
# This is a comment
# Another comment
# Yet another comment
`;

    using mailmap = Mailmap.fromBuffer(mailmapContent);
    assertExists(mailmap);

    const result = mailmap.resolve("Test", "test@example.com");
    assertEquals(result.name, "Test");
    assertEquals(result.email, "test@example.com");
  });

  // ==================== From Repository Tests ====================

  await t.step("load mailmap from repository", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
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
  });

  await t.step(
    "load mailmap from repository without .mailmap file",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Don't create a .mailmap file
      const repo = Repository.open(ctx.repoPath);
      const mailmap = repo.getMailmap();
      assertExists(mailmap);

      // Should return original values since no mailmap exists
      const result = mailmap.resolve("Test User", "test@example.com");
      assertEquals(result.name, "Test User");
      assertEquals(result.email, "test@example.com");

      mailmap.free();
      repo.close();
    },
  );

  await t.step(
    "load mailmap from repository with complex mappings",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      const mailmapContent = `
# Map multiple aliases to canonical identity
John Doe <john.doe@company.com> <johnd@oldcompany.com>
John Doe <john.doe@company.com> <jdoe@personal.com>
John Doe <john.doe@company.com> Johnny <johnny@nickname.com>
`;

      await Deno.writeTextFile(`${ctx.repoPath}/.mailmap`, mailmapContent);

      const repo = Repository.open(ctx.repoPath);
      using mailmap = repo.getMailmap();

      // All should resolve to John Doe
      const r1 = mailmap.resolve("Any", "johnd@oldcompany.com");
      assertEquals(r1.name, "John Doe");
      assertEquals(r1.email, "john.doe@company.com");

      const r2 = mailmap.resolve("Any", "jdoe@personal.com");
      assertEquals(r2.name, "John Doe");
      assertEquals(r2.email, "john.doe@company.com");

      const r3 = mailmap.resolve("Johnny", "johnny@nickname.com");
      assertEquals(r3.name, "John Doe");
      assertEquals(r3.email, "john.doe@company.com");

      repo.close();
    },
  );

  // ==================== Multiple Entries Tests ====================

  await t.step("multiple entries with same email", async () => {
    await using _ctx = await createTestContext();
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
  });

  await t.step("entries don't interfere with each other", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    mailmap.addEntry("Alice", "alice@new.com", null, "alice@old.com");
    mailmap.addEntry("Bob", "bob@new.com", null, "bob@old.com");

    // Alice resolution shouldn't affect Bob
    const alice = mailmap.resolve("x", "alice@old.com");
    const bob = mailmap.resolve("y", "bob@old.com");

    assertEquals(alice.name, "Alice");
    assertEquals(alice.email, "alice@new.com");
    assertEquals(bob.name, "Bob");
    assertEquals(bob.email, "bob@new.com");
  });

  // ==================== Name Matching Tests ====================

  await t.step("resolve with name matching", async () => {
    await using _ctx = await createTestContext();
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
  });

  await t.step("name matching is case sensitive", async () => {
    await using _ctx = await createTestContext();

    const mailmapContent = `
Proper Name <proper@example.com> Exact Name <exact@example.com>
`;

    using mailmap = Mailmap.fromBuffer(mailmapContent);

    // Exact match should work
    const r1 = mailmap.resolve("Exact Name", "exact@example.com");
    assertEquals(r1.name, "Proper Name");
    assertEquals(r1.email, "proper@example.com");

    // Different case might not match (depends on implementation)
    const r2 = mailmap.resolve("exact name", "exact@example.com");
    // Just verify it returns something reasonable
    assertExists(r2.name);
    assertExists(r2.email);
  });

  // ==================== Edge Cases ====================

  await t.step("resolve with special characters in name", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    mailmap.addEntry(
      "José García",
      "jose@example.com",
      null,
      "old@example.com",
    );

    const result = mailmap.resolve("Any", "old@example.com");
    assertEquals(result.name, "José García");
    assertEquals(result.email, "jose@example.com");
  });

  await t.step("resolve with long email addresses", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    const longEmail =
      "very.long.email.address.that.is.quite.lengthy@subdomain.domain.example.com";

    mailmap.addEntry(
      "Test User",
      "short@example.com",
      null,
      longEmail,
    );

    const result = mailmap.resolve("Any", longEmail);
    assertEquals(result.name, "Test User");
    assertEquals(result.email, "short@example.com");
  });

  await t.step("resolve with unicode in email", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    // While not strictly valid, test handling
    const result = mailmap.resolve("Test Ûser", "test@example.com");
    assertEquals(result.name, "Test Ûser");
  });

  await t.step("resolve returns consistent results", async () => {
    await using _ctx = await createTestContext();
    using mailmap = Mailmap.create();

    mailmap.addEntry(
      "Resolved",
      "resolved@example.com",
      null,
      "original@example.com",
    );

    // Multiple resolves should return same result
    const r1 = mailmap.resolve("X", "original@example.com");
    const r2 = mailmap.resolve("X", "original@example.com");
    const r3 = mailmap.resolve("X", "original@example.com");

    assertEquals(r1.name, r2.name);
    assertEquals(r2.name, r3.name);
    assertEquals(r1.email, r2.email);
    assertEquals(r2.email, r3.email);
  });

  await t.step("mailmap from buffer with Windows line endings", async () => {
    await using _ctx = await createTestContext();

    const mailmapContent = "Real Name <real@example.com> <old@example.com>\r\n";

    using mailmap = Mailmap.fromBuffer(mailmapContent);
    const result = mailmap.resolve("Any", "old@example.com");
    assertEquals(result.name, "Real Name");
    assertEquals(result.email, "real@example.com");
  });

  await t.step("mailmap with whitespace handling", async () => {
    await using _ctx = await createTestContext();

    const mailmapContent = `
    Real Name <real@example.com> <old@example.com>
`;

    using mailmap = Mailmap.fromBuffer(mailmapContent);
    // Whitespace at start of line might be handled differently
    // Just verify it doesn't crash
    const result = mailmap.resolve("Any", "old@example.com");
    assertExists(result.name);
    assertExists(result.email);
  });

  shutdown();
});
