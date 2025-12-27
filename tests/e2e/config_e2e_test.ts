/**
 * E2E tests for git config operations
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { createTestContext } from "./helpers.ts";
import { init, shutdown } from "../../mod.ts";

Deno.test("E2E Config Tests", async (t) => {
  await init();

  await t.step("get repository config", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();
    assertExists(config);
    config.free();
  });

  await t.step("set and get string value", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set a custom config value
    config.setString("test.mykey", "myvalue");

    // Get the value back using a snapshot (config needs refresh after write)
    const snapshot = config.snapshot();
    const value = snapshot.getString("test.mykey");
    assertEquals(value, "myvalue");
    snapshot.free();

    config.free();
  });

  await t.step("set and get int32 value", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set an integer config value
    config.setInt32("test.myint", 42);

    // Get the value back using snapshot
    const snapshot = config.snapshot();
    const value = snapshot.getInt32("test.myint");
    assertEquals(value, 42);
    snapshot.free();

    config.free();
  });

  await t.step("set and get int64 value", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set a large integer config value
    config.setInt64("test.mybigint", 9007199254740991n);

    // Get the value back using snapshot
    const snapshot = config.snapshot();
    const value = snapshot.getInt64("test.mybigint");
    assertEquals(value, 9007199254740991n);
    snapshot.free();

    config.free();
  });

  await t.step("set and get bool value", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set boolean config values
    config.setBool("test.enabled", true);
    config.setBool("test.disabled", false);

    // Get the values back using snapshot
    const snapshot = config.snapshot();
    assertEquals(snapshot.getBool("test.enabled"), true);
    assertEquals(snapshot.getBool("test.disabled"), false);
    snapshot.free();

    config.free();
  });

  await t.step("delete config entry", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set a value
    config.setString("test.todelete", "value");

    // Verify it's set
    let snapshot = config.snapshot();
    assertEquals(snapshot.getString("test.todelete"), "value");
    snapshot.free();

    // Delete the value
    config.deleteEntry("test.todelete");

    // Value should no longer exist
    snapshot = config.snapshot();
    const value = snapshot.getString("test.todelete");
    assertEquals(value, null);
    snapshot.free();

    config.free();
  });

  await t.step("iterate over config entries", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set some values
    config.setString("test.key1", "value1");
    config.setString("test.key2", "value2");
    config.setString("test.key3", "value3");

    // Iterate and collect entries using snapshot
    const snapshot = config.snapshot();
    const entries: Array<{ name: string; value: string }> = [];
    snapshot.foreach((entry) => {
      if (entry.name.startsWith("test.")) {
        entries.push({ name: entry.name, value: entry.value });
      }
      return 0; // Continue iteration
    });
    snapshot.free();

    // Should have our test entries
    assert(entries.length >= 3);
    assert(
      entries.some((e) => e.name === "test.key1" && e.value === "value1"),
    );
    assert(
      entries.some((e) => e.name === "test.key2" && e.value === "value2"),
    );
    assert(
      entries.some((e) => e.name === "test.key3" && e.value === "value3"),
    );

    config.free();
  });

  await t.step("iterate with pattern match", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set some values
    config.setString("test.alpha", "a");
    config.setString("test.beta", "b");
    config.setString("other.gamma", "c");

    // Iterate with pattern matching only test.* entries using snapshot
    const snapshot = config.snapshot();
    const entries: string[] = [];
    snapshot.foreachMatch("^test\\.", (entry) => {
      entries.push(entry.name);
      return 0;
    });
    snapshot.free();

    // Should only have test.* entries
    assert(entries.includes("test.alpha"));
    assert(entries.includes("test.beta"));
    assert(!entries.includes("other.gamma"));

    config.free();
  });

  await t.step("get config entry with metadata", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set a value
    config.setString("test.withmetadata", "metavalue");

    // Get entry with full metadata using snapshot
    const snapshot = config.snapshot();
    const entry = snapshot.getEntry("test.withmetadata");
    assertExists(entry);
    assertEquals(entry.name, "test.withmetadata");
    assertEquals(entry.value, "metavalue");
    // Level should be LOCAL (5) for repo config
    assertEquals(entry.level, 5);
    snapshot.free();

    config.free();
  });

  await t.step("create config snapshot", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set initial value
    config.setString("test.snapshot", "original");

    // Create snapshot
    const snapshot = config.snapshot();

    // Modify original config
    config.setString("test.snapshot", "modified");

    // Snapshot should still have original value
    assertEquals(snapshot.getString("test.snapshot"), "original");

    // New snapshot should have modified value
    const newSnapshot = config.snapshot();
    assertEquals(newSnapshot.getString("test.snapshot"), "modified");
    newSnapshot.free();

    snapshot.free();
    config.free();
  });

  await t.step("user.name and user.email config", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set user config
    config.setString("user.name", "Test User");
    config.setString("user.email", "test@example.com");

    // Get user config using snapshot
    const snapshot = config.snapshot();
    assertEquals(snapshot.getString("user.name"), "Test User");
    assertEquals(snapshot.getString("user.email"), "test@example.com");
    snapshot.free();

    config.free();
  });

  await t.step("core.autocrlf config", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Set core.autocrlf to false
    config.setBool("core.autocrlf", false);

    let snapshot = config.snapshot();
    assertEquals(snapshot.getBool("core.autocrlf"), false);
    snapshot.free();

    // Set core.autocrlf to true
    config.setBool("core.autocrlf", true);

    snapshot = config.snapshot();
    assertEquals(snapshot.getBool("core.autocrlf"), true);
    snapshot.free();

    config.free();
  });

  await t.step("non-existent key returns null", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    const config = ctx.repo.config();

    // Get non-existent key
    const snapshot = config.snapshot();
    const value = snapshot.getString("nonexistent.key");
    assertEquals(value, null);
    snapshot.free();

    config.free();
  });

  shutdown();
});
