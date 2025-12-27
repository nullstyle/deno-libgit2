/**
 * End-to-end tests for remote operations
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { cleanupTestContext, createTestContext } from "./helpers.ts";
import { init, shutdown } from "../../mod.ts";

Deno.test("Remote E2E Tests", async (t) => {
  init();

  await t.step("list remotes - empty repository", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      const remotes = ctx.repo.listRemotes();

      assertExists(remotes);
      assertEquals(remotes.length, 0);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("create remote", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

      const remotes = ctx.repo.listRemotes();
      assertEquals(remotes.length, 1);
      assertEquals(remotes[0], "origin");
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("lookup remote", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

      const remote = ctx.repo.lookupRemote("origin");
      assertExists(remote);
      assertEquals(remote.name, "origin");
      assertEquals(remote.url, "https://github.com/example/repo.git");

      remote.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("get remote URL", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("upstream", "https://github.com/upstream/repo.git");

      const remote = ctx.repo.lookupRemote("upstream");
      assertExists(remote);
      assertEquals(remote.url, "https://github.com/upstream/repo.git");

      remote.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("set remote URL", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/old/repo.git");
      ctx.repo.setRemoteUrl("origin", "https://github.com/new/repo.git");

      const remote = ctx.repo.lookupRemote("origin");
      assertExists(remote);
      assertEquals(remote.url, "https://github.com/new/repo.git");

      remote.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("get push URL - defaults to fetch URL", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

      const remote = ctx.repo.lookupRemote("origin");
      assertExists(remote);
      // Push URL is null if not explicitly set (defaults to fetch URL)
      assertEquals(remote.pushUrl, null);

      remote.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("set push URL", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/example/repo.git");
      ctx.repo.setRemotePushUrl("origin", "git@github.com:example/repo.git");

      const remote = ctx.repo.lookupRemote("origin");
      assertExists(remote);
      assertEquals(remote.pushUrl, "git@github.com:example/repo.git");

      remote.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("delete remote", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

      let remotes = ctx.repo.listRemotes();
      assertEquals(remotes.length, 1);

      ctx.repo.deleteRemote("origin");

      remotes = ctx.repo.listRemotes();
      assertEquals(remotes.length, 0);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("multiple remotes", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/origin/repo.git");
      ctx.repo.createRemote("upstream", "https://github.com/upstream/repo.git");
      ctx.repo.createRemote("fork", "https://github.com/fork/repo.git");

      const remotes = ctx.repo.listRemotes();
      assertEquals(remotes.length, 3);
      assert(remotes.includes("origin"));
      assert(remotes.includes("upstream"));
      assert(remotes.includes("fork"));
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("rename remote", async () => {
    const ctx = await createTestContext({ withInitialCommit: true });
    try {
      ctx.repo.createRemote("origin", "https://github.com/example/repo.git");

      ctx.repo.renameRemote("origin", "upstream");

      const remotes = ctx.repo.listRemotes();
      assertEquals(remotes.length, 1);
      assertEquals(remotes[0], "upstream");

      const remote = ctx.repo.lookupRemote("upstream");
      assertExists(remote);
      assertEquals(remote.url, "https://github.com/example/repo.git");

      remote.free();
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  shutdown();
});
