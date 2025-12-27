# libgit2 API Coverage

This document tracks the implementation status of the libgit2 API in the
`deno-libgit2` package.

**Source:**
[libgit2 API Reference (main)](https://libgit2.org/docs/reference/main/)

## Module Implementation Status

| Module               | Status                    | Notes                                     |
| -------------------- | ------------------------- | ----------------------------------------- |
| `annotated_commit`   | Not Implemented           |                                           |
| `apply`              | Not Implemented           |                                           |
| `attr`               | Not Implemented           |                                           |
| `blame`              | Not Implemented           |                                           |
| `blob`               | **Fully Implemented**     | Core blob operations.                     |
| `branch`             | **Partially Implemented** | Branch creation, deletion, and iteration. |
| `buffer`             | Not Implemented           |                                           |
| `cert`               | Not Implemented           |                                           |
| `checkout`           | **Partially Implemented** | Head, index, and tree checkout.           |
| `cherrypick`         | Not Implemented           |                                           |
| `clone`              | **Partially Implemented** | Basic clone functionality.                |
| `commit`             | **Fully Implemented**     | Commit lookup, creation, and inspection.  |
| `common`             | Not Implemented           |                                           |
| `config`             | **Partially Implemented** | Reading and writing config values.        |
| `credential`         | Not Implemented           |                                           |
| `credential_helpers` | Not Implemented           |                                           |
| `deprecated`         | Not Implemented           |                                           |
| `describe`           | Not Implemented           |                                           |
| `diff`               | **Partially Implemented** | Diffing trees, index, and workdir.        |
| `email`              | Not Implemented           |                                           |
| `errors`             | **Fully Implemented**     | Error handling.                           |
| `filter`             | Not Implemented           |                                           |
| `global`             | **Fully Implemented**     | Library initialization and shutdown.      |
| `graph`              | Not Implemented           |                                           |
| `ignore`             | Not Implemented           |                                           |
| `index`              | **Fully Implemented**     | Index (staging area) operations.          |
| `indexer`            | Not Implemented           |                                           |
| `mailmap`            | Not Implemented           |                                           |
| `merge`              | Not Implemented           |                                           |
| `message`            | Not Implemented           |                                           |
| `net`                | Not Implemented           |                                           |
| `notes`              | Not Implemented           |                                           |
| `object`             | **Partially Implemented** | Object lookup and type retrieval.         |
| `odb`                | Not Implemented           |                                           |
| `odb_backend`        | Not Implemented           |                                           |
| `oid`                | **Fully Implemented**     | OID manipulation.                         |
| `oidarray`           | Not Implemented           |                                           |
| `pack`               | Not Implemented           |                                           |
| `patch`              | Not Implemented           |                                           |
| `pathspec`           | Not Implemented           |                                           |
| `proxy`              | Not Implemented           |                                           |
| `rebase`             | Not Implemented           |                                           |
| `refdb`              | Not Implemented           |                                           |
| `reflog`             | Not Implemented           |                                           |
| `refs`               | **Partially Implemented** | Reference lookup, creation, and deletion. |
| `refspec`            | Not Implemented           |                                           |
| `remote`             | **Partially Implemented** | Remote lookup, creation, and deletion.    |
| `repository`         | **Fully Implemented**     | Core repository operations.               |
| `reset`              | **Partially Implemented** | Basic reset functionality.                |
| `revert`             | Not Implemented           |                                           |
| `revparse`           | **Partially Implemented** | Revision parsing.                         |
| `revwalk`            | **Fully Implemented**     | Commit history traversal.                 |
| `signature`          | **Fully Implemented**     | Signature creation and manipulation.      |
| `stash`              | **Partially Implemented** | Stash save, apply, pop, and drop.         |
| `status`             | **Fully Implemented**     | Status list and file status.              |
| `strarray`           | **Partially Implemented** | String array free.                        |
| `submodule`          | Not Implemented           |                                           |
| `tag`                | **Partially Implemented** | Tag lookup, creation, and deletion.       |
| `trace`              | Not Implemented           |                                           |
| `transaction`        | Not Implemented           |                                           |
| `transport`          | Not Implemented           |                                           |
| `tree`               | **Fully Implemented**     | Tree lookup and entry manipulation.       |
| `types`              | **Fully Implemented**     | Core types and enums.                     |
| `version`            | **Fully Implemented**     | Library version information.              |
| `worktree`           | Not Implemented           |                                           |

---

## Function Implementation Status

### `repository` module

| Function                                          | Implemented | Notes |
| ------------------------------------------------- | ----------- | ----- |
| `git_repository_open`                             | ✅ Yes      |       |
| `git_repository_open_from_worktree`               | ❌ No       |       |
| `git_repository_wrap_odb`                         | ❌ No       |       |
| `git_repository_discover`                         | ✅ Yes      |       |
| `git_repository_open_ext`                         | ✅ Yes      |       |
| `git_repository_open_bare`                        | ✅ Yes      |       |
| `git_repository_free`                             | ✅ Yes      |       |
| `git_repository_init`                             | ✅ Yes      |       |
| `git_repository_init_options_init`                | ✅ Yes      |       |
| `git_repository_init_ext`                         | ✅ Yes      |       |
| `git_repository_head`                             | ✅ Yes      |       |
| `git_repository_head_for_worktree`                | ❌ No       |       |
| `git_repository_head_detached`                    | ✅ Yes      |       |
| `git_repository_head_detached_for_worktree`       | ❌ No       |       |
| `git_repository_head_unborn`                      | ✅ Yes      |       |
| `git_repository_is_empty`                         | ✅ Yes      |       |
| `git_repository_item_path`                        | ❌ No       |       |
| `git_repository_path`                             | ✅ Yes      |       |
| `git_repository_workdir`                          | ✅ Yes      |       |
| `git_repository_commondir`                        | ❌ No       |       |
| `git_repository_set_workdir`                      | ✅ Yes      |       |
| `git_repository_is_bare`                          | ✅ Yes      |       |
| `git_repository_is_worktree`                      | ❌ No       |       |
| `git_repository_config`                           | ✅ Yes      |       |
| `git_repository_config_snapshot`                  | ❌ No       |       |
| `git_repository_odb`                              | ✅ Yes      |       |
| `git_repository_refdb`                            | ✅ Yes      |       |
| `git_repository_index`                            | ✅ Yes      |       |
| `git_repository_message`                          | ✅ Yes      |       |
| `git_repository_message_remove`                   | ✅ Yes      |       |
| `git_repository_state_cleanup`                    | ✅ Yes      |       |
| `git_repository_fetchhead_foreach`                | ❌ No       |       |
| `git_repository_mergehead_foreach`                | ❌ No       |       |
| `git_repository_hashfile`                         | ❌ No       |       |
| `git_repository_set_head`                         | ✅ Yes      |       |
| `git_repository_set_head_detached`                | ✅ Yes      |       |
| `git_repository_set_head_detached_from_annotated` | ❌ No       |       |
| `git_repository_detach_head`                      | ❌ No       |       |
| `git_repository_state`                            | ✅ Yes      |       |
| `git_repository_set_namespace`                    | ❌ No       |       |
| `git_repository_get_namespace`                    | ❌ No       |       |
| `git_repository_is_shallow`                       | ❌ No       |       |
| `git_repository_ident`                            | ❌ No       |       |
| `git_repository_set_ident`                        | ❌ No       |       |
| `git_repository_oid_type`                         | ❌ No       |       |
| `git_repository_commit_parents`                   | ❌ No       |       |

### `commit` module

| Function                            | Implemented | Notes |
| ----------------------------------- | ----------- | ----- |
| `git_commit_lookup`                 | ✅ Yes      |       |
| `git_commit_lookup_prefix`          | ✅ Yes      |       |
| `git_commit_free`                   | ✅ Yes      |       |
| `git_commit_id`                     | ✅ Yes      |       |
| `git_commit_owner`                  | ✅ Yes      |       |
| `git_commit_message_encoding`       | ✅ Yes      |       |
| `git_commit_message`                | ✅ Yes      |       |
| `git_commit_message_raw`            | ✅ Yes      |       |
| `git_commit_summary`                | ✅ Yes      |       |
| `git_commit_body`                   | ✅ Yes      |       |
| `git_commit_time`                   | ✅ Yes      |       |
| `git_commit_time_offset`            | ✅ Yes      |       |
| `git_commit_committer`              | ✅ Yes      |       |
| `git_commit_author`                 | ✅ Yes      |       |
| `git_commit_committer_with_mailmap` | ❌ No       |       |
| `git_commit_author_with_mailmap`    | ❌ No       |       |
| `git_commit_raw_header`             | ✅ Yes      |       |
| `git_commit_tree`                   | ✅ Yes      |       |
| `git_commit_tree_id`                | ✅ Yes      |       |
| `git_commit_parentcount`            | ✅ Yes      |       |
| `git_commit_parent`                 | ✅ Yes      |       |
| `git_commit_parent_id`              | ✅ Yes      |       |
| `git_commit_nth_gen_ancestor`       | ❌ No       |       |
| `git_commit_header_field`           | ❌ No       |       |
| `git_commit_extract_signature`      | ❌ No       |       |
| `git_commit_create`                 | ✅ Yes      |       |
| `git_commit_create_v`               | ✅ Yes      |       |
| `git_commit_create_from_stage`      | ❌ No       |       |
| `git_commit_amend`                  | ✅ Yes      |       |
| `git_commit_create_buffer`          | ✅ Yes      |       |
| `git_commit_create_with_signature`  | ✅ Yes      |       |
| `git_commit_dup`                    | ✅ Yes      |       |
| `git_commitarray_dispose`           | ❌ No       |       |

### `tree` module

| Function                     | Implemented | Notes |
| ---------------------------- | ----------- | ----- |
| `git_tree_lookup`            | ✅ Yes      |       |
| `git_tree_free`              | ✅ Yes      |       |
| `git_tree_id`                | ✅ Yes      |       |
| `git_tree_entrycount`        | ✅ Yes      |       |
| `git_tree_entry_byindex`     | ✅ Yes      |       |
| `git_tree_entry_byname`      | ✅ Yes      |       |
| `git_tree_entry_bypath`      | ✅ Yes      |       |
| `git_tree_entry_name`        | ✅ Yes      |       |
| `git_tree_entry_id`          | ✅ Yes      |       |
| `git_tree_entry_type`        | ✅ Yes      |       |
| `git_tree_entry_filemode`    | ✅ Yes      |       |
| `git_tree_entry_free`        | ✅ Yes      |       |
| `git_tree_entry_dup`         | ✅ Yes      |       |
| `git_tree_entry_cmp`         | ✅ Yes      |       |
| `git_tree_entry_to_object`   | ✅ Yes      |       |
| `git_tree_walk`              | ✅ Yes      |       |
| `git_treebuilder_new`        | ✅ Yes      |       |
| `git_treebuilder_free`       | ✅ Yes      |       |
| `git_treebuilder_clear`      | ✅ Yes      |       |
| `git_treebuilder_entrycount` | ✅ Yes      |       |
| `git_treebuilder_get`        | ✅ Yes      |       |
| `git_treebuilder_insert`     | ✅ Yes      |       |
| `git_treebuilder_remove`     | ✅ Yes      |       |
| `git_treebuilder_write`      | ✅ Yes      |       |

### `blob` module

| Function                       | Implemented | Notes |
| ------------------------------ | ----------- | ----- |
| `git_blob_lookup`              | ✅ Yes      |       |
| `git_blob_free`                | ✅ Yes      |       |
| `git_blob_id`                  | ✅ Yes      |       |
| `git_blob_rawcontent`          | ✅ Yes      |       |
| `git_blob_rawsize`             | ✅ Yes      |       |
| `git_blob_is_binary`           | ✅ Yes      |       |
| `git_blob_create_from_workdir` | ✅ Yes      |       |
| `git_blob_create_from_disk`    | ✅ Yes      |       |
| `git_blob_create_from_buffer`  | ✅ Yes      |       |
| `git_blob_lookup_prefix`       | ✅ Yes      |       |
| `git_blob_filtered_content`    | ✅ Yes      |       |
| `git_blob_dup`                 | ✅ Yes      |       |
