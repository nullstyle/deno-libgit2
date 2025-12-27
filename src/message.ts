/**
 * @module message
 * Commit message operations - prettifying and parsing trailers
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  createGitBuf,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readGitBuf,
  readPointerValueFromPtrView,
  readSizeValueFromPtrView,
  toCString,
} from "./utils.ts";

/**
 * A git message trailer (key/value pair)
 */
export interface MessageTrailer {
  key: string;
  value: string;
}

/**
 * Clean up excess whitespace and ensure trailing newline in a message.
 * Optionally removes lines starting with a comment character.
 *
 * @param message - The message to be prettified
 * @param stripComments - Whether to remove comment lines (default: false)
 * @param commentChar - The comment character (default: '#')
 * @returns The prettified message
 */
export function prettifyMessage(
  message: string,
  stripComments: boolean = false,
  commentChar: string = "#",
): string {
  const lib = getLibrary();
  const buf = createGitBuf();
  const messagePtr = ptrOf(toCString(message));
  const charCode = commentChar.charCodeAt(0);

  try {
    const error = lib.symbols.git_message_prettify(
      ptrOf(buf),
      messagePtr,
      stripComments ? 1 : 0,
      charCode,
    );
    checkError(lib, error, "Failed to prettify message");
    const result = readGitBuf(buf);
    return result || "";
  } finally {
    lib.symbols.git_buf_dispose(ptrOf(buf));
  }
}

/**
 * Parse trailers from a commit message.
 * Trailers are key/value pairs in the last paragraph of a message.
 *
 * @param message - The message to parse
 * @returns Array of trailers found in the message
 */
export function parseTrailers(message: string): MessageTrailer[] {
  const lib = getLibrary();

  // git_message_trailer_array: { trailers: pointer, count: size_t, _trailer_block: pointer }
  const trailerArray = new Uint8Array(POINTER_SIZE * 3);
  const messagePtr = ptrOf(toCString(message));

  const error = lib.symbols.git_message_trailers(
    ptrOf(trailerArray),
    messagePtr,
  );

  // If parsing fails (e.g., empty message), return empty array
  if (error !== 0) {
    return [];
  }

  try {
    const view = new Deno.UnsafePointerView(ptrOf(trailerArray));
    const trailersPtrValue = readPointerValueFromPtrView(view, 0);
    const count = Number(readSizeValueFromPtrView(view, POINTER_SIZE));
    const trailersPtr = trailersPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(trailersPtrValue);

    if (count === 0 || trailersPtr === null) {
      return [];
    }

    const trailers: MessageTrailer[] = [];

    // Each git_message_trailer is two pointers.
    const trailerSize = POINTER_SIZE * 2;
    const trailersView = new Deno.UnsafePointerView(trailersPtr);

    for (let i = 0; i < count; i++) {
      const offset = i * trailerSize;
      const keyPtrValue = readPointerValueFromPtrView(trailersView, offset);
      const valuePtrValue = readPointerValueFromPtrView(
        trailersView,
        offset + POINTER_SIZE,
      );
      const keyPtr = keyPtrValue === 0n
        ? null
        : Deno.UnsafePointer.create(keyPtrValue);
      const valuePtr = valuePtrValue === 0n
        ? null
        : Deno.UnsafePointer.create(valuePtrValue);

      if (keyPtr && valuePtr) {
        const key = fromCString(keyPtr);
        const value = fromCString(valuePtr);
        if (key && value) {
          trailers.push({ key, value });
        }
      }
    }

    return trailers;
  } finally {
    lib.symbols.git_message_trailer_array_free(ptrOf(trailerArray));
  }
}
