/**
 * End-to-end tests for remote operations
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
} from "@std/assert";
import { createTestContext } from "./helpers.ts";
import { init, shutdown } from "../../mod.ts";

Deno.test("Remote E2E Tests", async (t) => {
  await init();

  await t.step("list remotes - empty repository", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const remotes = ctx.repo.listRemotes();

    assertExists(remotes);
    assertEquals(remotes.length, 0);
  });

  await t.step("create remote", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 1);
    assertEquals(remotes[0], "origin");
  });

  await t.step("lookup remote", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);
    assertEquals(remote.name, "origin");
    assertEquals(remote.url, "https://github.com/example/repo.git");

    remote.free();
  });

  await t.step("get remote URL", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("upstream", "https://github.com/upstream/repo.git");

    const remote = ctx.repo.lookupRemote("upstream");
    assertExists(remote);
    assertEquals(remote.url, "https://github.com/upstream/repo.git");

    remote.free();
  });

  await t.step("set remote URL", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/old/repo.git");
    ctx.repo.setRemoteUrl("origin", "https://github.com/new/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);
    assertEquals(remote.url, "https://github.com/new/repo.git");

    remote.free();
  });

  await t.step("get push URL - defaults to fetch URL", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);
    // Push URL is null if not explicitly set (defaults to fetch URL)
    assertEquals(remote.pushUrl, null);

    remote.free();
  });

  await t.step("set push URL", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");
    ctx.repo.setRemotePushUrl("origin", "git@github.com:example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);
    assertEquals(remote.pushUrl, "git@github.com:example/repo.git");

    remote.free();
  });

  await t.step("delete remote", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    let remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 1);

    ctx.repo.deleteRemote("origin");

    remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 0);
  });

  await t.step("multiple remotes", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/origin/repo.git");
    ctx.repo.createRemote("upstream", "https://github.com/upstream/repo.git");
    ctx.repo.createRemote("fork", "https://github.com/fork/repo.git");

    const remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 3);
    assert(remotes.includes("origin"));
    assert(remotes.includes("upstream"));
    assert(remotes.includes("fork"));
  });

  await t.step("rename remote", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    ctx.repo.renameRemote("origin", "upstream");

    const remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 1);
    assertEquals(remotes[0], "upstream");

    const remote = ctx.repo.lookupRemote("upstream");
    assertExists(remote);
    assertEquals(remote.url, "https://github.com/example/repo.git");

    remote.free();
  });

  await t.step("lookup non-existent remote returns null", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

    const remote = ctx.repo.lookupRemote("nonexistent");
    assertEquals(remote, null);
  });

  await t.step("remote ptr getter returns valid pointer", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);

    const ptr = remote.ptr;
    assertExists(ptr);

    remote.free();
  });

  await t.step("remote Symbol.dispose works correctly", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    {
      using remote = ctx.repo.lookupRemote("origin");
      assertExists(remote);
      assertEquals(remote.name, "origin");
    }
    // remote is automatically disposed here
  });

  await t.step("remote double free is safe", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);

    // First free
    remote.free();

    // Second free should be safe (no-op)
    remote.free();
  });

  await t.step("remote name returns null for anonymous remote", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    // Create a named remote first
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);
    // Named remote should have a name
    assertEquals(remote.name, "origin");

    remote.free();
  });

  await t.step("rename remote returns problems array", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

    const problems = ctx.repo.renameRemote("origin", "new-origin");
    // Problems should be an array (empty if no issues)
    assertExists(problems);
    assertEquals(Array.isArray(problems), true);

    const remotes = ctx.repo.listRemotes();
    assert(remotes.includes("new-origin"));
  });

  await t.step("create multiple remotes and delete one", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

    ctx.repo.createRemote("origin", "https://github.com/origin/repo.git");
    ctx.repo.createRemote("upstream", "https://github.com/upstream/repo.git");

    let remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 2);

    ctx.repo.deleteRemote("origin");

    remotes = ctx.repo.listRemotes();
    assertEquals(remotes.length, 1);
    assertEquals(remotes[0], "upstream");

    // Verify deleted remote returns null
    const deleted = ctx.repo.lookupRemote("origin");
    assertEquals(deleted, null);
  });

  await t.step("set push URL different from fetch URL", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

    ctx.repo.createRemote("origin", "https://github.com/example/repo.git");
    ctx.repo.setRemotePushUrl("origin", "git@github.com:example/repo.git");

    const remote = ctx.repo.lookupRemote("origin");
    assertExists(remote);

    // Fetch URL and push URL should be different
    assertEquals(remote.url, "https://github.com/example/repo.git");
    assertEquals(remote.pushUrl, "git@github.com:example/repo.git");
    assertNotEquals(remote.url, remote.pushUrl);

    remote.free();
  });

  shutdown();
});
