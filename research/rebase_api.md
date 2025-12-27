# Rebase API Research (libgit2 v1.1.0)

## Rebase Options Structure

```c
typedef struct {
    unsigned int version;
    int quiet;                           // Quiet rebase experience
    int inmemory;                        // In-memory rebase (no working dir changes)
    const char *rewrite_notes_ref;       // Notes reference for rewriting
    git_merge_options merge_options;     // Merge options
    git_checkout_options checkout_options; // Checkout options
    git_commit_signing_cb signing_cb;    // Signing callback
    void *payload;                       // Callback payload
} git_rebase_options;
```

## Rebase Operation Types

| Type | Value | Description |
|------|-------|-------------|
| `GIT_REBASE_OPERATION_PICK` | 0 | Cherry-pick the commit |
| `GIT_REBASE_OPERATION_REWORD` | 1 | Cherry-pick with updated message |
| `GIT_REBASE_OPERATION_EDIT` | 2 | Cherry-pick, stop for editing |
| `GIT_REBASE_OPERATION_SQUASH` | 3 | Squash into previous commit |
| `GIT_REBASE_OPERATION_FIXUP` | 4 | Squash, discard message |
| `GIT_REBASE_OPERATION_EXEC` | 5 | Run command |

## Rebase Operation Structure

```c
typedef struct {
    git_rebase_operation_t type;  // Operation type
    const git_oid id;             // Commit OID being operated on
    const char *exec;             // Command to run (for EXEC type)
} git_rebase_operation;
```

## Core Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `git_rebase_init` | `int (git_rebase **out, git_repository *repo, const git_annotated_commit *branch, const git_annotated_commit *upstream, const git_annotated_commit *onto, const git_rebase_options *opts)` | Initialize a rebase |
| `git_rebase_open` | `int (git_rebase **out, git_repository *repo, const git_rebase_options *opts)` | Open an existing rebase |
| `git_rebase_operation_entrycount` | `size_t (git_rebase *rebase)` | Get number of operations |
| `git_rebase_operation_current` | `size_t (git_rebase *rebase)` | Get current operation index |
| `git_rebase_operation_byindex` | `git_rebase_operation * (git_rebase *rebase, size_t idx)` | Get operation by index |
| `git_rebase_next` | `int (git_rebase_operation **operation, git_rebase *rebase)` | Perform next rebase operation |
| `git_rebase_inmemory_index` | `int (git_index **index, git_rebase *rebase)` | Get in-memory index |
| `git_rebase_commit` | `int (git_oid *id, git_rebase *rebase, const git_signature *author, const git_signature *committer, const char *message_encoding, const char *message)` | Commit current operation |
| `git_rebase_abort` | `int (git_rebase *rebase)` | Abort the rebase |
| `git_rebase_finish` | `int (git_rebase *rebase, const git_signature *signature)` | Finish the rebase |
| `git_rebase_free` | `void (git_rebase *rebase)` | Free rebase object |
| `git_rebase_options_init` | `int (git_rebase_options *opts, unsigned int version)` | Initialize options |

## Notes

- `GIT_REBASE_NO_OPERATION` (SIZE_MAX) indicates no operation in progress
- In-memory rebase doesn't modify working directory
- Rebase state is stored in `.git/rebase-merge/` or `.git/rebase-apply/`
