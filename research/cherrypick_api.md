# Cherry-pick API Research

## git_cherrypick_options struct

```c
typedef struct {
    unsigned int version;
    unsigned int mainline;           // For merge commits, parent to use
    git_merge_options merge_opts;    // Options for merging
    git_checkout_options checkout_opts; // Options for checkout
} git_cherrypick_options;

#define GIT_CHERRYPICK_OPTIONS_VERSION 1
```

## Functions

### git_cherrypick_options_init

```c
GIT_EXTERN(int) git_cherrypick_options_init(
    git_cherrypick_options *opts,
    unsigned int version);
```

Initialize options struct with defaults.

### git_cherrypick_commit

```c
GIT_EXTERN(int) git_cherrypick_commit(
    git_index **out,
    git_repository *repo,
    git_commit *cherrypick_commit,
    git_commit *our_commit,
    unsigned int mainline,
    const git_merge_options *merge_options);
```

Cherry-pick a commit against another commit, producing an index.

- `out` - Pointer to store result index (must be freed with git_index_free)
- `repo` - Repository containing the commits
- `cherrypick_commit` - The commit to cherry-pick
- `our_commit` - The commit to cherry-pick against (e.g., HEAD)
- `mainline` - Parent of cherrypick_commit if it's a merge (0 for non-merge)
- `merge_options` - Merge options or NULL for defaults

Returns 0 on success, -1 on failure.

### git_cherrypick

```c
GIT_EXTERN(int) git_cherrypick(
    git_repository *repo,
    git_commit *commit,
    const git_cherrypick_options *cherrypick_options);
```

Cherry-pick a commit, modifying index and working directory.

- `repo` - Repository to cherry-pick in
- `commit` - Commit to cherry-pick
- `cherrypick_options` - Options or NULL for defaults

Returns 0 on success, -1 on failure.

## Implementation Plan

1. Add FFI symbols:
   - `git_cherrypick_options_init`
   - `git_cherrypick_commit`
   - `git_cherrypick`

2. Create cherrypick.ts module with:
   - `CherrypickOptions` interface
   - `cherrypickCommit()` function - returns Index
   - `cherrypick()` function - modifies working directory

3. Add Repository methods:
   - `repo.cherrypickCommit(commitOid, ourCommitOid, options)`
   - `repo.cherrypick(commitOid, options)`
