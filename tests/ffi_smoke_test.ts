import { assert } from "@std/assert";
import { init, Repository, shutdown, version } from "../mod.ts";

Deno.test("ffi smoke: init, version, repository lifecycle", async () => {
  await init();
  try {
    const libVersion = version();
    assert(typeof libVersion.major === "number");

    const repoPath = Deno.makeTempDirSync({ prefix: "libgit2_smoke_" });
    try {
      using repo = Repository.init(repoPath);
      assert(repo.path.length > 0);
    } finally {
      Deno.removeSync(repoPath, { recursive: true });
    }
  } finally {
    shutdown();
  }
});
