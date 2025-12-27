import { assert } from "@std/assert";
import { initGit, Repository } from "../mod.ts";

Deno.test("ffi smoke: init, version, repository lifecycle", async () => {
  using git = await initGit();

  assert(typeof git.version.major === "number");

  const repoPath = Deno.makeTempDirSync({ prefix: "libgit2_smoke_" });
  try {
    using repo = Repository.init(repoPath);
    assert(repo.path.length > 0);
  } finally {
    Deno.removeSync(repoPath, { recursive: true });
  }
});
