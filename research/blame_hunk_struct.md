# git_blame_hunk Struct Layout for libgit2 v1.1.0

From https://github.com/libgit2/libgit2/blob/v1.1.0/include/git2/blame.h

The v1.1.0 struct is simpler than the current main branch:

```c
typedef struct git_blame_hunk {
    size_t lines_in_hunk;           // offset 0, 8 bytes
    git_oid final_commit_id;        // offset 8, 20 bytes
    size_t final_start_line_number; // offset 32 (aligned), 8 bytes
    git_signature *final_signature; // offset 40, 8 bytes
    git_oid orig_commit_id;         // offset 48, 20 bytes
    const char *orig_path;          // offset 72 (aligned), 8 bytes
    size_t orig_start_line_number;  // offset 80, 8 bytes
    git_signature *orig_signature;  // offset 88, 8 bytes
    char boundary;                  // offset 96, 1 byte
} git_blame_hunk;
```

Note: v1.1.0 does NOT have:

- final_committer
- orig_committer
- summary

These were added in later versions.

## Calculated Offsets

| Field                   | Offset | Size | Notes      |
| ----------------------- | ------ | ---- | ---------- |
| lines_in_hunk           | 0      | 8    | size_t     |
| final_commit_id         | 8      | 20   | git_oid    |
| (padding)               | 28     | 4    | align to 8 |
| final_start_line_number | 32     | 8    | size_t     |
| final_signature         | 40     | 8    | pointer    |
| orig_commit_id          | 48     | 20   | git_oid    |
| (padding)               | 68     | 4    | align to 8 |
| orig_path               | 72     | 8    | pointer    |
| orig_start_line_number  | 80     | 8    | size_t     |
| orig_signature          | 88     | 8    | pointer    |
| boundary                | 96     | 1    | char       |
| Total                   |        | ~97  |            |
