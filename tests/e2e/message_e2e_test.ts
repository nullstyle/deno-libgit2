/**
 * End-to-end tests for message operations
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import {
  createTestContext,
  cleanupTestContext,
} from "./helpers.ts";
import { init, shutdown, prettifyMessage, parseTrailers } from "../../mod.ts";

Deno.test("Message E2E Tests", async (t) => {
  init();

  await t.step("prettify message - basic cleanup", async () => {
    const ctx = await createTestContext();
    try {
      const message = "Hello World  \n\n\n";
      const result = prettifyMessage(message);
      
      // Should trim trailing whitespace and ensure trailing newline
      assertEquals(result, "Hello World\n");
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("prettify message - multiple lines", async () => {
    const ctx = await createTestContext();
    try {
      const message = "First line\n\nSecond paragraph\n\n\n";
      const result = prettifyMessage(message);
      
      // Should preserve structure but clean up excess newlines
      assertEquals(result.includes("First line"), true);
      assertEquals(result.includes("Second paragraph"), true);
      assertEquals(result.endsWith("\n"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("prettify message - strip comments", async () => {
    const ctx = await createTestContext();
    try {
      const message = "Commit message\n# This is a comment\nMore content\n";
      const result = prettifyMessage(message, true, "#");
      
      // Should remove comment lines
      assertEquals(result.includes("Commit message"), true);
      assertEquals(result.includes("# This is a comment"), false);
      assertEquals(result.includes("More content"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("prettify message - keep comments", async () => {
    const ctx = await createTestContext();
    try {
      const message = "Commit message\n# This is a comment\n";
      const result = prettifyMessage(message, false);
      
      // Should keep comment lines when strip_comments is false
      assertEquals(result.includes("# This is a comment"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("prettify message - custom comment char", async () => {
    const ctx = await createTestContext();
    try {
      const message = "Commit message\n; This is a comment\n# Not a comment\n";
      const result = prettifyMessage(message, true, ";");
      
      // Should remove lines starting with custom comment char
      assertEquals(result.includes("; This is a comment"), false);
      assertEquals(result.includes("# Not a comment"), true);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("parse trailers - single trailer", async () => {
    const ctx = await createTestContext();
    try {
      const message = `Commit message

This is the body.

Signed-off-by: John Doe <john@example.com>
`;
      const trailers = parseTrailers(message);
      
      assertExists(trailers);
      assertEquals(trailers.length, 1);
      assertEquals(trailers[0].key, "Signed-off-by");
      assertEquals(trailers[0].value, "John Doe <john@example.com>");
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("parse trailers - multiple trailers", async () => {
    const ctx = await createTestContext();
    try {
      const message = `Fix bug in parser

This commit fixes a critical bug.

Signed-off-by: John Doe <john@example.com>
Co-authored-by: Jane Smith <jane@example.com>
Reviewed-by: Bob Wilson <bob@example.com>
`;
      const trailers = parseTrailers(message);
      
      assertExists(trailers);
      assertEquals(trailers.length, 3);
      assertEquals(trailers[0].key, "Signed-off-by");
      assertEquals(trailers[1].key, "Co-authored-by");
      assertEquals(trailers[2].key, "Reviewed-by");
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("parse trailers - no trailers", async () => {
    const ctx = await createTestContext();
    try {
      const message = `Simple commit message

Just a body with no trailers.
`;
      const trailers = parseTrailers(message);
      
      assertExists(trailers);
      assertEquals(trailers.length, 0);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  await t.step("parse trailers - empty message", async () => {
    const ctx = await createTestContext();
    try {
      const message = "";
      const trailers = parseTrailers(message);
      
      assertExists(trailers);
      assertEquals(trailers.length, 0);
    } finally {
      await cleanupTestContext(ctx);
    }
  });

  shutdown();
});
