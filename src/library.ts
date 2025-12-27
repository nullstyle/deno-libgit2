/**
 * @module library
 * Library loading and initialization for libgit2
 */

import { symbols, getLibrarySearchPaths } from "./ffi.ts";
import { GitError } from "./error.ts";
import { GitErrorCode } from "./types.ts";
import { createOutPointer, readInt32, ptrOf } from "./utils.ts";

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
 * Load the libgit2 library
 * @param path - Optional path to the library file
 */
export function loadLibrary(path?: string): LibGit2 {
  if (_lib !== null) {
    return _lib;
  }

  const searchPaths = path ? [path] : getLibrarySearchPaths();
  let lastError: Error | null = null;

  for (const libPath of searchPaths) {
    try {
      _lib = Deno.dlopen(libPath, symbols);
      return _lib;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next path
    }
  }

  throw new GitError(
    `Failed to load libgit2 library. Tried paths: ${searchPaths.join(", ")}. ` +
    `Last error: ${lastError?.message ?? "unknown"}. ` +
    `Please ensure libgit2 is installed on your system.`,
    GitErrorCode.ERROR
  );
}

/**
 * Get the loaded library instance
 * @throws GitError if library is not loaded
 */
export function getLibrary(): LibGit2 {
  if (_lib === null) {
    throw new GitError(
      "libgit2 library not loaded. Call loadLibrary() or init() first.",
      GitErrorCode.ERROR
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
 * Initialize the libgit2 library
 * This must be called before using any other libgit2 functions.
 * Can be called multiple times; each call must be matched with a shutdown() call.
 * @param libraryPath - Optional path to the library file
 * @returns The number of initializations (including this one)
 */
export function init(libraryPath?: string): number {
  const lib = loadLibrary(libraryPath);
  const result = lib.symbols.git_libgit2_init();
  
  if (result < 0) {
    throw new GitError(
      `Failed to initialize libgit2: ${result}`,
      GitErrorCode.ERROR
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
    ptrOf(revBuf)
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
 * @param libraryPath - Optional path to the library file
 */
export async function withLibrary<T>(
  fn: () => T | Promise<T>,
  libraryPath?: string
): Promise<T> {
  init(libraryPath);
  try {
    return await fn();
  } finally {
    shutdown();
  }
}

/**
 * Run a synchronous function with automatic library initialization and shutdown
 * @param fn - The function to run
 * @param libraryPath - Optional path to the library file
 */
export function withLibrarySync<T>(
  fn: () => T,
  libraryPath?: string
): T {
  init(libraryPath);
  try {
    return fn();
  } finally {
    shutdown();
  }
}
