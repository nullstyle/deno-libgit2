/**
 * @module library
 * Library loading and initialization for libgit2
 *
 * Uses @denosaurs/plug for cross-platform library loading with automatic
 * caching and path resolution. By default, downloads pre-built binaries from
 * GitHub releases for macOS and Linux. Use `preferSystemLibGit2: true` to
 * use system-installed libgit2 instead.
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
 * Options for initializing libgit2
 */
export interface InitOptions {
  /**
   * If true, prefer system-installed libgit2 over downloading from GitHub releases.
   * Default is false (download pre-built binaries).
   */
  preferSystemLibGit2?: boolean;
}

/**
 * The version of libgit2 that pre-built binaries are compiled against
 */
export const LIBGIT2_VERSION = "1.9.2";

/**
 * GitHub repository for pre-built binaries
 */
const GITHUB_REPO = "nullstyle/deno-libgit2";

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
 * Get the base URL for GitHub releases
 */
function getGitHubReleaseUrl(filename: string): string {
  return `https://github.com/${GITHUB_REPO}/releases/download/v${LIBGIT2_VERSION}/${filename}`;
}

/**
 * Get the fetch options for downloading pre-built binaries from GitHub releases
 */
function getGitHubReleaseFetchOptions(): FetchOptions {
  return {
    name: "git2",
    url: {
      darwin: {
        aarch64: getGitHubReleaseUrl("libgit2-darwin-aarch64.dylib"),
        x86_64: getGitHubReleaseUrl("libgit2-darwin-x86_64.dylib"),
      },
      linux: {
        x86_64: getGitHubReleaseUrl("libgit2-linux-x86_64.so"),
        aarch64: getGitHubReleaseUrl("libgit2-linux-aarch64.so"),
      },
      // Other platforms require system-installed libgit2
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
 * Get the fetch options for system-installed libgit2
 */
function getSystemLibraryFetchOptions(): FetchOptions {
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
 * Check if system library should be used (via environment variable)
 */
function shouldUseSystemLibrary(): boolean {
  try {
    const envValue = Deno.env.get("DENO_LIBGIT2_USE_SYSTEM");
    return envValue === "1" || envValue === "true";
  } catch {
    // Env permission may not be granted
    return false;
  }
}

/**
 * Get the default library fetch options for libgit2
 * @param preferSystem - If true, use system-installed libgit2. Default is false.
 *                       Can also be set via DENO_LIBGIT2_USE_SYSTEM=1 environment variable.
 */
function getDefaultFetchOptions(preferSystem?: boolean): FetchOptions {
  // If preferSystem is explicitly set, use that value
  // Otherwise, check the environment variable
  const useSystem = preferSystem ?? shouldUseSystemLibrary();

  if (useSystem) {
    return getSystemLibraryFetchOptions();
  }
  return getGitHubReleaseFetchOptions();
}

/**
 * Type guard to check if an object is InitOptions
 */
function isInitOptions(
  options: FetchOptions | InitOptions,
): options is InitOptions {
  return (
    typeof options === "object" &&
    options !== null &&
    "preferSystemLibGit2" in options &&
    // Make sure it's not a FetchOptions with preferSystemLibGit2 by accident
    !("name" in options) &&
    !("url" in options)
  );
}

/**
 * Load the libgit2 library
 * @param options - Optional path to the library file, FetchOptions, or InitOptions
 */
export function loadLibrary(
  options?: string | FetchOptions | InitOptions,
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
      let fetchOptions: string | FetchOptions;

      if (options === undefined) {
        // Default: use env var or download from GitHub releases
        fetchOptions = getDefaultFetchOptions();
      } else if (typeof options === "string") {
        // Direct path provided
        fetchOptions = options;
      } else if (isInitOptions(options)) {
        // InitOptions provided
        fetchOptions = getDefaultFetchOptions(options.preferSystemLibGit2);
      } else {
        // FetchOptions provided
        fetchOptions = options;
      }

      _lib = await dlopen(fetchOptions, symbols);
      return _lib;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitError(
        `Failed to load libgit2 library: ${message}. ` +
          `Try using init({ preferSystemLibGit2: true }) if you have libgit2 installed, ` +
          `or ensure network access to download pre-built binaries.`,
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
 *
 * By default, downloads pre-built binaries from GitHub releases for macOS and Linux.
 * Use `{ preferSystemLibGit2: true }` to use system-installed libgit2 instead.
 *
 * @param options - Optional path to the library file, FetchOptions, or InitOptions
 * @returns The number of initializations (including this one)
 *
 * @example
 * // Default: download pre-built binaries from GitHub releases
 * await init();
 *
 * @example
 * // Use system-installed libgit2
 * await init({ preferSystemLibGit2: true });
 *
 * @example
 * // Use a specific library path
 * await init("/custom/path/to/libgit2.dylib");
 */
export async function init(
  options?: string | FetchOptions | InitOptions,
): Promise<number> {
  const lib = await loadLibrary(options);
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
 * @param options - Optional path to the library file, FetchOptions, or InitOptions
 */
export async function withLibrary<T>(
  fn: () => T | Promise<T>,
  options?: string | FetchOptions | InitOptions,
): Promise<T> {
  await init(options);
  try {
    return await fn();
  } finally {
    shutdown();
  }
}

/**
 * Resource handle returned by initGit() for use with `using` syntax.
 * Automatically calls shutdown() when disposed.
 */
export interface GitLibrary extends Disposable {
  /**
   * The libgit2 version information
   */
  readonly version: { major: number; minor: number; revision: number };

  /**
   * The libgit2 version as a string
   */
  readonly versionString: string;

  /**
   * Manually shutdown the library (also called automatically on dispose)
   */
  shutdown(): number;
}

/**
 * Initialize the libgit2 library with support for explicit resource management.
 * Use with `using` syntax for automatic cleanup.
 *
 * By default, downloads pre-built binaries from GitHub releases for macOS and Linux.
 * Use `{ preferSystemLibGit2: true }` to use system-installed libgit2 instead.
 *
 * @param options - Optional path to the library file, FetchOptions, or InitOptions
 * @returns A GitLibrary handle that can be used with `using`
 *
 * @example
 * // Automatic cleanup with `using`
 * using git = await initGit();
 * using repo = Repository.open(".");
 * console.log("HEAD:", repo.headOid());
 * // Library is automatically shut down when `git` goes out of scope
 *
 * @example
 * // Use system-installed libgit2
 * using git = await initGit({ preferSystemLibGit2: true });
 *
 * @example
 * // Use a specific library path
 * using git = await initGit("/custom/path/to/libgit2.dylib");
 */
export async function initGit(
  options?: string | FetchOptions | InitOptions,
): Promise<GitLibrary> {
  await init(options);

  const lib: GitLibrary = {
    get version() {
      return version();
    },

    get versionString() {
      return versionString();
    },

    shutdown() {
      return shutdown();
    },

    [Symbol.dispose]() {
      shutdown();
    },
  };

  return lib;
}
