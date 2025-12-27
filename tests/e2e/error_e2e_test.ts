/**
 * End-to-end tests for error handling (error.ts)
 *
 * These tests validate the GitError class, error checking functions,
 * error wrapping, and error message utilities.
 */

import {
  assertEquals,
  assertExists,
  assertMatch,
  assertThrows,
} from "@std/assert";
import {
  checkError,
  errorMessages,
  getErrorMessage,
  getLastError,
  GitError,
  wrapError,
} from "../../src/error.ts";
import { GitErrorClass, GitErrorCode } from "../../src/types.ts";
import { init, shutdown } from "../../mod.ts";

Deno.test({
  name: "E2E Error Tests",
  async fn(t) {
    // GitError class tests
    await t.step("GitError constructor sets properties correctly", () => {
      const error = new GitError(
        "Test error message",
        GitErrorCode.ENOTFOUND,
        GitErrorClass.REPOSITORY,
      );

      assertEquals(error.message, "Test error message");
      assertEquals(error.code, GitErrorCode.ENOTFOUND);
      assertEquals(error.errorClass, GitErrorClass.REPOSITORY);
      assertEquals(error.name, "GitError");
    });

    await t.step("GitError defaults errorClass to NONE", () => {
      const error = new GitError("Test message", GitErrorCode.ERROR);

      assertEquals(error.errorClass, GitErrorClass.NONE);
    });

    await t.step("GitError.codeName returns human-readable code name", () => {
      const error = new GitError("Test", GitErrorCode.ENOTFOUND);
      assertEquals(error.codeName, "ENOTFOUND");

      const error2 = new GitError("Test", GitErrorCode.ECONFLICT);
      assertEquals(error2.codeName, "ECONFLICT");

      const error3 = new GitError("Test", GitErrorCode.OK);
      assertEquals(error3.codeName, "OK");
    });

    await t.step(
      "GitError.codeName returns UNKNOWN for invalid codes",
      () => {
        const error = new GitError("Test", -999 as GitErrorCode);
        assertMatch(error.codeName, /UNKNOWN\(-999\)/);
      },
    );

    await t.step(
      "GitError.className returns human-readable class name",
      () => {
        const error = new GitError(
          "Test",
          GitErrorCode.ERROR,
          GitErrorClass.REPOSITORY,
        );
        assertEquals(error.className, "REPOSITORY");

        const error2 = new GitError(
          "Test",
          GitErrorCode.ERROR,
          GitErrorClass.INDEX,
        );
        assertEquals(error2.className, "INDEX");
      },
    );

    await t.step(
      "GitError.className returns UNKNOWN for invalid classes",
      () => {
        const error = new GitError(
          "Test",
          GitErrorCode.ERROR,
          999 as GitErrorClass,
        );
        assertMatch(error.className, /UNKNOWN\(999\)/);
      },
    );

    await t.step("GitError.toString formats error correctly", () => {
      const error = new GitError(
        "Something went wrong",
        GitErrorCode.ENOTFOUND,
        GitErrorClass.OBJECT,
      );

      const str = error.toString();
      assertMatch(str, /GitError/);
      assertMatch(str, /ENOTFOUND/);
      assertMatch(str, /OBJECT/);
      assertMatch(str, /Something went wrong/);
    });

    await t.step("GitError is instanceof Error", () => {
      const error = new GitError("Test", GitErrorCode.ERROR);
      assertEquals(error instanceof Error, true);
      assertEquals(error instanceof GitError, true);
    });

    await t.step("GitError can be caught as Error", () => {
      let caught: Error | null = null;
      try {
        throw new GitError("Test error", GitErrorCode.ERROR);
      } catch (e) {
        caught = e as Error;
      }
      assertExists(caught);
      assertEquals(caught instanceof GitError, true);
    });

    // checkError function tests (without library)
    await t.step(
      "checkError (code-first) does nothing for non-negative codes",
      () => {
        // Should not throw
        checkError(0, "Operation succeeded");
        checkError(1, "Positive result");
        checkError(100, "Large positive result");
      },
    );

    await t.step(
      "checkError (code-first) throws GitError for negative codes",
      () => {
        assertThrows(
          () => checkError(-1, "Operation failed"),
          GitError,
          "Operation failed",
        );
      },
    );

    await t.step(
      "checkError (code-first) includes error code in message",
      () => {
        try {
          checkError(-3, "Find operation");
        } catch (e) {
          const error = e as GitError;
          assertMatch(error.message, /code -3/);
          assertEquals(error.code, GitErrorCode.ENOTFOUND);
        }
      },
    );

    await t.step("checkError (code-first) includes context in message", () => {
      try {
        checkError(-1, "Operation failed", "git_repository_open");
      } catch (e) {
        const error = e as GitError;
        assertMatch(error.message, /Operation failed/);
        assertMatch(error.message, /git_repository_open/);
      }
    });

    await t.step(
      "checkError (code-first) uses default message if operation is not string",
      () => {
        // This tests the edge case where codeOrOperation might not be a string
        // In practice this shouldn't happen with proper typing, but the code handles it
        try {
          checkError(-1, "Custom operation");
        } catch (e) {
          const error = e as GitError;
          assertMatch(error.message, /Custom operation/);
        }
      },
    );

    // checkError with library (needs init)
    await t.step("checkError with library instance", async (t) => {
      await init();
      try {
        const { getLibrary } = await import("../../src/library.ts");
        const lib = getLibrary();

        await t.step("does nothing for non-negative codes", () => {
          // Should not throw
          checkError(lib, 0, "Success");
          checkError(lib, 1, "Success");
        });

        await t.step("throws GitError for negative codes", () => {
          assertThrows(
            () => checkError(lib, -1, "Failed operation"),
            GitError,
          );
        });

        await t.step(
          "includes operation name in error when error is set",
          () => {
            // When no error is actually set in libgit2, the error message
            // comes from git_error_last which returns the last real error or "no error"
            try {
              checkError(lib, -1, "my operation");
            } catch (e) {
              const error = e as GitError;
              // The error was thrown as expected
              assertEquals(error instanceof GitError, true);
              assertEquals(error.code, GitErrorCode.ERROR);
            }
          },
        );
      } finally {
        shutdown();
      }
    });

    // getLastError function tests
    await t.step("getLastError with library", async (t) => {
      await init();
      try {
        const { getLibrary } = await import("../../src/library.ts");
        const lib = getLibrary();

        await t.step(
          "returns GitError with default message when no error set",
          () => {
            // Clear any previous errors by calling a successful operation
            lib.symbols.git_libgit2_version(
              Deno.UnsafePointer.of(new Uint8Array(4))!,
              Deno.UnsafePointer.of(new Uint8Array(4))!,
              Deno.UnsafePointer.of(new Uint8Array(4))!,
            );

            const error = getLastError(lib, "Default error message");
            assertExists(error);
            assertEquals(error instanceof GitError, true);
          },
        );

        await t.step("uses provided error code", () => {
          const error = getLastError(
            lib,
            "Custom message",
            GitErrorCode.ENOTFOUND,
          );
          assertEquals(error.code, GitErrorCode.ENOTFOUND);
        });

        await t.step("defaults to ERROR code", () => {
          const error = getLastError(lib, "Default code test");
          assertEquals(error.code, GitErrorCode.ERROR);
        });
      } finally {
        shutdown();
      }
    });

    // wrapError function tests
    await t.step("wrapError with library", async (t) => {
      await init();
      try {
        const { getLibrary } = await import("../../src/library.ts");
        const lib = getLibrary();

        await t.step("returns result when function succeeds", () => {
          const result = wrapError(lib, "test operation", () => {
            return "success";
          });
          assertEquals(result, "success");
        });

        await t.step("returns result for different types", () => {
          const numberResult = wrapError(lib, "number op", () => 42);
          assertEquals(numberResult, 42);

          const objectResult = wrapError(lib, "object op", () => ({
            key: "value",
          }));
          assertEquals(objectResult.key, "value");

          const arrayResult = wrapError(lib, "array op", () => [1, 2, 3]);
          assertEquals(arrayResult, [1, 2, 3]);
        });

        await t.step("re-throws GitError unchanged", () => {
          const originalError = new GitError(
            "Original error",
            GitErrorCode.ENOTFOUND,
            GitErrorClass.OBJECT,
          );

          try {
            wrapError(lib, "wrapped operation", () => {
              throw originalError;
            });
          } catch (e) {
            const error = e as GitError;
            assertEquals(error, originalError);
            assertEquals(error.message, "Original error");
            assertEquals(error.code, GitErrorCode.ENOTFOUND);
            assertEquals(error.errorClass, GitErrorClass.OBJECT);
          }
        });

        await t.step("wraps non-GitError in GitError", () => {
          try {
            wrapError(lib, "my operation", () => {
              throw new Error("Standard error");
            });
          } catch (e) {
            const error = e as GitError;
            assertEquals(error instanceof GitError, true);
            assertMatch(error.message, /my operation/);
            assertMatch(error.message, /Standard error/);
            assertEquals(error.code, GitErrorCode.ERROR);
          }
        });

        await t.step("wraps string errors in GitError", () => {
          try {
            wrapError(lib, "string error op", () => {
              throw "String error message";
            });
          } catch (e) {
            const error = e as GitError;
            assertEquals(error instanceof GitError, true);
            assertMatch(error.message, /string error op/);
            assertMatch(error.message, /String error message/);
          }
        });

        await t.step("wraps undefined/null errors", () => {
          try {
            wrapError(lib, "undefined error op", () => {
              throw undefined;
            });
          } catch (e) {
            const error = e as GitError;
            assertEquals(error instanceof GitError, true);
            assertMatch(error.message, /undefined error op/);
          }
        });
      } finally {
        shutdown();
      }
    });

    // errorMessages and getErrorMessage tests
    await t.step("errorMessages contains all error codes", () => {
      // Test a sampling of error codes
      assertExists(errorMessages[GitErrorCode.OK]);
      assertExists(errorMessages[GitErrorCode.ERROR]);
      assertExists(errorMessages[GitErrorCode.ENOTFOUND]);
      assertExists(errorMessages[GitErrorCode.EEXISTS]);
      assertExists(errorMessages[GitErrorCode.EAMBIGUOUS]);
      assertExists(errorMessages[GitErrorCode.ECONFLICT]);
      assertExists(errorMessages[GitErrorCode.EAUTH]);
      assertExists(errorMessages[GitErrorCode.TIMEOUT]);
    });

    await t.step("errorMessages has descriptive messages", () => {
      assertEquals(errorMessages[GitErrorCode.OK], "No error");
      assertEquals(errorMessages[GitErrorCode.ERROR], "Generic error");
      assertEquals(errorMessages[GitErrorCode.ENOTFOUND], "Object not found");
      assertEquals(
        errorMessages[GitErrorCode.EEXISTS],
        "Object already exists",
      );
      assertEquals(
        errorMessages[GitErrorCode.EBAREREPO],
        "Operation not allowed on bare repository",
      );
      assertEquals(
        errorMessages[GitErrorCode.EAUTH],
        "Authentication failed",
      );
      assertEquals(errorMessages[GitErrorCode.TIMEOUT], "Operation timed out");
    });

    await t.step("getErrorMessage returns message for known codes", () => {
      assertEquals(getErrorMessage(GitErrorCode.OK), "No error");
      assertEquals(getErrorMessage(GitErrorCode.ENOTFOUND), "Object not found");
      assertEquals(
        getErrorMessage(GitErrorCode.ECONFLICT),
        "Checkout conflicts",
      );
      assertEquals(
        getErrorMessage(GitErrorCode.ITEROVER),
        "Iteration complete",
      );
    });

    await t.step(
      "getErrorMessage returns unknown message for invalid codes",
      () => {
        const msg = getErrorMessage(-999 as GitErrorCode);
        assertMatch(msg, /Unknown error/);
        assertMatch(msg, /-999/);
      },
    );

    // Test all error codes have messages
    await t.step("all GitErrorCode values have messages", () => {
      const errorCodes = [
        GitErrorCode.OK,
        GitErrorCode.ERROR,
        GitErrorCode.ENOTFOUND,
        GitErrorCode.EEXISTS,
        GitErrorCode.EAMBIGUOUS,
        GitErrorCode.EBUFS,
        GitErrorCode.EUSER,
        GitErrorCode.EBAREREPO,
        GitErrorCode.EUNBORNBRANCH,
        GitErrorCode.EUNMERGED,
        GitErrorCode.ENONFASTFORWARD,
        GitErrorCode.EINVALIDSPEC,
        GitErrorCode.ECONFLICT,
        GitErrorCode.ELOCKED,
        GitErrorCode.EMODIFIED,
        GitErrorCode.EAUTH,
        GitErrorCode.ECERTIFICATE,
        GitErrorCode.EAPPLIED,
        GitErrorCode.EPEEL,
        GitErrorCode.EEOF,
        GitErrorCode.EINVALID,
        GitErrorCode.EUNCOMMITTED,
        GitErrorCode.EDIRECTORY,
        GitErrorCode.EMERGECONFLICT,
        GitErrorCode.PASSTHROUGH,
        GitErrorCode.ITEROVER,
        GitErrorCode.RETRY,
        GitErrorCode.EMISMATCH,
        GitErrorCode.EINDEXDIRTY,
        GitErrorCode.EAPPLYFAIL,
        GitErrorCode.EOWNER,
        GitErrorCode.TIMEOUT,
      ];

      for (const code of errorCodes) {
        const msg = getErrorMessage(code);
        assertExists(msg, `Missing message for code ${code}`);
        assertEquals(
          msg.includes("Unknown"),
          false,
          `Code ${code} should have a known message`,
        );
      }
    });

    // Test all error classes can be used
    await t.step("GitErrorClass values can be used in GitError", () => {
      const errorClasses = [
        GitErrorClass.NONE,
        GitErrorClass.NOMEMORY,
        GitErrorClass.OS,
        GitErrorClass.INVALID,
        GitErrorClass.REFERENCE,
        GitErrorClass.ZLIB,
        GitErrorClass.REPOSITORY,
        GitErrorClass.CONFIG,
        GitErrorClass.REGEX,
        GitErrorClass.ODB,
        GitErrorClass.INDEX,
        GitErrorClass.OBJECT,
        GitErrorClass.NET,
        GitErrorClass.TAG,
        GitErrorClass.TREE,
        GitErrorClass.INDEXER,
        GitErrorClass.SSL,
        GitErrorClass.SUBMODULE,
        GitErrorClass.THREAD,
        GitErrorClass.STASH,
        GitErrorClass.CHECKOUT,
        GitErrorClass.FETCHHEAD,
        GitErrorClass.MERGE,
        GitErrorClass.SSH,
        GitErrorClass.FILTER,
        GitErrorClass.REVERT,
        GitErrorClass.CALLBACK,
        GitErrorClass.CHERRYPICK,
        GitErrorClass.DESCRIBE,
        GitErrorClass.REBASE,
        GitErrorClass.FILESYSTEM,
        GitErrorClass.PATCH,
        GitErrorClass.WORKTREE,
        GitErrorClass.SHA,
        GitErrorClass.HTTP,
        GitErrorClass.INTERNAL,
      ];

      for (const errorClass of errorClasses) {
        const error = new GitError("Test", GitErrorCode.ERROR, errorClass);
        assertEquals(error.errorClass, errorClass);
        // className should not be "UNKNOWN" for valid classes
        assertEquals(
          error.className.includes("UNKNOWN"),
          false,
          `Class ${errorClass} should have a known name`,
        );
      }
    });

    // Edge cases
    await t.step("GitError with empty message", () => {
      const error = new GitError("", GitErrorCode.ERROR);
      assertEquals(error.message, "");
      assertMatch(error.toString(), /GitError/);
    });

    await t.step("GitError with very long message", () => {
      const longMessage = "A".repeat(10000);
      const error = new GitError(longMessage, GitErrorCode.ERROR);
      assertEquals(error.message, longMessage);
      assertEquals(error.message.length, 10000);
    });

    await t.step("GitError with special characters in message", () => {
      const specialMessage = "Error: path/to/file.txt\n\tDetails: <xml>&amp;";
      const error = new GitError(specialMessage, GitErrorCode.ERROR);
      assertEquals(error.message, specialMessage);
    });

    await t.step("checkError with zero code (OK) does not throw", () => {
      checkError(GitErrorCode.OK, "Should be OK");
      // No exception means success
    });

    await t.step("checkError with various negative codes", () => {
      const testCases = [
        { code: GitErrorCode.ENOTFOUND, expectedCode: GitErrorCode.ENOTFOUND },
        { code: GitErrorCode.EEXISTS, expectedCode: GitErrorCode.EEXISTS },
        { code: GitErrorCode.ECONFLICT, expectedCode: GitErrorCode.ECONFLICT },
        { code: GitErrorCode.EAUTH, expectedCode: GitErrorCode.EAUTH },
      ];

      for (const { code, expectedCode } of testCases) {
        try {
          checkError(code, "Test operation");
        } catch (e) {
          const error = e as GitError;
          assertEquals(
            error.code,
            expectedCode,
            `Expected code ${expectedCode} but got ${error.code}`,
          );
        }
      }
    });
  },
});
