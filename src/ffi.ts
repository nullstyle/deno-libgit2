/**
 * @module ffi
 * FFI symbol definitions for libgit2
 */

/**
 * FFI symbol definitions for libgit2 functions
 * These define the C function signatures for Deno.dlopen
 */
export const symbols = {
  // Library initialization
  git_libgit2_init: {
    parameters: [],
    result: "i32",
  },
  git_libgit2_shutdown: {
    parameters: [],
    result: "i32",
  },
  git_libgit2_version: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Error handling
  git_error_last: {
    parameters: [],
    result: "pointer",
  },
  git_error_clear: {
    parameters: [],
    result: "void",
  },

  // Repository functions
  git_repository_open: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_repository_open_ext: {
    parameters: ["pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_repository_open_bare: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_repository_init: {
    parameters: ["pointer", "pointer", "u32"],
    result: "i32",
  },
  git_repository_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_repository_path: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_repository_workdir: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_repository_is_bare: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_repository_is_empty: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_repository_head: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_repository_head_detached: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_repository_state: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_repository_index: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_repository_config: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_repository_discover: {
    parameters: ["pointer", "pointer", "i32", "pointer"],
    result: "i32",
  },
  git_repository_set_head: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_repository_set_head_detached: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // OID functions
  git_oid_fromstr: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_oid_tostr: {
    parameters: ["pointer", "usize", "pointer"],
    result: "pointer",
  },
  git_oid_tostr_s: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_oid_cmp: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_oid_equal: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_oid_is_zero: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_oid_cpy: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Reference functions
  git_reference_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reference_name_to_id: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reference_dwim: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reference_name: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reference_type: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_reference_target: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reference_symbolic_target: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reference_resolve: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_reference_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_reference_is_branch: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_reference_is_tag: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_reference_is_remote: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_reference_iterator_new: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_reference_iterator_glob_new: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reference_next: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_reference_next_name: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_reference_iterator_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_reference_create: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "i32", "pointer"],
    result: "i32",
  },
  git_reference_symbolic_create: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "i32", "pointer"],
    result: "i32",
  },
  git_reference_delete: {
    parameters: ["pointer"],
    result: "i32",
  },

  // Commit functions
  git_commit_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_commit_lookup_prefix: {
    parameters: ["pointer", "pointer", "pointer", "usize"],
    result: "i32",
  },
  git_commit_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_commit_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_message: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_message_raw: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_summary: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_body: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_time: {
    parameters: ["pointer"],
    result: "i64",
  },
  git_commit_time_offset: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_commit_author: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_committer: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_tree: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_commit_tree_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_commit_parentcount: {
    parameters: ["pointer"],
    result: "u32",
  },
  git_commit_parent: {
    parameters: ["pointer", "pointer", "u32"],
    result: "i32",
  },
  git_commit_parent_id: {
    parameters: ["pointer", "u32"],
    result: "pointer",
  },
  git_commit_create: {
    parameters: [
      "pointer", // id
      "pointer", // repo
      "pointer", // update_ref
      "pointer", // author
      "pointer", // committer
      "pointer", // message_encoding
      "pointer", // message
      "pointer", // tree
      "usize", // parent_count
      "pointer", // parents
    ],
    result: "i32",
  },

  // Signature functions
  git_signature_new: {
    parameters: ["pointer", "pointer", "pointer", "i64", "i32"],
    result: "i32",
  },
  git_signature_now: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_signature_default: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_signature_dup: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_signature_free: {
    parameters: ["pointer"],
    result: "void",
  },

  // Index functions
  git_index_open: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_index_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_index_read: {
    parameters: ["pointer", "i32"],
    result: "i32",
  },
  git_index_write: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_index_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_index_get_byindex: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_index_get_bypath: {
    parameters: ["pointer", "pointer", "i32"],
    result: "pointer",
  },
  git_index_add_bypath: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_index_add_all: {
    parameters: ["pointer", "pointer", "u32", "pointer", "pointer"],
    result: "i32",
  },
  git_index_remove_bypath: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_index_remove_all: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_index_write_tree: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_index_write_tree_to: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_index_has_conflicts: {
    parameters: ["pointer"],
    result: "i32",
  },

  // Tree functions
  git_tree_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_tree_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_tree_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tree_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_tree_entry_byindex: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_tree_entry_byname: {
    parameters: ["pointer", "pointer"],
    result: "pointer",
  },
  git_tree_entry_bypath: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_tree_entry_name: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tree_entry_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tree_entry_type: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_tree_entry_filemode: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_tree_entry_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_tree_entry_dup: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_tree_entry_cmp: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_tree_entry_to_object: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_tree_walk: {
    parameters: ["pointer", "i32", "function", "pointer"],
    result: "i32",
  },
  git_treebuilder_new: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_treebuilder_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_treebuilder_clear: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_treebuilder_entrycount: {
    parameters: ["pointer"],
    result: "u32",
  },
  git_treebuilder_get: {
    parameters: ["pointer", "pointer"],
    result: "pointer",
  },
  git_treebuilder_insert: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_treebuilder_remove: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_treebuilder_write: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Blob functions
  git_blob_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_blob_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_blob_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_blob_rawcontent: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_blob_rawsize: {
    parameters: ["pointer"],
    result: "i64",
  },
  git_blob_is_binary: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_blob_create_from_workdir: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_blob_create_from_disk: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_blob_create_from_buffer: {
    parameters: ["pointer", "pointer", "pointer", "usize"],
    result: "i32",
  },
  git_blob_lookup_prefix: {
    parameters: ["pointer", "pointer", "pointer", "usize"],
    result: "i32",
  },
  git_blob_filtered_content: {
    parameters: ["pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_blob_dup: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Branch functions
  git_branch_create: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_branch_delete: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_branch_iterator_new: {
    parameters: ["pointer", "pointer", "i32"],
    result: "i32",
  },
  git_branch_next: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_branch_iterator_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_branch_move: {
    parameters: ["pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_branch_lookup: {
    parameters: ["pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_branch_name: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_branch_upstream: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_branch_set_upstream: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_branch_is_head: {
    parameters: ["pointer"],
    result: "i32",
  },

  // Tag functions
  git_tag_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_tag_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_tag_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tag_name: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tag_message: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tag_tagger: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tag_target_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_tag_target_type: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_tag_create: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "i32",
    ],
    result: "i32",
  },
  git_tag_create_lightweight: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_tag_delete: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_tag_list: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_tag_list_match: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_tag_foreach: {
    parameters: ["pointer", "function", "pointer"],
    result: "i32",
  },
  git_tag_peel: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Remote functions
  git_remote_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_remote_create: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_remote_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_remote_name: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_remote_url: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_remote_pushurl: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_remote_list: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_remote_delete: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_remote_rename: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_remote_set_url: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_remote_set_pushurl: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Status functions
  git_status_list_new: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_status_list_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_status_list_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_status_byindex: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_status_file: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_status_should_ignore: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Diff functions
  git_diff_index_to_workdir: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_diff_tree_to_index: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_diff_tree_to_tree: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_diff_tree_to_workdir: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_diff_tree_to_workdir_with_index: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_diff_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_diff_num_deltas: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_diff_get_delta: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },

  // Revwalk functions
  git_revwalk_new: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_revwalk_reset: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_revwalk_push: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_push_head: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_revwalk_push_ref: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_push_range: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_hide: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_hide_head: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_revwalk_hide_ref: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_next: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_revwalk_sorting: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },

  // Revparse functions
  git_revparse_single: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_revparse_ext: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Object functions
  git_object_lookup: {
    parameters: ["pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_object_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_object_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_object_type: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_object_peel: {
    parameters: ["pointer", "pointer", "i32"],
    result: "i32",
  },

  // Clone functions
  git_clone: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Checkout functions
  git_checkout_head: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_checkout_index: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_checkout_tree: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Reset functions
  git_reset: {
    parameters: ["pointer", "pointer", "i32", "pointer"],
    result: "i32",
  },
  git_reset_default: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Stash functions
  git_stash_save: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "u32"],
    result: "i32",
  },
  git_stash_apply: {
    parameters: ["pointer", "usize", "pointer"],
    result: "i32",
  },
  git_stash_drop: {
    parameters: ["pointer", "usize"],
    result: "i32",
  },
  git_stash_pop: {
    parameters: ["pointer", "usize", "pointer"],
    result: "i32",
  },
  git_stash_foreach: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_stash_apply_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },

  // Config functions
  git_config_open_default: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_config_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_config_get_string: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_config_get_int32: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_config_get_int64: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_config_get_bool: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_config_set_string: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_config_set_int32: {
    parameters: ["pointer", "pointer", "i32"],
    result: "i32",
  },
  git_config_set_int64: {
    parameters: ["pointer", "pointer", "i64"],
    result: "i32",
  },
  git_config_set_bool: {
    parameters: ["pointer", "pointer", "i32"],
    result: "i32",
  },
  git_config_delete_entry: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Strarray functions
  git_strarray_free: {
    parameters: ["pointer"],
    result: "void",
  },

  // Buffer functions
  git_buf_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_buf_dispose: {
    parameters: ["pointer"],
    result: "void",
  },

  // Annotated commit functions
  git_annotated_commit_from_ref: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_annotated_commit_from_fetchhead: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_annotated_commit_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_annotated_commit_from_revspec: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_annotated_commit_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_annotated_commit_ref: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_annotated_commit_free: {
    parameters: ["pointer"],
    result: "void",
  },

  // Merge functions
  git_merge: {
    parameters: ["pointer", "pointer", "usize", "pointer", "pointer"],
    result: "i32",
  },
  git_merge_analysis: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "usize"],
    result: "i32",
  },
  git_merge_analysis_for_ref: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "usize",
    ],
    result: "i32",
  },
  git_merge_base: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_merge_bases: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_merge_base_many: {
    parameters: ["pointer", "pointer", "usize", "pointer"],
    result: "i32",
  },
  git_merge_bases_many: {
    parameters: ["pointer", "pointer", "usize", "pointer"],
    result: "i32",
  },
  git_merge_commits: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_merge_trees: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
    ],
    result: "i32",
  },
  git_merge_file_input_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_merge_file_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_merge_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_repository_state_cleanup: {
    parameters: ["pointer"],
    result: "i32",
  },

  // Blame functions
  git_blame_file: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_blame_buffer: {
    parameters: ["pointer", "pointer", "pointer", "usize"],
    result: "i32",
  },
  git_blame_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_blame_get_hunk_count: {
    parameters: ["pointer"],
    result: "u32",
  },
  git_blame_get_hunk_byindex: {
    parameters: ["pointer", "u32"],
    result: "pointer",
  },
  git_blame_get_hunk_byline: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_blame_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },

  // Index conflict functions
  git_index_conflict_get: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_index_conflict_iterator_new: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_index_conflict_next: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_index_conflict_iterator_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_index_conflict_cleanup: {
    parameters: ["pointer"],
    result: "i32",
  },

  // Patch functions
  git_patch_from_diff: {
    parameters: ["pointer", "pointer", "usize"],
    result: "i32",
  },
  git_patch_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_patch_get_delta: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_patch_num_hunks: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_patch_line_stats: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_patch_to_buf: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Config functions
  git_config_get_entry: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_config_foreach: {
    parameters: ["pointer", "function", "pointer"],
    result: "i32",
  },
  git_config_foreach_match: {
    parameters: ["pointer", "pointer", "function", "pointer"],
    result: "i32",
  },
  git_config_snapshot: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_config_entry_free: {
    parameters: ["pointer"],
    result: "void",
  },

  // Pathspec functions
  git_pathspec_new: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_pathspec_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_pathspec_matches_path: {
    parameters: ["pointer", "u32", "pointer"],
    result: "i32",
  },
  git_pathspec_match_workdir: {
    parameters: ["pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_pathspec_match_index: {
    parameters: ["pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_pathspec_match_tree: {
    parameters: ["pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_pathspec_match_diff: {
    parameters: ["pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_pathspec_match_list_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_pathspec_match_list_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_pathspec_match_list_entry: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_pathspec_match_list_diff_entry: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_pathspec_match_list_failed_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_pathspec_match_list_failed_entry: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },

  // Ignore functions
  git_ignore_add_rule: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_ignore_clear_internal_rules: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_ignore_path_is_ignored: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Attr functions
  git_attr_get: {
    parameters: ["pointer", "pointer", "u32", "pointer", "pointer"],
    result: "i32",
  },
  git_attr_get_many: {
    parameters: ["pointer", "pointer", "u32", "pointer", "usize", "pointer"],
    result: "i32",
  },
  git_attr_foreach: {
    parameters: ["pointer", "u32", "pointer", "function", "pointer"],
    result: "i32",
  },
  git_attr_value: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_attr_cache_flush: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_attr_add_macro: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Graph functions
  git_graph_ahead_behind: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_graph_descendant_of: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Describe functions
  git_describe_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_describe_format_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_describe_commit: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_describe_workdir: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_describe_format: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_describe_result_free: {
    parameters: ["pointer"],
    result: "void",
  },

  // Notes functions
  git_note_iterator_new: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_note_iterator_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_note_next: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_note_read: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_note_author: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_note_committer: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_note_message: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_note_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_note_create: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "i32",
    ],
    result: "i32",
  },
  git_note_remove: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_note_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_note_default_ref: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Worktree functions
  git_worktree_list: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_worktree_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_worktree_open_from_repository: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_worktree_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_worktree_validate: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_worktree_add_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_worktree_add: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_worktree_lock: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_worktree_unlock: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_worktree_is_locked: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_worktree_name: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_worktree_path: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_worktree_prune_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_worktree_is_prunable: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_worktree_prune: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  // Apply functions
  git_apply: {
    parameters: ["pointer", "pointer", "i32", "pointer"],
    result: "i32",
  },
  git_apply_to_tree: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Revert functions
  git_revert_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_revert_commit: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_revert: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Cherry-pick functions
  git_cherrypick_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },
  git_cherrypick_commit: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "u32", "pointer"],
    result: "i32",
  },
  git_cherrypick: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Rebase functions
  git_rebase_init: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
    ],
    result: "i32",
  },
  git_rebase_open: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_rebase_operation_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_rebase_operation_current: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_rebase_operation_byindex: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_rebase_next: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_rebase_inmemory_index: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_rebase_commit: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
      "pointer",
    ],
    result: "i32",
  },
  git_rebase_abort: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_rebase_finish: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_rebase_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_rebase_options_init: {
    parameters: ["pointer", "u32"],
    result: "i32",
  },

  // Submodule functions
  git_submodule_lookup: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_submodule_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_submodule_name: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_path: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_url: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_branch: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_head_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_index_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_wd_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_submodule_ignore: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_submodule_update_strategy: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_submodule_init: {
    parameters: ["pointer", "i32"],
    result: "i32",
  },
  git_submodule_sync: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_submodule_open: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_submodule_reload: {
    parameters: ["pointer", "i32"],
    result: "i32",
  },
  git_submodule_status: {
    parameters: ["pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_submodule_location: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_submodule_foreach: {
    parameters: ["pointer", "function", "pointer"],
    result: "i32",
  },
  git_submodule_add_setup: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "i32"],
    result: "i32",
  },
  git_submodule_add_finalize: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_submodule_add_to_index: {
    parameters: ["pointer", "i32"],
    result: "i32",
  },
  git_submodule_set_url: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_submodule_set_branch: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // ODB functions
  git_repository_odb: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_odb_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_odb_read: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_odb_read_header: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_odb_exists: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_odb_exists_prefix: {
    parameters: ["pointer", "pointer", "pointer", "usize"],
    result: "i32",
  },
  git_odb_write: {
    parameters: ["pointer", "pointer", "pointer", "usize", "i32"],
    result: "i32",
  },
  git_odb_hash: {
    parameters: ["pointer", "pointer", "usize", "i32"],
    result: "i32",
  },
  git_odb_object_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_odb_object_id: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_odb_object_data: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_odb_object_size: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_odb_object_type: {
    parameters: ["pointer"],
    result: "i32",
  },

  // Message functions
  git_message_prettify: {
    parameters: ["pointer", "pointer", "i32", "u8"],
    result: "i32",
  },
  git_message_trailers: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_message_trailer_array_free: {
    parameters: ["pointer"],
    result: "void",
  },

  // Mailmap functions
  git_mailmap_new: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_mailmap_free: {
    parameters: ["pointer"],
    result: "void",
  },
  git_mailmap_add_entry: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_mailmap_from_buffer: {
    parameters: ["pointer", "pointer", "usize"],
    result: "i32",
  },
  git_mailmap_from_repository: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_mailmap_resolve: {
    parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_mailmap_resolve_signature: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },

  // Reflog functions
  git_reflog_read: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reflog_write: {
    parameters: ["pointer"],
    result: "i32",
  },
  git_reflog_append: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reflog_rename: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  git_reflog_delete: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  git_reflog_entrycount: {
    parameters: ["pointer"],
    result: "usize",
  },
  git_reflog_entry_byindex: {
    parameters: ["pointer", "usize"],
    result: "pointer",
  },
  git_reflog_drop: {
    parameters: ["pointer", "usize", "i32"],
    result: "i32",
  },
  git_reflog_entry_id_old: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reflog_entry_id_new: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reflog_entry_committer: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reflog_entry_message: {
    parameters: ["pointer"],
    result: "pointer",
  },
  git_reflog_free: {
    parameters: ["pointer"],
    result: "void",
  },
} as const;
