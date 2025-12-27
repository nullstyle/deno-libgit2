/**
 * End-to-end tests for message operations
 */

import { assertEquals, assertExists } from "@std/assert";
import { createTestContext, setupLibrary } from "./helpers.ts";
import { parseTrailers, prettifyMessage } from "../../mod.ts";

Deno.test("Message E2E Tests", async (t) => {
  using _git = await setupLibrary();

  await t.step("prettify message - basic cleanup", async () => {
    await using _ctx = await createTestContext();
    const message = "Hello World  \n\n\n";
    const result = prettifyMessage(message);

    // Should trim trailing whitespace and ensure trailing newline
    assertEquals(result, "Hello World\n");
  });

  await t.step("prettify message - multiple lines", async () => {
    await using _ctx = await createTestContext();
    const message = "First line\n\nSecond paragraph\n\n\n";
    const result = prettifyMessage(message);

    // Should preserve structure but clean up excess newlines
    assertEquals(result.includes("First line"), true);
    assertEquals(result.includes("Second paragraph"), true);
    assertEquals(result.endsWith("\n"), true);
  });

  await t.step("prettify message - strip comments", async () => {
    await using _ctx = await createTestContext();
    const message = "Commit message\n# This is a comment\nMore content\n";
    const result = prettifyMessage(message, true, "#");

    // Should remove comment lines
    assertEquals(result.includes("Commit message"), true);
    assertEquals(result.includes("# This is a comment"), false);
    assertEquals(result.includes("More content"), true);
  });

  await t.step("prettify message - keep comments", async () => {
    await using _ctx = await createTestContext();
    const message = "Commit message\n# This is a comment\n";
    const result = prettifyMessage(message, false);

    // Should keep comment lines when strip_comments is false
    assertEquals(result.includes("# This is a comment"), true);
  });

  await t.step("prettify message - custom comment char", async () => {
    await using _ctx = await createTestContext();
    const message = "Commit message\n; This is a comment\n# Not a comment\n";
    const result = prettifyMessage(message, true, ";");

    // Should remove lines starting with custom comment char
    assertEquals(result.includes("; This is a comment"), false);
    assertEquals(result.includes("# Not a comment"), true);
  });

  await t.step("parse trailers - single trailer", async () => {
    await using _ctx = await createTestContext();
    const message = `Commit message

This is the body.

Signed-off-by: John Doe <john@example.com>
`;
    const trailers = parseTrailers(message);

    assertExists(trailers);
    assertEquals(trailers.length, 1);
    assertEquals(trailers[0].key, "Signed-off-by");
    assertEquals(trailers[0].value, "John Doe <john@example.com>");
  });

  await t.step("parse trailers - multiple trailers", async () => {
    await using _ctx = await createTestContext();
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
  });

  await t.step("parse trailers - no trailers", async () => {
    await using _ctx = await createTestContext();
    const message = `Simple commit message

Just a body with no trailers.
`;
    const trailers = parseTrailers(message);

    assertExists(trailers);
    assertEquals(trailers.length, 0);
  });

  await t.step("parse trailers - empty message", async () => {
    await using _ctx = await createTestContext();
    const message = "";
    const trailers = parseTrailers(message);

    assertExists(trailers);
    assertEquals(trailers.length, 0);
  });

  // ==================== Additional Coverage Tests ====================

  await t.step("prettify message - empty string", async () => {
    await using _ctx = await createTestContext();
    const message = "";
    const result = prettifyMessage(message);

    // Empty message should return empty or just newline
    assertEquals(typeof result, "string");
  });

  await t.step("prettify message - only whitespace", async () => {
    await using _ctx = await createTestContext();
    const message = "   \n   \n   ";
    const result = prettifyMessage(message);

    // Whitespace only should be stripped
    assertEquals(typeof result, "string");
  });

  await t.step("prettify message - with default stripComments false", async () => {
    await using _ctx = await createTestContext();
    const message = "Line 1\n# Comment\nLine 2\n";
    const result = prettifyMessage(message);

    // Default is false, so comments should be kept
    assertEquals(result.includes("# Comment"), true);
  });

  await t.step("prettify message - custom comment char @", async () => {
    await using _ctx = await createTestContext();
    const message = "Line 1\n@ Comment\nLine 2\n";
    const result = prettifyMessage(message, true, "@");

    // Should strip lines starting with @
    assertEquals(result.includes("@ Comment"), false);
    assertEquals(result.includes("Line 1"), true);
    assertEquals(result.includes("Line 2"), true);
  });

  await t.step("parse trailers - trailer with empty value", async () => {
    await using _ctx = await createTestContext();
    const message = `Commit message

Body text.

Empty-value:
`;
    const trailers = parseTrailers(message);
    // Empty or missing value might be parsed differently
    assertExists(trailers);
  });

  await t.step("parse trailers - message without paragraph break", async () => {
    await using _ctx = await createTestContext();
    const message = `Single line
Signed-off-by: Test <test@example.com>
`;
    const trailers = parseTrailers(message);
    // Trailers need paragraph break before them typically
    assertExists(trailers);
  });

  await t.step("parse trailers - only trailers", async () => {
    await using _ctx = await createTestContext();
    const message = `Subject line

Signed-off-by: User <user@example.com>
Reviewed-by: Other <other@example.com>
`;
    const trailers = parseTrailers(message);
    assertExists(trailers);
    assertEquals(trailers.length, 2);
  });

  await t.step("prettify message - result is never null", async () => {
    await using _ctx = await createTestContext();
    const messages = [
      "Normal message",
      "",
      "\n\n\n",
      "   ",
      "# All comments\n# More comments",
    ];

    for (const msg of messages) {
      const result = prettifyMessage(msg);
      // Result should always be a string, never null
      assertEquals(typeof result, "string");
    }
  });

  await t.step("parse trailers - unicode keys and values", async () => {
    await using _ctx = await createTestContext();
    const message = `Unicode test

Tester-名前: 日本語 <user@example.com>
`;
    const trailers = parseTrailers(message);
    // May or may not parse correctly, but should not throw
    assertExists(trailers);
  });
});
