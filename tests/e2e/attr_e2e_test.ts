/**
 * E2E tests for git attribute operations
 */

import { assert, assertEquals } from "@std/assert";
import { createTestContext, setupLibrary } from "./helpers.ts";
import { GitAttrValue } from "../../mod.ts";

Deno.test("E2E Attr Tests", async (t) => {
  using _git = await setupLibrary();

  await t.step("get attribute for file with no attributes", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

    // Get attribute for a file with no .gitattributes
    const value = ctx.repo.getAttr("README.md", "text");
    // Should be unspecified
    assertEquals(value.type, GitAttrValue.UNSPECIFIED);
  });

  await t.step("get attribute set to true", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes with text attribute set
    await Deno.writeTextFile(`${ctx.repoPath}/.gitattributes`, "*.md text\n");

    // Create a markdown file
    await Deno.writeTextFile(`${ctx.repoPath}/README.md`, "# Hello\n");

    // Get attribute
    const value = ctx.repo.getAttr("README.md", "text");
    assertEquals(value.type, GitAttrValue.TRUE);
  });

  await t.step("get attribute set to false", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes with text attribute unset
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.bin -text\n",
    );

    // Create a binary file
    await Deno.writeTextFile(`${ctx.repoPath}/data.bin`, "binary data");

    // Get attribute
    const value = ctx.repo.getAttr("data.bin", "text");
    assertEquals(value.type, GitAttrValue.FALSE);
  });

  await t.step("get attribute with string value", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes with eol attribute
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt eol=lf\n",
    );

    // Create a text file
    await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "hello\n");

    // Get attribute
    const value = ctx.repo.getAttr("file.txt", "eol");
    assertEquals(value.type, GitAttrValue.STRING);
    assertEquals(value.value, "lf");
  });

  await t.step("get multiple attributes at once", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes with multiple attributes
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt text eol=lf diff\n",
    );

    // Create a text file
    await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "hello\n");

    // Get multiple attributes
    const values = ctx.repo.getAttrMany("file.txt", [
      "text",
      "eol",
      "diff",
      "binary",
    ]);

    assertEquals(values.length, 4);
    assertEquals(values[0].type, GitAttrValue.TRUE); // text
    assertEquals(values[1].type, GitAttrValue.STRING); // eol
    assertEquals(values[1].value, "lf");
    assertEquals(values[2].type, GitAttrValue.TRUE); // diff
    assertEquals(values[3].type, GitAttrValue.UNSPECIFIED); // binary (not set)
  });

  await t.step("iterate over all attributes for a file", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes with multiple attributes
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt text eol=lf diff\n",
    );

    // Create a text file
    await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "hello\n");

    // Iterate over attributes
    const attrs: Array<{ name: string; value: string | null }> = [];
    ctx.repo.foreachAttr("file.txt", (name, value) => {
      attrs.push({ name, value });
      return 0;
    });

    // Should have our attributes
    assert(attrs.length >= 3);
    assert(attrs.some((a) => a.name === "text"));
    assert(attrs.some((a) => a.name === "eol" && a.value === "lf"));
    assert(attrs.some((a) => a.name === "diff"));
  });

  await t.step("flush attribute cache", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt text\n",
    );
    await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "hello\n");

    // Get attribute
    let value = ctx.repo.getAttr("file.txt", "text");
    assertEquals(value.type, GitAttrValue.TRUE);

    // Modify .gitattributes
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt -text\n",
    );

    // Flush cache
    ctx.repo.attrCacheFlush();

    // Get attribute again - should be updated
    value = ctx.repo.getAttr("file.txt", "text");
    assertEquals(value.type, GitAttrValue.FALSE);
  });

  await t.step("add attribute macro", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Add a custom macro
    ctx.repo.addAttrMacro("mytext", "text eol=lf diff");

    // Create .gitattributes using the macro
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt mytext\n",
    );
    await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "hello\n");

    // The macro should expand to the individual attributes
    const textValue = ctx.repo.getAttr("file.txt", "text");
    const eolValue = ctx.repo.getAttr("file.txt", "eol");
    const diffValue = ctx.repo.getAttr("file.txt", "diff");

    assertEquals(textValue.type, GitAttrValue.TRUE);
    assertEquals(eolValue.type, GitAttrValue.STRING);
    assertEquals(eolValue.value, "lf");
    assertEquals(diffValue.type, GitAttrValue.TRUE);
  });

  await t.step("binary attribute macro", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Use built-in binary macro
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.bin binary\n",
    );
    await Deno.writeTextFile(`${ctx.repoPath}/data.bin`, "binary");

    // Binary macro sets -diff -merge -text
    const diffValue = ctx.repo.getAttr("data.bin", "diff");
    const mergeValue = ctx.repo.getAttr("data.bin", "merge");
    const textValue = ctx.repo.getAttr("data.bin", "text");

    assertEquals(diffValue.type, GitAttrValue.FALSE);
    assertEquals(mergeValue.type, GitAttrValue.FALSE);
    assertEquals(textValue.type, GitAttrValue.FALSE);
  });

  await t.step("attribute for non-existent file", async () => {
    await using ctx = await createTestContext({ withInitialCommit: false });

    // Create .gitattributes
    await Deno.writeTextFile(
      `${ctx.repoPath}/.gitattributes`,
      "*.txt text\n",
    );

    // Get attribute for non-existent file (should still work based on pattern)
    const value = ctx.repo.getAttr("nonexistent.txt", "text");
    assertEquals(value.type, GitAttrValue.TRUE);
  });
});
