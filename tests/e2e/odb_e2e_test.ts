/**
 * End-to-end tests for ODB (Object Database) operations
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";
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

  shutdown();
});
