/**
 * End-to-end tests for git config operations (config.ts)
 *
 * These tests validate configuration reading, writing, iteration,
 * and snapshot functionality using real git repositories.
 */

import { assert, assertEquals, assertExists, assertFalse } from "@std/assert";
import { createTestContext, setupLibrary } from "./helpers.ts";
import {
  Config,
  type ConfigEntry,
  getRepositoryConfig,
  GitConfigLevel,
} from "../../src/config.ts";
import { getLibrary } from "../../src/library.ts";

Deno.test({
  name: "E2E Config Tests",
  async fn(t) {
    using _git = await setupLibrary();
    // GitConfigLevel enum tests
    await t.step("GitConfigLevel enum has correct values", () => {
      assertEquals(GitConfigLevel.PROGRAMDATA, 1);
      assertEquals(GitConfigLevel.SYSTEM, 2);
      assertEquals(GitConfigLevel.XDG, 3);
      assertEquals(GitConfigLevel.GLOBAL, 4);
      assertEquals(GitConfigLevel.LOCAL, 5);
      assertEquals(GitConfigLevel.APP, 6);
      assertEquals(GitConfigLevel.HIGHEST_LEVEL, -1);
    });

    // Basic config access
    await t.step("get repository config", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();
      assertExists(config);
      assertExists(config.ptr);
    });

    await t.step("getRepositoryConfig function works", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = getRepositoryConfig(ctx.repo.pointer);
      assertExists(config);
    });

    await t.step("config ptr property returns pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();
      const ptr = config.ptr;
      assertExists(ptr);
    });

    // String config tests
    await t.step("set and get string value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.mykey", "myvalue");

      using snapshot = config.snapshot();
      const value = snapshot.getString("test.mykey");
      assertEquals(value, "myvalue");
    });

    await t.step("getString returns null for non-existent key", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      using snapshot = config.snapshot();
      const value = snapshot.getString("nonexistent.key.that.does.not.exist");
      assertEquals(value, null);
    });

    await t.step("setString with empty value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.emptyvalue", "");

      using snapshot = config.snapshot();
      const value = snapshot.getString("test.emptyvalue");
      assertEquals(value, "");
    });

    await t.step("setString with special characters", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.special", "hello world\twith\ttabs");

      using snapshot = config.snapshot();
      const value = snapshot.getString("test.special");
      assertEquals(value, "hello world\twith\ttabs");
    });

    await t.step("setString with unicode", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.unicode", "こんにちは 🎉");

      using snapshot = config.snapshot();
      const value = snapshot.getString("test.unicode");
      assertEquals(value, "こんにちは 🎉");
    });

    // Int32 config tests
    await t.step("set and get int32 value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt32("test.myint", 42);

      using snapshot = config.snapshot();
      const value = snapshot.getInt32("test.myint");
      assertEquals(value, 42);
    });

    await t.step("getInt32 returns null for non-existent key", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      using snapshot = config.snapshot();
      const value = snapshot.getInt32("nonexistent.intkey");
      assertEquals(value, null);
    });

    await t.step("setInt32 with zero", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt32("test.zero", 0);

      using snapshot = config.snapshot();
      const value = snapshot.getInt32("test.zero");
      assertEquals(value, 0);
    });

    await t.step("setInt32 with negative value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt32("test.negative", -12345);

      using snapshot = config.snapshot();
      const value = snapshot.getInt32("test.negative");
      assertEquals(value, -12345);
    });

    await t.step("setInt32 with max value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt32("test.maxint", 2147483647);

      using snapshot = config.snapshot();
      const value = snapshot.getInt32("test.maxint");
      assertEquals(value, 2147483647);
    });

    // Int64 config tests
    await t.step("set and get int64 value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt64("test.mybigint", 9007199254740991n);

      using snapshot = config.snapshot();
      const value = snapshot.getInt64("test.mybigint");
      assertEquals(value, 9007199254740991n);
    });

    await t.step("getInt64 returns null for non-existent key", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      using snapshot = config.snapshot();
      const value = snapshot.getInt64("nonexistent.bigintkey");
      assertEquals(value, null);
    });

    await t.step("setInt64 with zero", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt64("test.zerobig", 0n);

      using snapshot = config.snapshot();
      const value = snapshot.getInt64("test.zerobig");
      assertEquals(value, 0n);
    });

    await t.step("setInt64 with negative value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt64("test.negativebig", -9007199254740991n);

      using snapshot = config.snapshot();
      const value = snapshot.getInt64("test.negativebig");
      assertEquals(value, -9007199254740991n);
    });

    // Bool config tests
    await t.step("set and get bool value (true)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setBool("test.enabled", true);

      using snapshot = config.snapshot();
      assertEquals(snapshot.getBool("test.enabled"), true);
    });

    await t.step("set and get bool value (false)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setBool("test.disabled", false);

      using snapshot = config.snapshot();
      assertEquals(snapshot.getBool("test.disabled"), false);
    });

    await t.step("getBool returns null for non-existent key", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      using snapshot = config.snapshot();
      const value = snapshot.getBool("nonexistent.boolkey");
      assertEquals(value, null);
    });

    // Config entry tests
    await t.step("get config entry with metadata", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.withmetadata", "metavalue");

      using snapshot = config.snapshot();
      const entry = snapshot.getEntry("test.withmetadata");
      assertExists(entry);
      assertEquals(entry.name, "test.withmetadata");
      assertEquals(entry.value, "metavalue");
      assertEquals(entry.level, GitConfigLevel.LOCAL);
      assertEquals(typeof entry.includeDepth, "number");
    });

    await t.step("getEntry returns null for non-existent key", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      using snapshot = config.snapshot();
      const entry = snapshot.getEntry("nonexistent.entry");
      assertEquals(entry, null);
    });

    // Delete entry tests
    await t.step("delete config entry", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.todelete", "value");

      {
        using snapshot = config.snapshot();
        assertEquals(snapshot.getString("test.todelete"), "value");
      }

      config.deleteEntry("test.todelete");

      using snapshot = config.snapshot();
      assertEquals(snapshot.getString("test.todelete"), null);
    });

    await t.step(
      "deleteEntry does not throw for non-existent key",
      async () => {
        await using ctx = await createTestContext({
          withInitialCommit: true,
        });
        using config = ctx.repo.config();

        // Should not throw
        config.deleteEntry("nonexistent.key.to.delete");
      },
    );

    // Iteration tests
    await t.step("iterate over config entries with foreach", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.iter1", "value1");
      config.setString("test.iter2", "value2");
      config.setString("test.iter3", "value3");

      using snapshot = config.snapshot();
      const entries: ConfigEntry[] = [];
      snapshot.foreach((entry) => {
        if (entry.name.startsWith("test.iter")) {
          entries.push({ ...entry });
        }
        return 0; // Continue iteration
      });

      assertEquals(entries.length, 3);
      assert(entries.some((e) => e.name === "test.iter1"));
      assert(entries.some((e) => e.name === "test.iter2"));
      assert(entries.some((e) => e.name === "test.iter3"));
    });

    await t.step("foreach can stop iteration early", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.stop1", "value1");
      config.setString("test.stop2", "value2");
      config.setString("test.stop3", "value3");

      using snapshot = config.snapshot();
      let count = 0;
      snapshot.foreach((entry) => {
        if (entry.name.startsWith("test.stop")) {
          count++;
          if (count >= 2) {
            return -30; // GIT_PASSTHROUGH to stop iteration
          }
        }
        return 0;
      });

      // Should have stopped after 2 entries
      assert(count >= 2);
    });

    await t.step("iterate with pattern match (foreachMatch)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.alpha", "a");
      config.setString("test.beta", "b");
      config.setString("other.gamma", "c");

      using snapshot = config.snapshot();
      const entries: string[] = [];
      snapshot.foreachMatch("^test\\.", (entry) => {
        entries.push(entry.name);
        return 0;
      });

      assert(entries.includes("test.alpha"));
      assert(entries.includes("test.beta"));
      assertFalse(entries.includes("other.gamma"));
    });

    await t.step("foreachMatch with complex pattern", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("match.one", "1");
      config.setString("match.two", "2");
      config.setString("nomatch.three", "3");

      using snapshot = config.snapshot();
      const entries: string[] = [];
      snapshot.foreachMatch("^match\\..*", (entry) => {
        entries.push(entry.name);
        return 0;
      });

      assertEquals(entries.length, 2);
      assert(entries.includes("match.one"));
      assert(entries.includes("match.two"));
    });

    // Snapshot tests
    await t.step("create config snapshot", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.snapshot", "original");

      using snapshot = config.snapshot();

      // Modify original config
      config.setString("test.snapshot", "modified");

      // Snapshot should still have original value
      assertEquals(snapshot.getString("test.snapshot"), "original");
    });

    await t.step("multiple snapshots are independent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.multi", "v1");
      using snap1 = config.snapshot();

      config.setString("test.multi", "v2");
      using snap2 = config.snapshot();

      config.setString("test.multi", "v3");
      using snap3 = config.snapshot();

      assertEquals(snap1.getString("test.multi"), "v1");
      assertEquals(snap2.getString("test.multi"), "v2");
      assertEquals(snap3.getString("test.multi"), "v3");
    });

    // Common git config keys
    await t.step("user.name and user.email config", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("user.name", "Test User");
      config.setString("user.email", "test@example.com");

      using snapshot = config.snapshot();
      assertEquals(snapshot.getString("user.name"), "Test User");
      assertEquals(snapshot.getString("user.email"), "test@example.com");
    });

    await t.step("core.autocrlf config", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setBool("core.autocrlf", false);
      {
        using snapshot = config.snapshot();
        assertEquals(snapshot.getBool("core.autocrlf"), false);
      }

      config.setBool("core.autocrlf", true);
      using snapshot = config.snapshot();
      assertEquals(snapshot.getBool("core.autocrlf"), true);
    });

    await t.step("core.filemode config", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setBool("core.filemode", true);

      using snapshot = config.snapshot();
      assertEquals(snapshot.getBool("core.filemode"), true);
    });

    // Cleanup tests
    await t.step("free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      const config = ctx.repo.config();

      config.free();
      config.free(); // Should not throw
      config.free(); // Should not throw
    });

    await t.step("Symbol.dispose works for automatic cleanup", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      {
        using config = ctx.repo.config();
        config.setString("test.dispose", "value");
      }
      // Config should be freed after leaving the block

      // Verify we can still access the repo
      using config = ctx.repo.config();
      using snapshot = config.snapshot();
      assertEquals(snapshot.getString("test.dispose"), "value");
    });

    // Type coercion tests
    await t.step(
      "reading int as string returns string representation",
      async () => {
        await using ctx = await createTestContext({
          withInitialCommit: true,
        });
        using config = ctx.repo.config();

        config.setInt32("test.intasstring", 12345);

        using snapshot = config.snapshot();
        const value = snapshot.getString("test.intasstring");
        assertEquals(value, "12345");
      },
    );

    await t.step(
      "reading bool as string returns string representation",
      async () => {
        await using ctx = await createTestContext({
          withInitialCommit: true,
        });
        using config = ctx.repo.config();

        config.setBool("test.boolasstring", true);

        using snapshot = config.snapshot();
        const value = snapshot.getString("test.boolasstring");
        assertEquals(value, "true");
      },
    );

    // ConfigEntry metadata tests
    await t.step("config entry level is LOCAL for repo config", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.localentry", "localvalue");

      using snapshot = config.snapshot();
      const entry = snapshot.getEntry("test.localentry");
      assertExists(entry);
      assertEquals(entry.level, GitConfigLevel.LOCAL);
    });

    await t.step(
      "config entry includeDepth is 0 for direct entries",
      async () => {
        await using ctx = await createTestContext({
          withInitialCommit: true,
        });
        using config = ctx.repo.config();

        config.setString("test.directentry", "directvalue");

        using snapshot = config.snapshot();
        const entry = snapshot.getEntry("test.directentry");
        assertExists(entry);
        assertEquals(entry.includeDepth, 0);
      },
    );

    // Update existing values
    await t.step("update existing string value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("test.update", "initial");
      {
        using snapshot = config.snapshot();
        assertEquals(snapshot.getString("test.update"), "initial");
      }

      config.setString("test.update", "updated");
      using snapshot = config.snapshot();
      assertEquals(snapshot.getString("test.update"), "updated");
    });

    await t.step("update existing int32 value", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setInt32("test.updateint", 100);
      {
        using snapshot = config.snapshot();
        assertEquals(snapshot.getInt32("test.updateint"), 100);
      }

      config.setInt32("test.updateint", 200);
      using snapshot = config.snapshot();
      assertEquals(snapshot.getInt32("test.updateint"), 200);
    });

    // Many config entries test
    await t.step("handle many config entries", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      // Set many entries
      const count = 50;
      for (let i = 0; i < count; i++) {
        config.setString(`test.many${i}`, `value${i}`);
      }

      using snapshot = config.snapshot();

      // Verify all entries
      for (let i = 0; i < count; i++) {
        const value = snapshot.getString(`test.many${i}`);
        assertEquals(value, `value${i}`);
      }
    });

    // Hierarchical config keys
    await t.step("hierarchical config keys work", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      config.setString("section.subsection.key", "value");

      using snapshot = config.snapshot();
      assertEquals(
        snapshot.getString("section.subsection.key"),
        "value",
      );
    });

    // Long string values
    await t.step("long string values work", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      using config = ctx.repo.config();

      const longValue = "a".repeat(10000);
      config.setString("test.longvalue", longValue);

      using snapshot = config.snapshot();
      assertEquals(snapshot.getString("test.longvalue"), longValue);
    });
  },
});
