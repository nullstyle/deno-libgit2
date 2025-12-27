# Rebase Commit and Finish API Research

## git_rebase_commit

```c
GIT_EXTERN(int) git_rebase_commit(
    git_oid *id,
    git_rebase *rebase,
    const git_signature *author,
    const git_signature *committer,
    const char *message_encoding,
    const char *message);
```

**Parameters:**

- `id` - Output: OID of newly created commit
- `rebase` - The rebase in progress
- `author` - Author of updated commit, or NULL to keep original
- `committer` - The committer of the rebase (required)
- `message_encoding` - Encoding for message (NULL for UTF-8)
- `message` - Commit message, or NULL to use original

**Returns:**

- 0 on success
- GIT_EUNMERGED if unmerged changes
- GIT_EAPPLIED if commit already applied
- -1 on failure

## git_rebase_finish

```c
GIT_EXTERN(int) git_rebase_finish(
    git_rebase *rebase,
    const git_signature *signature);
```

**Parameters:**

- `rebase` - The rebase in progress
- `signature` - Identity finishing the rebase (optional, can be NULL)

**Returns:**

- 0 on success
- -1 on error

## git_signature struct

Need to create a git_signature for committer. The struct is:

```c
typedef struct {
    char *name;
    char *email;
    git_time when;
} git_signature;

typedef struct {
    git_time_t time;    // time in seconds since epoch
    int offset;         // timezone offset in minutes
    char sign;          // '+' or '-'
} git_time;
```

## Creating a Signature

```c
GIT_EXTERN(int) git_signature_new(
    git_signature **out,
    const char *name,
    const char *email,
    git_time_t time,
    int offset);

GIT_EXTERN(int) git_signature_now(
    git_signature **out,
    const char *name,
    const char *email);

GIT_EXTERN(void) git_signature_free(git_signature *sig);
```

## Implementation Plan

1. Add FFI symbols for:
   - `git_signature_new`
   - `git_signature_now`
   - `git_signature_free`
   - `git_rebase_commit`
   - `git_rebase_finish`

2. Create Signature class wrapper

3. Update Rebase class with commit() and finish() methods
