# Submodule API Research (libgit2 v1.1.0)

## Status Flags (git_submodule_status_t)

| Flag                                     | Value   | Description                           |
| ---------------------------------------- | ------- | ------------------------------------- |
| `GIT_SUBMODULE_STATUS_IN_HEAD`           | 1 << 0  | Superproject head contains submodule  |
| `GIT_SUBMODULE_STATUS_IN_INDEX`          | 1 << 1  | Superproject index contains submodule |
| `GIT_SUBMODULE_STATUS_IN_CONFIG`         | 1 << 2  | Superproject gitmodules has submodule |
| `GIT_SUBMODULE_STATUS_IN_WD`             | 1 << 3  | Superproject workdir has submodule    |
| `GIT_SUBMODULE_STATUS_INDEX_ADDED`       | 1 << 4  | In index, not in head                 |
| `GIT_SUBMODULE_STATUS_INDEX_DELETED`     | 1 << 5  | In head, not in index                 |
| `GIT_SUBMODULE_STATUS_INDEX_MODIFIED`    | 1 << 6  | Index and head don't match            |
| `GIT_SUBMODULE_STATUS_WD_UNINITIALIZED`  | 1 << 7  | Workdir contains empty directory      |
| `GIT_SUBMODULE_STATUS_WD_ADDED`          | 1 << 8  | In workdir, not index                 |
| `GIT_SUBMODULE_STATUS_WD_DELETED`        | 1 << 9  | In index, not workdir                 |
| `GIT_SUBMODULE_STATUS_WD_MODIFIED`       | 1 << 10 | Index and workdir head don't match    |
| `GIT_SUBMODULE_STATUS_WD_INDEX_MODIFIED` | 1 << 11 | Submodule workdir index is dirty      |
| `GIT_SUBMODULE_STATUS_WD_WD_MODIFIED`    | 1 << 12 | Submodule workdir has modified files  |
| `GIT_SUBMODULE_STATUS_WD_UNTRACKED`      | 1 << 13 | WD contains untracked files           |

## Core Functions (expected)

Based on libgit2 patterns:

| Function                        | Signature                                                                                             | Description                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| `git_submodule_lookup`          | `int (git_submodule **out, git_repository *repo, const char *name)`                                   | Lookup submodule by name    |
| `git_submodule_foreach`         | `int (git_repository *repo, git_submodule_cb callback, void *payload)`                                | Iterate over submodules     |
| `git_submodule_add_setup`       | `int (git_submodule **out, git_repository *repo, const char *url, const char *path, int use_gitlink)` | Set up a new submodule      |
| `git_submodule_add_finalize`    | `int (git_submodule *submodule)`                                                                      | Finalize adding a submodule |
| `git_submodule_add_to_index`    | `int (git_submodule *submodule, int write_index)`                                                     | Add submodule to index      |
| `git_submodule_free`            | `void (git_submodule *submodule)`                                                                     | Free submodule              |
| `git_submodule_name`            | `const char * (git_submodule *submodule)`                                                             | Get name                    |
| `git_submodule_path`            | `const char * (git_submodule *submodule)`                                                             | Get path                    |
| `git_submodule_url`             | `const char * (git_submodule *submodule)`                                                             | Get URL                     |
| `git_submodule_branch`          | `const char * (git_submodule *submodule)`                                                             | Get branch                  |
| `git_submodule_head_id`         | `const git_oid * (git_submodule *submodule)`                                                          | Get HEAD OID                |
| `git_submodule_index_id`        | `const git_oid * (git_submodule *submodule)`                                                          | Get index OID               |
| `git_submodule_wd_id`           | `const git_oid * (git_submodule *submodule)`                                                          | Get workdir OID             |
| `git_submodule_ignore`          | `git_submodule_ignore_t (git_submodule *submodule)`                                                   | Get ignore setting          |
| `git_submodule_update_strategy` | `git_submodule_update_t (git_submodule *submodule)`                                                   | Get update strategy         |
| `git_submodule_init`            | `int (git_submodule *submodule, int overwrite)`                                                       | Initialize submodule        |
| `git_submodule_update`          | `int (git_submodule *submodule, int init, git_submodule_update_options *options)`                     | Update submodule            |
| `git_submodule_sync`            | `int (git_submodule *submodule)`                                                                      | Sync submodule              |
| `git_submodule_open`            | `int (git_repository **repo, git_submodule *submodule)`                                               | Open submodule repo         |
| `git_submodule_reload`          | `int (git_submodule *submodule, int force)`                                                           | Reload submodule info       |
| `git_submodule_status`          | `int (unsigned int *status, git_repository *repo, const char *name, git_submodule_ignore_t ignore)`   | Get submodule status        |
| `git_submodule_location`        | `int (unsigned int *location_status, git_submodule *submodule)`                                       | Get location status         |
| `git_submodule_set_url`         | `int (git_repository *repo, const char *name, const char *url)`                                       | Set URL                     |
| `git_submodule_set_branch`      | `int (git_repository *repo, const char *name, const char *branch)`                                    | Set branch                  |
| `git_submodule_clone`           | `int (git_repository **out, git_submodule *submodule, const git_submodule_update_options *opts)`      | Clone submodule             |

## Update Options Structure

```c
typedef struct git_submodule_update_options {
    unsigned int version;
    git_checkout_options checkout_opts;
    git_fetch_options fetch_opts;
    int allow_fetch;
} git_submodule_update_options;
```

## Notes

- Submodule info is built from: .gitmodules, .git/config, index, HEAD tree
- Items that look like submodules but aren't in those places won't be tracked
- Callback signature:
  `int (*git_submodule_cb)(git_submodule *sm, const char *name, void *payload)`
