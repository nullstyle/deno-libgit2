# Blame API Research

## Overview
The blame API decorates individual lines in a file with the commit that introduced that particular line.

## Key Structures

### git_blame_hunk
```c
typedef struct git_blame_hunk {
    size_t lines_in_hunk,           // Number of lines in this hunk
    git_oid final_commit_id,        // OID of commit where line was last changed
    size_t final_start_line_number, // 1-based line number in final version
    git_signature *final_signature, // Author of final_commit_id
    git_signature *final_committer, // Committer of final_commit_id
    git_oid orig_commit_id,         // OID of commit where hunk was found
    const char *orig_path,          // Path in original commit
    size_t orig_start_line_number,  // 1-based line number in original
    git_signature *orig_signature,  // Author of orig_commit_id
    git_signature *orig_committer,  // Committer of orig_commit_id
    const char *summary,            // Commit summary
    char boundary                   // 1 if tracked to boundary commit
};
```

### git_blame_line
```c
typedef struct git_blame_line {
    const char *ptr,  // Pointer to line content
    size_t len        // Length of line
};
```

## Key Functions

### git_blame_file
Get the blame for a single file in the repository.
```c
int git_blame_file(
    git_blame **out,
    git_repository *repo,
    const char *path,
    git_blame_options *options
);
```

### git_blame_get_hunk_count / git_blame_hunkcount
Gets the number of hunks that exist in the blame structure.
```c
uint32_t git_blame_get_hunk_count(git_blame *blame);
```

### git_blame_get_hunk_byindex / git_blame_hunk_byindex
Gets the blame hunk at the given index.
```c
const git_blame_hunk *git_blame_get_hunk_byindex(
    git_blame *blame,
    uint32_t index
);
```

### git_blame_get_hunk_byline / git_blame_hunk_byline
Gets the hunk that relates to the given line number.
```c
const git_blame_hunk *git_blame_get_hunk_byline(
    git_blame *blame,
    size_t lineno
);
```

### git_blame_linecount
Gets the number of lines that exist in the blame structure.
```c
uint32_t git_blame_linecount(git_blame *blame);
```

### git_blame_line_byindex
Gets the information about the line in the blame.
```c
const git_blame_line *git_blame_line_byindex(
    git_blame *blame,
    size_t lineno
);
```

### git_blame_buffer
Get blame data for a file that has been modified in memory.
```c
int git_blame_buffer(
    git_blame **out,
    git_blame *reference,
    const char *buffer,
    size_t buffer_len
);
```

### git_blame_free
Free memory allocated by git_blame_file or git_blame_buffer.
```c
void git_blame_free(git_blame *blame);
```

### git_blame_options_init
Initialize git_blame_options structure.
```c
int git_blame_options_init(
    git_blame_options *opts,
    unsigned int version
);
```

## Blame Flags (git_blame_flag_t)
- GIT_BLAME_NORMAL (0) - Normal blame
- GIT_BLAME_TRACK_COPIES_SAME_FILE (1 << 0) - Track lines moved within same file
- GIT_BLAME_TRACK_COPIES_SAME_COMMIT_MOVES (1 << 1) - Track lines moved in same commit
- GIT_BLAME_TRACK_COPIES_SAME_COMMIT_COPIES (1 << 2) - Track lines copied in same commit
- GIT_BLAME_TRACK_COPIES_ANY_COMMIT_COPIES (1 << 3) - Track lines copied from any commit
- GIT_BLAME_FIRST_PARENT (1 << 4) - Only follow first parent
- GIT_BLAME_USE_MAILMAP (1 << 5) - Use mailmap for author/committer names
- GIT_BLAME_IGNORE_WHITESPACE (1 << 6) - Ignore whitespace changes

## FFI Symbols Needed
- git_blame_file
- git_blame_buffer
- git_blame_free
- git_blame_get_hunk_count (or git_blame_hunkcount)
- git_blame_get_hunk_byindex (or git_blame_hunk_byindex)
- git_blame_get_hunk_byline (or git_blame_hunk_byline)
- git_blame_linecount
- git_blame_line_byindex
- git_blame_options_init
