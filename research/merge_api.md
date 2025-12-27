# libgit2 Merge API Research

## Key Functions

### git_merge

```c
int git_merge(
    git_repository *repo,
    const git_annotated_commit **their_heads,
    size_t their_heads_len,
    const git_merge_options *merge_opts,
    const git_checkout_options *checkout_opts
);
```

- Merges commit(s) into HEAD
- Writes results to working directory
- Stages changes for commit
- Writes conflicts to index
- Returns 0 on success

### git_merge_analysis

```c
int git_merge_analysis(
    git_merge_analysis_t *analysis_out,
    git_merge_preference_t *preference_out,
    git_repository *repo,
    const git_annotated_commit **their_heads,
    size_t their_heads_len
);
```

- Analyzes merge possibilities
- Returns analysis flags (fast-forward possible, up-to-date, etc.)

### git_merge_base

```c
int git_merge_base(
    git_oid *out,
    git_repository *repo,
    const git_oid *one,
    const git_oid *two
);
```

- Finds common ancestor between two commits

### git_merge_commits

```c
int git_merge_commits(
    git_index **out,
    git_repository *repo,
    const git_commit *our_commit,
    const git_commit *their_commit,
    const git_merge_options *opts
);
```

- Merges two commits into an index
- Does not modify working directory

### git_merge_trees

```c
int git_merge_trees(
    git_index **out,
    git_repository *repo,
    const git_tree *ancestor_tree,
    const git_tree *our_tree,
    const git_tree *their_tree,
    const git_merge_options *opts
);
```

- Merges two trees with common ancestor

### git_annotated_commit_from_ref

```c
int git_annotated_commit_from_ref(
    git_annotated_commit **out,
    git_repository *repo,
    const git_reference *ref
);
```

- Creates annotated commit from reference (needed for merge)

### git_annotated_commit_lookup

```c
int git_annotated_commit_lookup(
    git_annotated_commit **out,
    git_repository *repo,
    const git_oid *id
);
```

- Creates annotated commit from OID

### git_annotated_commit_free

```c
void git_annotated_commit_free(git_annotated_commit *commit);
```

## Enums

### git_merge_analysis_t

- GIT_MERGE_ANALYSIS_NONE = 0
- GIT_MERGE_ANALYSIS_NORMAL = 1 << 0 (normal merge possible)
- GIT_MERGE_ANALYSIS_UP_TO_DATE = 1 << 1 (already up to date)
- GIT_MERGE_ANALYSIS_FASTFORWARD = 1 << 2 (fast-forward possible)
- GIT_MERGE_ANALYSIS_UNBORN = 1 << 3 (HEAD is unborn)

### git_merge_preference_t

- GIT_MERGE_PREFERENCE_NONE = 0
- GIT_MERGE_PREFERENCE_NO_FASTFORWARD = 1 << 0
- GIT_MERGE_PREFERENCE_FASTFORWARD_ONLY = 1 << 1

### git_merge_flag_t

- GIT_MERGE_FIND_RENAMES = 1 << 0
- GIT_MERGE_FAIL_ON_CONFLICT = 1 << 1
- GIT_MERGE_SKIP_REUC = 1 << 2
- GIT_MERGE_NO_RECURSIVE = 1 << 3
- GIT_MERGE_VIRTUAL_BASE = 1 << 4

## Workflow

1. Create annotated commit(s) from branch reference or OID
2. Call git_merge_analysis to determine merge type
3. If fast-forward: update reference directly
4. If normal merge: call git_merge
5. Check index for conflicts
6. If no conflicts: create merge commit
7. Call git_repository_state_cleanup()

## Annotated Commit Functions

### git_annotated_commit_from_ref

```c
int git_annotated_commit_from_ref(
    git_annotated_commit **out,
    git_repository *repo,
    const git_reference *ref
);
```

- Creates annotated commit from a reference

### git_annotated_commit_lookup

```c
int git_annotated_commit_lookup(
    git_annotated_commit **out,
    git_repository *repo,
    const git_oid *id
);
```

- Creates annotated commit from commit OID

### git_annotated_commit_from_revspec

```c
int git_annotated_commit_from_revspec(
    git_annotated_commit **out,
    git_repository *repo,
    const char *revspec
);
```

- Creates annotated commit from revision string (e.g., "HEAD~2", "main")

### git_annotated_commit_id

```c
const git_oid *git_annotated_commit_id(
    const git_annotated_commit *commit
);
```

- Gets the commit ID

### git_annotated_commit_ref

```c
const char *git_annotated_commit_ref(
    const git_annotated_commit *commit
);
```

- Gets the refname

### git_annotated_commit_free

```c
void git_annotated_commit_free(git_annotated_commit *commit);
```
