/**
 * Deleted File History Example
 *
 * This example demonstrates how to find the history of a deleted file
 * and retrieve its content at the time of deletion.
 *
 * Use case: A git-backed wiki app stores markdown documents at
 * `.dork/blocks/[UUIDv7].md`. When a block file gets deleted but is
 * still referenced by other blocks, we need to:
 * 1. Find all commits where the deleted file appeared
 * 2. Get the content of the file at the time it was deleted
 *
 * Run with:
 *   deno run --allow-ffi --allow-read examples/deleted_file_history.ts /path/to/repo .dork/blocks/some-uuid.md
 */

import {
  fileExistsAtHead,
  findFileCreation,
  findFileDeletion,
  findFileHistory,
  findFileModifications,
  init,
  Repository,
  shutdown,
} from "../mod.ts";

// Get command line arguments
const repoPath = Deno.args[0];
const filePath = Deno.args[1];

if (!repoPath || !filePath) {
  console.error(
    "Usage: deno run --allow-ffi --allow-read examples/deleted_file_history.ts <repo_path> <file_path>",
  );
  console.error("");
  console.error("Example:");
  console.error(
    "  deno run --allow-ffi --allow-read examples/deleted_file_history.ts /path/to/wiki .dork/blocks/0190a1b2-c3d4-7e5f.md",
  );
  Deno.exit(1);
}

// Initialize libgit2
await init();

try {
  console.log(`\n📂 Repository: ${repoPath}`);
  console.log(`📄 File: ${filePath}\n`);

  using repo = Repository.open(repoPath);

  // Check if file currently exists
  const exists = fileExistsAtHead(repo, filePath);
  console.log(
    `Current status: ${
      exists ? "✅ File exists at HEAD" : "❌ File does NOT exist at HEAD"
    }\n`,
  );

  // ============================================================
  // 1. Find all commits where the file existed
  // ============================================================
  console.log("=".repeat(60));
  console.log("📜 FILE HISTORY - All commits where the file existed");
  console.log("=".repeat(60));

  const history = findFileHistory(repo, filePath, {
    includeContent: true,
  });

  if (history.commits.length === 0) {
    console.log("\n⚠️  File was never found in the repository history.\n");
  } else {
    console.log(
      `\nFound ${history.commits.length} commit(s) containing this file:\n`,
    );

    for (const commit of history.commits) {
      const shortOid = commit.commitOid.slice(0, 7);
      const dateStr = commit.date.toISOString().split("T")[0];
      console.log(`  ${shortOid} │ ${dateStr} │ ${commit.author}`);
      console.log(`           │ ${commit.message}`);
      console.log("");
    }
  }

  // ============================================================
  // 2. Find when the file was deleted (if it was)
  // ============================================================
  if (!exists && history.commits.length > 0) {
    console.log("=".repeat(60));
    console.log("🗑️  FILE DELETION - When and where the file was deleted");
    console.log("=".repeat(60));

    const deletion = findFileDeletion(repo, filePath, {
      includeContent: true,
    });

    if (deletion) {
      console.log("\n📍 Deletion detected!\n");
      console.log(
        `  Deleted in commit:     ${
          deletion.deletedInCommit.commitOid.slice(0, 7)
        }`,
      );
      console.log(
        `    Date:                ${deletion.deletedInCommit.date.toISOString()}`,
      );
      console.log(
        `    Author:              ${deletion.deletedInCommit.author} <${deletion.deletedInCommit.email}>`,
      );
      console.log(
        `    Message:             ${deletion.deletedInCommit.message}`,
      );
      console.log("");
      console.log(
        `  Last existed in:       ${
          deletion.lastExistedInCommit.commitOid.slice(0, 7)
        }`,
      );
      console.log(
        `    Date:                ${deletion.lastExistedInCommit.date.toISOString()}`,
      );
      console.log(
        `    Author:              ${deletion.lastExistedInCommit.author}`,
      );
      console.log(
        `    Message:             ${deletion.lastExistedInCommit.message}`,
      );

      if (deletion.lastContent) {
        console.log("\n" + "-".repeat(60));
        console.log("📝 CONTENT AT TIME OF DELETION:");
        console.log("-".repeat(60));
        console.log(deletion.lastContent);
        console.log("-".repeat(60));
      }
    } else {
      console.log("\n⚠️  Could not determine deletion point.\n");
    }
  }

  // ============================================================
  // 3. Find commits that modified the file
  // ============================================================
  if (history.commits.length > 1) {
    console.log("\n" + "=".repeat(60));
    console.log("✏️  FILE MODIFICATIONS - Commits that changed the file");
    console.log("=".repeat(60));

    const modifications = findFileModifications(repo, filePath);

    if (modifications.length > 0) {
      console.log(
        `\nFile was modified in ${modifications.length} commit(s):\n`,
      );

      for (const commit of modifications) {
        const shortOid = commit.commitOid.slice(0, 7);
        const dateStr = commit.date.toISOString().split("T")[0];
        console.log(`  ${shortOid} │ ${dateStr} │ ${commit.message}`);
      }
    }
  }

  // ============================================================
  // 4. Find when the file was first created
  // ============================================================
  if (history.commits.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("🆕 FILE CREATION - When the file was first added");
    console.log("=".repeat(60));

    const creation = findFileCreation(repo, filePath);

    if (creation) {
      console.log(
        `\n  First appeared in:     ${creation.commitOid.slice(0, 7)}`,
      );
      console.log(`    Date:                ${creation.date.toISOString()}`);
      console.log(
        `    Author:              ${creation.author} <${creation.email}>`,
      );
      console.log(`    Message:             ${creation.message}`);
    }
  }

  console.log("\n");

  // Clean up
} catch (error) {
  console.error("Error:", error);
  Deno.exit(1);
} finally {
  shutdown();
}
