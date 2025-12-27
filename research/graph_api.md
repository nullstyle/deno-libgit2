# Graph API Research

## Key Functions

### git_graph_ahead_behind

Count the number of unique commits between two commit objects.

```c
int git_graph_ahead_behind(
    size_t *ahead,       // OUT: number of unique commits in local not in upstream
    size_t *behind,      // OUT: number of unique commits in upstream not in local
    git_repository *repo,
    const git_oid *local,
    const git_oid *upstream
);
```

This is useful for determining how many commits a branch is ahead/behind another
branch.

### git_graph_descendant_of

Determine if a commit is the descendant of another commit.

```c
int git_graph_descendant_of(
    git_repository *repo,
    const git_oid *commit,
    const git_oid *ancestor
);
```

Returns:

- 1 if the given commit is a descendant of the potential ancestor
- 0 if not
- error code otherwise

Note: A commit is NOT considered a descendant of itself (different from
`git merge-base --is-ancestor`).

## FFI Signatures

```typescript
git_graph_ahead_behind: {
  parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
  result: "i32",
},
git_graph_descendant_of: {
  parameters: ["pointer", "pointer", "pointer"],
  result: "i32",
},
```

## Use Cases

1. **Branch comparison**: Determine how many commits a feature branch is
   ahead/behind main
2. **Ancestry checking**: Determine if a commit is an ancestor of another
   (useful for fast-forward checks)
3. **Merge analysis**: Help determine if a merge is needed or if fast-forward is
   possible
