# Reflog API Research (libgit2 v1.1.0)

## Core Functions

| Function                   | Signature                                                                                                       | Description                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `git_reflog_read`          | `int git_reflog_read(git_reflog **out, git_repository *repo, const char *name)`                                 | Read reflog for a reference |
| `git_reflog_write`         | `int git_reflog_write(git_reflog *reflog)`                                                                      | Write reflog to disk        |
| `git_reflog_append`        | `int git_reflog_append(git_reflog *reflog, const git_oid *id, const git_signature *committer, const char *msg)` | Add entry to reflog         |
| `git_reflog_rename`        | `int git_reflog_rename(git_repository *repo, const char *old_name, const char *name)`                           | Rename a reflog             |
| `git_reflog_delete`        | `int git_reflog_delete(git_repository *repo, const char *name)`                                                 | Delete a reflog             |
| `git_reflog_entrycount`    | `size_t git_reflog_entrycount(git_reflog *reflog)`                                                              | Get number of entries       |
| `git_reflog_entry_byindex` | `const git_reflog_entry * git_reflog_entry_byindex(const git_reflog *reflog, size_t idx)`                       | Get entry by index          |
| `git_reflog_drop`          | `int git_reflog_drop(git_reflog *reflog, size_t idx, int rewrite_previous_entry)`                               | Remove entry by index       |
| `git_reflog_free`          | `void git_reflog_free(git_reflog *reflog)`                                                                      | Free reflog                 |

## Entry Functions

| Function                     | Signature                                                                         | Description     |
| ---------------------------- | --------------------------------------------------------------------------------- | --------------- |
| `git_reflog_entry_id_old`    | `const git_oid * git_reflog_entry_id_old(const git_reflog_entry *entry)`          | Get old OID     |
| `git_reflog_entry_id_new`    | `const git_oid * git_reflog_entry_id_new(const git_reflog_entry *entry)`          | Get new OID     |
| `git_reflog_entry_committer` | `const git_signature * git_reflog_entry_committer(const git_reflog_entry *entry)` | Get committer   |
| `git_reflog_entry_message`   | `const char * git_reflog_entry_message(const git_reflog_entry *entry)`            | Get log message |

## Notes

- Index 0 returns the most recent entry
- Reflog must be freed with `git_reflog_free()`
- Empty reflog object returned if no reflog file exists yet
