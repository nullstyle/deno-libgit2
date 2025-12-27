/**
 * End-to-end tests for library management (library.ts)
 *
 * These tests validate library initialization, shutdown, version retrieval,
 * and lifecycle management functions.
 */

import {
  assertEquals,
  assertExists,
  assertFalse,
  assertGreater,
  assertMatch,
  assertRejects,
  assertThrows,
} from "@std/assert";
import {
  getLibrary,
  init,
  initGit,
  isLibraryLoaded,
  shutdown,
  version,
  versionString,
  withLibrary,
} from "../../mod.ts";
import { GitError } from "../../src/error.ts";

Deno.test({
  name: "E2E Library Tests",
  async fn(t) {
    // Most tests need to manage init/shutdown carefully to avoid conflicts

    await t.step("init() initializes the library successfully", async () => {
      const result = await init();
      try {
        assertGreater(result, 0, "init() should return positive count");
      } finally {
        shutdown();
      }
    });

    await t.step("init() can be called multiple times", async () => {
      const first = await init();
      const second = await init();
      try {
        assertEquals(second, first + 1, "Nested init should increment count");
      } finally {
        shutdown();
        shutdown();
      }
    });

    await t.step("shutdown() decrements init count", async () => {
      await init();
      await init();
      const afterFirstShutdown = shutdown();
      const afterSecondShutdown = shutdown();

      assertEquals(
        afterFirstShutdown,
        1,
        "First shutdown should leave count at 1",
      );
      assertEquals(
        afterSecondShutdown,
        0,
        "Second shutdown should leave count at 0",
      );
    });

    await t.step(
      "shutdown() returns 0 when library is not loaded",
      async () => {
        // Ensure library is not loaded
        while (isLibraryLoaded()) {
          shutdown();
        }
        const result = shutdown();
        assertEquals(result, 0, "shutdown() on unloaded library returns 0");
      },
    );

    await t.step("isLibraryLoaded() returns false before init", async () => {
      // Ensure clean state
      while (isLibraryLoaded()) {
        shutdown();
      }
      assertFalse(
        isLibraryLoaded(),
        "Library should not be loaded before init",
      );
    });

    await t.step("isLibraryLoaded() returns true after init", async () => {
      await init();
      try {
        assertEquals(
          isLibraryLoaded(),
          true,
          "Library should be loaded after init",
        );
      } finally {
        shutdown();
      }
    });

    await t.step(
      "isLibraryLoaded() returns false after complete shutdown",
      async () => {
        await init();
        shutdown();
        assertFalse(
          isLibraryLoaded(),
          "Library should not be loaded after shutdown",
        );
      },
    );

    await t.step(
      "getLibrary() throws when library is not loaded",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }
        assertThrows(
          () => getLibrary(),
          GitError,
          "not loaded",
        );
      },
    );

    await t.step(
      "getLibrary() returns library instance after init",
      async () => {
        await init();
        try {
          const lib = getLibrary();
          assertExists(lib, "getLibrary() should return a library instance");
          assertExists(lib.symbols, "Library should have symbols");
        } finally {
          shutdown();
        }
      },
    );

    await t.step("version() returns valid version object", async () => {
      await init();
      try {
        const v = version();
        assertExists(v, "version() should return an object");
        assertExists(v.major, "Version should have major number");
        assertExists(v.minor, "Version should have minor number");
        assertExists(v.revision, "Version should have revision number");

        assertEquals(
          typeof v.major,
          "number",
          "major should be a number",
        );
        assertEquals(
          typeof v.minor,
          "number",
          "minor should be a number",
        );
        assertEquals(
          typeof v.revision,
          "number",
          "revision should be a number",
        );

        assertGreater(
          v.major,
          0,
          "Major version should be positive (libgit2 is at least v1.x)",
        );
      } finally {
        shutdown();
      }
    });

    await t.step(
      "version() throws when library is not loaded",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }
        assertThrows(
          () => version(),
          GitError,
          "not loaded",
        );
      },
    );

    await t.step("versionString() returns formatted version", async () => {
      await init();
      try {
        const v = versionString();
        assertExists(v, "versionString() should return a string");
        assertMatch(
          v,
          /^\d+\.\d+\.\d+$/,
          "Version string should match X.Y.Z format",
        );

        // Verify it matches the version() object
        const vObj = version();
        const expected = `${vObj.major}.${vObj.minor}.${vObj.revision}`;
        assertEquals(
          v,
          expected,
          "versionString() should match version() values",
        );
      } finally {
        shutdown();
      }
    });

    await t.step(
      "versionString() throws when library is not loaded",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }
        assertThrows(
          () => versionString(),
          GitError,
          "not loaded",
        );
      },
    );

    await t.step(
      "withLibrary() initializes and shuts down automatically",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        let wasLoaded = false;
        const result = await withLibrary(() => {
          wasLoaded = isLibraryLoaded();
          return "test-result";
        });

        assertEquals(wasLoaded, true, "Library should be loaded inside fn");
        assertEquals(result, "test-result", "Should return fn result");
        assertFalse(
          isLibraryLoaded(),
          "Library should be unloaded after withLibrary",
        );
      },
    );

    await t.step("withLibrary() works with async functions", async () => {
      // Ensure clean state
      while (isLibraryLoaded()) {
        shutdown();
      }

      const result = await withLibrary(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return version();
      });

      assertExists(result.major, "Async result should have version info");
      assertFalse(
        isLibraryLoaded(),
        "Library should be unloaded after async withLibrary",
      );
    });

    await t.step(
      "withLibrary() shuts down even if function throws",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        await assertRejects(
          async () => {
            await withLibrary(() => {
              throw new Error("Test error");
            });
          },
          Error,
          "Test error",
        );

        assertFalse(
          isLibraryLoaded(),
          "Library should be unloaded after error in withLibrary",
        );
      },
    );

    await t.step(
      "withLibrary() shuts down even if async function rejects",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        await assertRejects(
          async () => {
            await withLibrary(async () => {
              await new Promise((resolve) => setTimeout(resolve, 5));
              throw new Error("Async test error");
            });
          },
          Error,
          "Async test error",
        );

        assertFalse(
          isLibraryLoaded(),
          "Library should be unloaded after async error",
        );
      },
    );

    await t.step(
      "Multiple concurrent init() calls resolve to same library",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        // Start multiple init calls concurrently
        const results = await Promise.all([
          init(),
          init(),
          init(),
        ]);

        try {
          // All should succeed
          for (const result of results) {
            assertGreater(result, 0, "All init calls should succeed");
          }

          // There should be only one library loaded
          assertEquals(isLibraryLoaded(), true, "Library should be loaded");
        } finally {
          // Clean up all inits
          shutdown();
          shutdown();
          shutdown();
        }
      },
    );

    await t.step(
      "Library remains loaded when init count > 0 after partial shutdown",
      async () => {
        await init();
        await init();

        shutdown(); // Count goes to 1
        assertEquals(
          isLibraryLoaded(),
          true,
          "Library should remain loaded with count > 0",
        );

        shutdown(); // Count goes to 0
        assertFalse(
          isLibraryLoaded(),
          "Library should be unloaded when count reaches 0",
        );
      },
    );

    await t.step(
      "getLibrary() returns same instance on multiple calls",
      async () => {
        await init();
        try {
          const lib1 = getLibrary();
          const lib2 = getLibrary();
          assertEquals(lib1, lib2, "getLibrary() should return same instance");
        } finally {
          shutdown();
        }
      },
    );

    await t.step(
      "version numbers are consistent across multiple calls",
      async () => {
        await init();
        try {
          const v1 = version();
          const v2 = version();

          assertEquals(
            v1.major,
            v2.major,
            "Major version should be consistent",
          );
          assertEquals(
            v1.minor,
            v2.minor,
            "Minor version should be consistent",
          );
          assertEquals(
            v1.revision,
            v2.revision,
            "Revision should be consistent",
          );
        } finally {
          shutdown();
        }
      },
    );

    await t.step(
      "withLibrary() can be nested with explicit init/shutdown",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        await init();
        try {
          const result = await withLibrary(() => {
            return versionString();
          });

          // Library should still be loaded because of outer init
          assertEquals(
            isLibraryLoaded(),
            true,
            "Library should still be loaded after nested withLibrary",
          );
          assertMatch(result, /^\d+\.\d+\.\d+$/);
        } finally {
          shutdown();
        }
      },
    );

    await t.step(
      "initGit() returns GitLibrary with version properties",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        using git = await initGit();

        assertEquals(
          isLibraryLoaded(),
          true,
          "Library should be loaded after initGit()",
        );

        assertExists(git.version, "GitLibrary should have version property");
        assertExists(
          git.versionString,
          "GitLibrary should have versionString property",
        );
        assertMatch(
          git.versionString,
          /^\d+\.\d+\.\d+$/,
          "versionString should match X.Y.Z format",
        );
        assertEquals(
          git.versionString,
          `${git.version.major}.${git.version.minor}.${git.version.revision}`,
          "versionString should match version object",
        );
      },
    );

    await t.step(
      "initGit() shuts down automatically via Symbol.dispose",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        {
          using _git = await initGit();
          assertEquals(
            isLibraryLoaded(),
            true,
            "Library should be loaded inside using block",
          );
        }

        assertFalse(
          isLibraryLoaded(),
          "Library should be unloaded after using block ends",
        );
      },
    );

    await t.step(
      "initGit() shutdown() method works manually",
      async () => {
        // Ensure clean state
        while (isLibraryLoaded()) {
          shutdown();
        }

        const git = await initGit();
        assertEquals(
          isLibraryLoaded(),
          true,
          "Library should be loaded after initGit()",
        );

        const result = git.shutdown();
        assertEquals(result, 0, "shutdown() should return 0");
        assertFalse(
          isLibraryLoaded(),
          "Library should be unloaded after manual shutdown()",
        );
      },
    );
  },
});
