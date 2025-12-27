/**
 * Basic usage example for deno-libgit2
 *
 * This example demonstrates:
 * - Initializing the library
 * - Opening/creating repositories
 * - Getting repository information
 * - Listing branches and references
 * - Walking commit history
 *
 * Run with: deno run --allow-ffi --allow-read --allow-write examples/basic_usage.ts
 */

import {
  createCommit,
  GitBranchType,
  Index,
  init,
  Repository,
  shutdown,
  version,
} from "../mod.ts";

// Initialize libgit2
console.log("Initializing libgit2...");
await init();

try {
  // Print version
  const v = version();
  console.log(`libgit2 version: ${v.major}.${v.minor}.${v.revision}\n`);

  // Create a temporary directory for our test repository
  const tempDir = Deno.makeTempDirSync({ prefix: "libgit2_example_" });
  console.log(`Creating repository in: ${tempDir}\n`);

  {
    // Initialize a new repository
    using repo = Repository.init(tempDir);
    console.log("Repository initialized!");
    console.log(`  Path: ${repo.path}`);
    console.log(`  Working directory: ${repo.workdir}`);
    console.log(`  Is bare: ${repo.isBare}`);
    console.log(`  Is empty: ${repo.isEmpty}`);
    console.log();

    // Create a file and stage it
    const testFile = `${tempDir}/README.md`;
    Deno.writeTextFileSync(testFile, "# Test Repository\n\nThis is a test.\n");
    console.log("Created README.md");

    // Stage the file
    using index = Index.fromRepository(repo);
    index.add("README.md");
    index.write();
    console.log("Staged README.md");
    console.log(`  Index entry count: ${index.entryCount}`);
    console.log();

    // Create a commit
    const commitOid = createCommit(repo, {
      message: "Initial commit\n\nThis is the first commit in the repository.",
      author: {
        name: "Test Author",
        email: "test@example.com",
      },
    });
    console.log(`Created commit: ${commitOid}`);
    console.log();

    // Get HEAD information
    console.log("HEAD information:");
    const head = repo.head();
    console.log(`  Name: ${head.name}`);
    console.log(`  Type: ${head.type}`);
    console.log(`  Is branch: ${head.isBranch}`);
    console.log(`  Target: ${head.target ?? head.symbolicTarget}`);
    console.log();

    // List branches
    console.log("Branches:");
    const branches = repo.listBranches(GitBranchType.LOCAL);
    for (const branch of branches) {
      const headMarker = branch.isHead ? " *" : "";
      console.log(`  ${branch.name}${headMarker}`);
      console.log(`    Reference: ${branch.refName}`);
      console.log(`    Target: ${branch.targetOid?.slice(0, 7)}`);
    }
    console.log();

    // Create another file and commit
    const anotherFile = `${tempDir}/hello.txt`;
    Deno.writeTextFileSync(anotherFile, "Hello, World!\n");
    index.add("hello.txt");
    index.write();

    const secondCommitOid = createCommit(repo, {
      message: "Add hello.txt",
      author: {
        name: "Test Author",
        email: "test@example.com",
      },
    });
    console.log(`Created second commit: ${secondCommitOid}`);
    console.log();

    // Walk commit history
    console.log("Commit history:");
    const commits = repo.getCommits(undefined, 10);
    for (const commit of commits) {
      const shortOid = commit.oid.slice(0, 7);
      const firstLine = commit.message.split("\n")[0];
      console.log(`  ${shortOid} ${firstLine}`);
      console.log(`    Author: ${commit.author.name} <${commit.author.email}>`);
      console.log(
        `    Date: ${
          new Date(Number(commit.author.when.time) * 1000).toISOString()
        }`,
      );
    }
    console.log();

    // List references
    console.log("References:");
    const refs = repo.listReferences();
    for (const ref of refs) {
      console.log(`  ${ref}`);
    }
    console.log();

    // Get repository status
    console.log("Repository status:");
    const status = repo.status();
    if (status.length === 0) {
      console.log("  Working directory clean");
    } else {
      for (const entry of status) {
        console.log(
          `  ${entry.status}: ${entry.indexPath ?? entry.workdirPath}`,
        );
      }
    }
    console.log();

    // Create a new branch
    const newBranchOid = repo.headOid();
    const newBranch = repo.createBranch("feature-branch", newBranchOid);
    console.log(`Created branch: ${newBranch.name}`);
    console.log();

    // List branches again
    console.log("Branches after creating feature-branch:");
    const allBranches = repo.listBranches(GitBranchType.LOCAL);
    for (const branch of allBranches) {
      const headMarker = branch.isHead ? " *" : "";
      console.log(`  ${branch.name}${headMarker}`);
    }
    console.log();
  }

  // Remove temporary directory
  Deno.removeSync(tempDir, { recursive: true });
  console.log("Cleaned up temporary repository");
} catch (error) {
  console.error("Error:", error);
  throw error;
} finally {
  // Always shutdown libgit2
  shutdown();
  console.log("\nlibgit2 shutdown complete");
}
