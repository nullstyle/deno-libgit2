/**
 * End-to-end tests for ODB (Object Database) operations
 */

import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { createCommitWithFiles, createTestContext } from "./helpers.ts";
import { GitObjectType, init, shutdown, Tree } from "../../mod.ts";

Deno.test("ODB E2E Tests", async (t) => {
  await init();

  await t.step("get odb from repository", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();
    assertExists(odb);
    odb.free();
  });

  await t.step("check object exists - existing object", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    const exists = odb.exists(headOid);
    assertEquals(exists, true);

    odb.free();
  });

  await t.step("check object exists - non-existing object", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // Random non-existing OID
    const exists = odb.exists("0000000000000000000000000000000000000000");
    assertEquals(exists, false);

    odb.free();
  });

  await t.step("read object header", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    const header = odb.readHeader(headOid);
    assertExists(header);
    assertEquals(header.type, GitObjectType.COMMIT);
    assert(header.size > 0);

    odb.free();
  });

  await t.step("read object", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    const obj = odb.read(headOid);
    assertExists(obj);
    assertEquals(obj.type, GitObjectType.COMMIT);
    assert(obj.size > 0);
    assertExists(obj.data);
    assertEquals(obj.oid, headOid);

    obj.free();
    odb.free();
  });

  await t.step("read blob object", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });
    // Create a file and commit it
    await createCommitWithFiles(ctx, "Add test file", {
      "test.txt": "Hello, World!",
    });

    // Get the blob OID
    const headOid = ctx.repo.headOid();

    // Get the tree entry to find the blob OID
    const commit = ctx.repo.lookupCommit(headOid);
    const tree = Tree.lookup(ctx.repo, commit.treeOid);
    assertExists(tree);
    const entry = tree.getByName("test.txt");
    assertExists(entry);

    const odb = ctx.repo.odb();
    const obj = odb.read(entry.oid);

    assertExists(obj);
    assertEquals(obj.type, GitObjectType.BLOB);

    // The data should contain our file content
    const decoder = new TextDecoder();
    const content = decoder.decode(obj.data);
    assertEquals(content, "Hello, World!");

    obj.free();
    odb.free();
  });

  await t.step("hash data without writing", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    const data = new TextEncoder().encode("Hello, World!");
    const oid = odb.hash(data, GitObjectType.BLOB);

    assertExists(oid);
    assertEquals(oid.length, 40); // SHA-1 hex string

    // The hash should be consistent
    const oid2 = odb.hash(data, GitObjectType.BLOB);
    assertEquals(oid, oid2);

    odb.free();
  });

  await t.step("write object to database", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    const data = new TextEncoder().encode("Test blob content");
    const oid = odb.write(data, GitObjectType.BLOB);

    assertExists(oid);
    assertEquals(oid.length, 40);

    // Verify the object exists
    const exists = odb.exists(oid);
    assertEquals(exists, true);

    // Verify we can read it back
    const obj = odb.read(oid);
    assertEquals(obj.type, GitObjectType.BLOB);

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(obj.data), "Test blob content");

    obj.free();
    odb.free();
  });

  await t.step("exists with prefix", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    // Use first 7 characters as prefix
    const prefix = headOid.slice(0, 7);
    const result = odb.existsPrefix(prefix);

    assertExists(result);
    assertEquals(result, headOid);

    odb.free();
  });

  await t.step("exists with prefix - non-existent returns null", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // Use a prefix that doesn't exist
    const result = odb.existsPrefix("dead");
    assertEquals(result, null);

    odb.free();
  });

  await t.step("exists with prefix - short prefix throws error", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // Prefix must be at least 4 characters
    assertThrows(
      () => odb.existsPrefix("abc"),
      Error,
      "Prefix must be at least 4 characters",
    );

    odb.free();
  });

  await t.step("OdbObject double free is safe", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    const obj = odb.read(headOid);
    assertExists(obj);

    // First free
    obj.free();

    // Second free should be safe (no-op)
    obj.free();

    odb.free();
  });

  await t.step("Odb double free is safe", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // First free
    odb.free();

    // Second free should be safe (no-op)
    odb.free();
  });

  await t.step("read non-existent object throws error", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // Use a non-zero OID that doesn't exist
    const nonExistentOid = "1234567890abcdef1234567890abcdef12345678";

    assertThrows(
      () => odb.read(nonExistentOid),
      Error,
    );

    odb.free();
  });

  await t.step("readHeader non-existent object throws error", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // Use a non-zero OID that doesn't exist
    const nonExistentOid = "1234567890abcdef1234567890abcdef12345678";

    assertThrows(
      () => odb.readHeader(nonExistentOid),
      Error,
    );

    odb.free();
  });

  await t.step("Odb ptr getter returns valid pointer", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    const ptr = odb.ptr;
    assertExists(ptr);

    odb.free();
  });

  await t.step("OdbObject properties are accessible", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    const obj = odb.read(headOid);

    // Access all properties
    const oid = obj.oid;
    const type = obj.type;
    const size = obj.size;
    const data = obj.data;

    assertExists(oid);
    assertEquals(oid.length, 40);
    assertEquals(type, GitObjectType.COMMIT);
    assert(size > 0);
    assert(data.length > 0);

    obj.free();
    odb.free();
  });

  await t.step("exists returns false for zero OID", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    // Zero OID should not exist
    const exists = odb.exists("0000000000000000000000000000000000000000");
    assertEquals(exists, false);

    odb.free();
  });

  await t.step("existsPrefix with longer prefix", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    // Use first 12 characters as prefix
    const prefix = headOid.slice(0, 12);
    const result = odb.existsPrefix(prefix);

    assertExists(result);
    assertEquals(result, headOid);

    odb.free();
  });

  await t.step("existsPrefix with minimum length (4 chars)", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    // Use exactly 4 characters
    const prefix = headOid.slice(0, 4);
    const result = odb.existsPrefix(prefix);

    // Result could be null if ambiguous, or the full OID if unique
    if (result !== null) {
      assertEquals(result.length, 40);
    }

    odb.free();
  });

  await t.step("read tree object", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Add file", {
      "test.txt": "content",
    });

    const headOid = ctx.repo.headOid();
    const commit = ctx.repo.lookupCommit(headOid);
    const treeOid = commit.treeOid;

    const odb = ctx.repo.odb();
    const obj = odb.read(treeOid);

    assertExists(obj);
    assertEquals(obj.type, GitObjectType.TREE);
    assert(obj.size > 0);
    assertEquals(obj.oid, treeOid);

    obj.free();
    odb.free();
  });

  await t.step("hash different data types produce different OIDs", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const odb = ctx.repo.odb();

    const data = new TextEncoder().encode("Test content");

    // Hash as blob
    const blobOid = odb.hash(data, GitObjectType.BLOB);

    // Hash as commit (will be different due to type prefix)
    const commitOid = odb.hash(data, GitObjectType.COMMIT);

    assertExists(blobOid);
    assertExists(commitOid);
    assert(
      blobOid !== commitOid,
      "Different types should produce different OIDs",
    );

    odb.free();
  });

  await t.step("read empty blob via git command", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

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
      // Create an empty blob using git hash-object
      const cmd = new Deno.Command("git", {
        args: ["hash-object", "-w", "--stdin"],
        cwd: ctx.repoPath,
        stdin: "piped",
        stdout: "piped",
        stderr: "null",
      });

      const process = cmd.spawn();
      const writer = process.stdin.getWriter();
      // Write nothing - creates empty blob
      await writer.close();

      const { stdout } = await process.output();
      const emptyBlobOid = new TextDecoder().decode(stdout).trim();

      // The well-known empty blob SHA-1
      assertEquals(emptyBlobOid, "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");

      // Now read it through ODB
      const odb = ctx.repo.odb();
      const obj = odb.read(emptyBlobOid);

      assertExists(obj);
      assertEquals(obj.type, GitObjectType.BLOB);
      assertEquals(obj.size, 0);
      // This should trigger the empty data branch
      assertEquals(obj.data.length, 0);

      obj.free();
      odb.free();
    }
  });

  await t.step("OdbObject Symbol.dispose works correctly", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const headOid = ctx.repo.headOid();
    const odb = ctx.repo.odb();

    {
      using obj = odb.read(headOid);
      assertExists(obj);
      assertEquals(obj.type, GitObjectType.COMMIT);
    }
    // obj is automatically disposed here

    odb.free();
  });

  await t.step("Odb Symbol.dispose works correctly", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

    {
      using odb = ctx.repo.odb();
      assertExists(odb);
      const exists = odb.exists(ctx.repo.headOid());
      assertEquals(exists, true);
    }
    // odb is automatically disposed here
  });

  shutdown();
});
