# Message API Research

## Overview

The message API provides functions for cleaning up and parsing commit messages, including prettifying messages and extracting trailers.

## Key Functions

### `git_message_prettify`
```c
int git_message_prettify(git_buf *out, const char *message, int strip_comments, char comment_char);
```
Clean up excess whitespace and make sure there is a trailing newline in the message.
Optionally removes lines starting with the comment character.

Parameters:
- `out`: User-allocated git_buf filled with the cleaned up message
- `message`: The message to be prettified
- `strip_comments`: Non-zero to remove comment lines, 0 to leave them in
- `comment_char`: Comment character (lines starting with this are removed if strip_comments is non-zero)

### `git_message_trailers`
```c
int git_message_trailers(git_message_trailer_array *arr, const char *message);
```
Parse trailers out of a message. Trailers are key/value pairs in the last paragraph of a message.

### `git_message_trailer_array_free`
```c
void git_message_trailer_array_free(git_message_trailer_array *arr);
```
Clean up any allocated memory in the git_message_trailer_array.

## Structs

### `git_message_trailer`
```c
typedef struct {
  const char *key;
  const char *value;
} git_message_trailer;
```

### `git_message_trailer_array`
```c
typedef struct {
  git_message_trailer *trailers;
  size_t count;
  /* private */
  char *_trailer_block;
} git_message_trailer_array;
```

## FFI Symbols Needed

```typescript
git_message_prettify: { parameters: ["pointer", "pointer", "i32", "u8"], result: "i32" },
git_message_trailers: { parameters: ["pointer", "pointer"], result: "i32" },
git_message_trailer_array_free: { parameters: ["pointer"], result: "void" },
```

## Use Cases

1. **Prettify commit messages**: Clean up user input before creating commits
2. **Parse trailers**: Extract metadata like "Signed-off-by:", "Co-authored-by:", etc.
