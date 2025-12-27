/**
 * Repository inspection example for deno-libgit2
 *
 * This example demonstrates:
 * - Opening an existing repository
 * - Inspecting repository state
 * - Listing commits, branches, and tags
 * - Getting file status
 *
 * Run with: deno run --allow-ffi --allow-read examples/inspect_repo.ts /path/to/repo
 */

import {
  GitBranchType,
  GitRepositoryState,
  GitStatusFlags,
  init,
  Repository,
  shutdown,
  version,
} from "../mod.ts";

// Get repository path from command line
const repoPath = Deno.args[0];

if (!repoPath) {
  console.error(
    "Usage: deno run --allow-ffi --allow-read examples/inspect_repo.ts /path/to/repo",
  );
  Deno.exit(1);
}

// Initialize libgit2
await init();

try {
  const v = version();
  console.log(`libgit2 version: ${v.major}.${v.minor}.${v.revision}`);
  console.log(`Inspecting repository: ${repoPath}\n`);

  // Open the repository
  using repo = Repository.open(repoPath);

  // Basic info
  console.log("=== Repository Info ===");
  console.log(`Path: ${repo.path}`);
  console.log(`Working directory: ${repo.workdir ?? "(bare repository)"}`);
  console.log(`Is bare: ${repo.isBare}`);
  console.log(`Is empty: ${repo.isEmpty}`);
  console.log(`Head detached: ${repo.isHeadDetached}`);

  // Repository state
  const stateNames: Record<GitRepositoryState, string> = {
    [GitRepositoryState.NONE]: "Normal",
    [GitRepositoryState.MERGE]: "Merge in progress",
    [GitRepositoryState.REVERT]: "Revert in progress",
    [GitRepositoryState.REVERT_SEQUENCE]: "Revert sequence in progress",
    [GitRepositoryState.CHERRYPICK]: "Cherry-pick in progress",
    [GitRepositoryState.CHERRYPICK_SEQUENCE]:
      "Cherry-pick sequence in progress",
    [GitRepositoryState.BISECT]: "Bisect in progress",
    [GitRepositoryState.REBASE]: "Rebase in progress",
    [GitRepositoryState.REBASE_INTERACTIVE]: "Interactive rebase in progress",
    [GitRepositoryState.REBASE_MERGE]: "Rebase merge in progress",
    [GitRepositoryState.APPLY_MAILBOX]: "Apply mailbox in progress",
    [GitRepositoryState.APPLY_MAILBOX_OR_REBASE]:
      "Apply mailbox or rebase in progress",
  };
  console.log(`State: ${stateNames[repo.state] ?? "Unknown"}`);
  console.log();

  // HEAD info
  if (!repo.isEmpty) {
    console.log("=== HEAD ===");
    try {
      const head = repo.head();
      console.log(`Reference: ${head.name}`);
      if (head.target) {
        console.log(`Target: ${head.target}`);
      }
      if (head.symbolicTarget) {
        console.log(`Symbolic target: ${head.symbolicTarget}`);
      }
    } catch (e) {
      console.log(`Could not get HEAD: ${e}`);
    }
    console.log();
  }

  // Branches
  console.log("=== Local Branches ===");
  const localBranches = repo.listBranches(GitBranchType.LOCAL);
  if (localBranches.length === 0) {
    console.log("(no local branches)");
  } else {
    for (const branch of localBranches) {
      const marker = branch.isHead ? "* " : "  ";
      const upstream = branch.upstream ? ` -> ${branch.upstream}` : "";
      console.log(`${marker}${branch.name}${upstream}`);
    }
  }
  console.log();

  console.log("=== Remote Branches ===");
  const remoteBranches = repo.listBranches(GitBranchType.REMOTE);
  if (remoteBranches.length === 0) {
    console.log("(no remote branches)");
  } else {
    for (const branch of remoteBranches) {
      console.log(`  ${branch.name}`);
    }
  }
  console.log();

  // References
  console.log("=== All References ===");
  const refs = repo.listReferences();
  if (refs.length === 0) {
    console.log("(no references)");
  } else {
    for (const ref of refs) {
      console.log(`  ${ref}`);
    }
  }
  console.log();

  // Recent commits
  if (!repo.isEmpty) {
    console.log("=== Recent Commits (last 10) ===");
    try {
      const commits = repo.getCommits(undefined, 10);
      for (const commit of commits) {
        const shortOid = commit.oid.slice(0, 7);
        const firstLine = commit.message.split("\n")[0].slice(0, 60);
        const date = new Date(Number(commit.author.when.time) * 1000);
        const dateStr = date.toISOString().split("T")[0];
        console.log(`${shortOid} ${dateStr} ${firstLine}`);
      }
    } catch (e) {
      console.log(`Could not get commits: ${e}`);
    }
    console.log();
  }

  // Working directory status
  if (!repo.isBare) {
    console.log("=== Working Directory Status ===");
    const status = repo.status();

    if (status.length === 0) {
      console.log("Working directory clean");
    } else {
      const statusLabels: Record<number, string> = {
        [GitStatusFlags.INDEX_NEW]: "new file (staged)",
        [GitStatusFlags.INDEX_MODIFIED]: "modified (staged)",
        [GitStatusFlags.INDEX_DELETED]: "deleted (staged)",
        [GitStatusFlags.INDEX_RENAMED]: "renamed (staged)",
        [GitStatusFlags.INDEX_TYPECHANGE]: "typechange (staged)",
        [GitStatusFlags.WT_NEW]: "untracked",
        [GitStatusFlags.WT_MODIFIED]: "modified",
        [GitStatusFlags.WT_DELETED]: "deleted",
        [GitStatusFlags.WT_TYPECHANGE]: "typechange",
        [GitStatusFlags.WT_RENAMED]: "renamed",
        [GitStatusFlags.IGNORED]: "ignored",
        [GitStatusFlags.CONFLICTED]: "conflicted",
      };

      for (const entry of status) {
        const path = entry.indexPath ?? entry.workdirPath ?? "(unknown)";
        const labels: string[] = [];

        for (const [flag, label] of Object.entries(statusLabels)) {
          if (entry.status & Number(flag)) {
            labels.push(label);
          }
        }

        console.log(`  ${labels.join(", ")}: ${path}`);
      }
    }
    console.log();
  }
} catch (error) {
  console.error("Error:", error);
  Deno.exit(1);
} finally {
  shutdown();
}
