/**
 * @module library
 * Library loading and initialization for libgit2
 *
 * Uses @denosaurs/plug for cross-platform library loading with automatic
 * caching and path resolution.
 */

import { dlopen, type FetchOptions } from "@denosaurs/plug";
import { symbols } from "./ffi.ts";
import { GitError } from "./error.ts";
import { GitErrorCode } from "./types.ts";
import { createOutPointer, ptrOf, readInt32 } from "./utils.ts";

/**
 * Type for the loaded libgit2 library
 */
export type LibGit2 = Deno.DynamicLibrary<typeof symbols>;

/**
 * Global library instance
 */
let _lib: LibGit2 | null = null;

/**
 * Initialization count for nested init/shutdown calls
 */
let _initCount = 0;

/**
 * Promise for library loading (to prevent concurrent loading)
 */
let _loadingPromise: Promise<LibGit2> | null = null;

/**
 * Get the default library fetch options for libgit2
 */
function getDefaultFetchOptions(): FetchOptions {
  return {
    name: "git2",
    url: {
      darwin: {
        aarch64: "/opt/homebrew/lib/",
        x86_64: "/usr/local/lib/",
      },
      linux: {
        x86_64: "/usr/lib/x86_64-linux-gnu/",
        aarch64: "/usr/lib/aarch64-linux-gnu/",
      },
      windows: "C:\\Program Files\\Git\\mingw64\\bin\\",
      freebsd: "/usr/local/lib/",
      netbsd: "/usr/pkg/lib/",
      aix: "/opt/freeware/lib/",
      solaris: "/usr/local/lib/",
      illumos: "/usr/local/lib/",
    },
    cache: "use",
  };
}

/**
 * Load the libgit2 library
 * @param options - Optional path to the library file or FetchOptions
 */
export function loadLibrary(
  options?: string | FetchOptions,
): Promise<LibGit2> {
  // Return existing library if already loaded
  if (_lib !== null) {
    return Promise.resolve(_lib);
  }

  // Return existing loading promise if in progress
  if (_loadingPromise !== null) {
    return _loadingPromise;
  }

  // Start loading
  _loadingPromise = (async () => {
    try {
      const fetchOptions = options ?? getDefaultFetchOptions();
      _lib = await dlopen(fetchOptions, symbols);
      return _lib;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitError(
        `Failed to load libgit2 library: ${message}. ` +
          `Please ensure libgit2 is installed on your system.`,
        GitErrorCode.ERROR,
      );
    } finally {
      _loadingPromise = null;
    }
  })();

  return _loadingPromise;
}

/**
 * Get the loaded library instance
 * @throws GitError if library is not loaded
 */
export function getLibrary(): LibGit2 {
  if (_lib === null) {
    throw new GitError(
      "libgit2 library not loaded. Call init() first.",
      GitErrorCode.ERROR,
    );
  }
  return _lib;
}

/**
 * Check if the library is loaded
 */
export function isLibraryLoaded(): boolean {
  return _lib !== null;
}

/**
 * Initialize the libgit2 library.
 * This must be called before using any other libgit2 functions.
 * Can be called multiple times; each call must be matched with a shutdown() call.
 * @param libraryPath - Optional path to the library file or FetchOptions
 * @returns The number of initializations (including this one)
 */
export async function init(
  libraryPath?: string | FetchOptions,
): Promise<number> {
  const lib = await loadLibrary(libraryPath);
  const result = lib.symbols.git_libgit2_init();

  if (result < 0) {
    throw new GitError(
      `Failed to initialize libgit2: ${result}`,
      GitErrorCode.ERROR,
    );
  }

  _initCount = result;
  return result;
}

/**
 * Shutdown the libgit2 library
 * Should be called once for each call to init().
 * @returns The remaining number of initializations
 */
export function shutdown(): number {
  if (_lib === null) {
    return 0;
  }

  const result = _lib.symbols.git_libgit2_shutdown();
  _initCount = Math.max(0, result);

  if (_initCount === 0) {
    _lib.close();
    _lib = null;
  }

  return result;
}

/**
 * Get the libgit2 version
 * @returns Object with major, minor, and revision version numbers
 */
export function version(): { major: number; minor: number; revision: number } {
  const lib = getLibrary();

  const majorBuf = createOutPointer();
  const minorBuf = createOutPointer();
  const revBuf = createOutPointer();

  lib.symbols.git_libgit2_version(
    ptrOf(majorBuf),
    ptrOf(minorBuf),
    ptrOf(revBuf),
  );

  return {
    major: readInt32(majorBuf),
    minor: readInt32(minorBuf),
    revision: readInt32(revBuf),
  };
}

/**
 * Get the libgit2 version as a string
 */
export function versionString(): string {
  const v = version();
  return `${v.major}.${v.minor}.${v.revision}`;
}

/**
 * Run a function with automatic library initialization and shutdown
 * @param fn - The function to run
 * @param libraryPath - Optional path to the library file or FetchOptions
 */
export async function withLibrary<T>(
  fn: () => T | Promise<T>,
  libraryPath?: string | FetchOptions,
): Promise<T> {
  await init(libraryPath);
  try {
    return await fn();
  } finally {
    shutdown();
  }
}
