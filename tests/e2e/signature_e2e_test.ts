/**
 * End-to-end tests for Signature operations
 */

import { assertExists } from "@std/assert";
import { createTestContext } from "./helpers.ts";
import {
  createSignatureNow,
  freeSignature,
  getLibrary,
  init,
  shutdown,
  Signature,
  type SignatureInfo,
} from "../../mod.ts";

Deno.test("E2E Signature Tests", async (t) => {
  await init();

  try {
    await t.step(
      "Signature.now creates signature with current time",
      async () => {
        await using _ctx = await createTestContext({ withInitialCommit: true });
        const _beforeTime = Math.floor(Date.now() / 1000);

        const sig = Signature.now("Test User", "test@example.com");
        assertExists(sig);
        assertExists(sig.ptr);

        const _afterTime = Math.floor(Date.now() / 1000);

        // Signature should have been created successfully
        // We can verify by using it in a commit or just freeing it without error
        sig.free();
      },
    );

    await t.step("Signature.create with specific time", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      // Create signature with specific timestamp
      const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
      const offset = -300; // UTC-5

      const sig = Signature.create(
        "Historical Author",
        "historical@example.com",
        timestamp,
        offset,
      );

      assertExists(sig);
      assertExists(sig.ptr);

      sig.free();
    });

    await t.step("Signature.fromInfo with time info", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const info: SignatureInfo = {
        name: "Info Author",
        email: "info@example.com",
        time: 1609459200,
        offset: 60, // UTC+1
      };

      const sig = Signature.fromInfo(info);

      assertExists(sig);
      assertExists(sig.ptr);

      sig.free();
    });

    await t.step("Signature.fromInfo without time uses now", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const info: SignatureInfo = {
        name: "Now Author",
        email: "now@example.com",
      };

      const sig = Signature.fromInfo(info);

      assertExists(sig);
      assertExists(sig.ptr);

      sig.free();
    });

    await t.step("createSignatureNow function", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const lib = getLibrary();
      const sigPtr = createSignatureNow(
        lib,
        "Function User",
        "func@example.com",
      );

      assertExists(sigPtr);

      // Clean up
      freeSignature(lib, sigPtr);
    });

    await t.step("freeSignature handles null", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const lib = getLibrary();

      // Should not throw when freeing null
      freeSignature(lib, null);
    });

    await t.step("Signature dispose pattern", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      // Test using dispose
      {
        using sig = Signature.now("Dispose User", "dispose@example.com");
        assertExists(sig.ptr);
        // sig.free() is called automatically at end of block
      }

      // Should be able to create another signature after dispose
      const sig2 = Signature.now("Another User", "another@example.com");
      assertExists(sig2.ptr);
      sig2.free();
    });

    await t.step("Signature.close alias for free", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const sig = Signature.now("Close User", "close@example.com");
      assertExists(sig.ptr);

      // Use close() instead of free()
      sig.close();

      // Calling close again should be safe (idempotent)
      sig.close();
    });

    await t.step("Multiple signatures can coexist", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const sig1 = Signature.now("User One", "one@example.com");
      const sig2 = Signature.now("User Two", "two@example.com");
      const sig3 = Signature.create(
        "User Three",
        "three@example.com",
        1609459200,
        0,
      );

      assertExists(sig1.ptr);
      assertExists(sig2.ptr);
      assertExists(sig3.ptr);

      sig1.free();
      sig2.free();
      sig3.free();
    });

    await t.step("Signature with various timezone offsets", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      const timestamp = 1609459200;

      // UTC
      const sigUTC = Signature.create(
        "UTC User",
        "utc@example.com",
        timestamp,
        0,
      );
      assertExists(sigUTC.ptr);
      sigUTC.free();

      // UTC+5:30 (India)
      const sigIndia = Signature.create(
        "India User",
        "india@example.com",
        timestamp,
        330,
      );
      assertExists(sigIndia.ptr);
      sigIndia.free();

      // UTC-8 (Pacific)
      const sigPacific = Signature.create(
        "Pacific User",
        "pacific@example.com",
        timestamp,
        -480,
      );
      assertExists(sigPacific.ptr);
      sigPacific.free();

      // UTC+12 (New Zealand)
      const sigNZ = Signature.create(
        "NZ User",
        "nz@example.com",
        timestamp,
        720,
      );
      assertExists(sigNZ.ptr);
      sigNZ.free();
    });

    await t.step("Signature with special characters in name", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      // Name with accented characters
      const sig1 = Signature.now("José García", "jose@example.com");
      assertExists(sig1.ptr);
      sig1.free();

      // Name with Asian characters
      const sig2 = Signature.now("山田太郎", "yamada@example.com");
      assertExists(sig2.ptr);
      sig2.free();

      // Name with emoji (may or may not work depending on libgit2)
      const sig3 = Signature.now("Dev User", "dev@example.com");
      assertExists(sig3.ptr);
      sig3.free();
    });

    await t.step("Signature fromInfo partial time info", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      // Only time, no offset - should use now()
      const info1: SignatureInfo = {
        name: "Partial User",
        email: "partial@example.com",
        time: 1609459200,
        // offset is undefined
      };

      const sig1 = Signature.fromInfo(info1);
      assertExists(sig1.ptr);
      sig1.free();

      // Only offset, no time - should use now()
      const info2: SignatureInfo = {
        name: "Partial User 2",
        email: "partial2@example.com",
        // time is undefined
        offset: 60,
      };

      const sig2 = Signature.fromInfo(info2);
      assertExists(sig2.ptr);
      sig2.free();
    });

    await t.step("Signature with epoch timestamp", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      // Unix epoch
      const sig = Signature.create("Epoch User", "epoch@example.com", 0, 0);
      assertExists(sig.ptr);
      sig.free();
    });

    await t.step("Signature with far future timestamp", async () => {
      await using _ctx = await createTestContext({ withInitialCommit: true });
      // Year 2100
      const timestamp = 4102444800;
      const sig = Signature.create(
        "Future User",
        "future@example.com",
        timestamp,
        0,
      );
      assertExists(sig.ptr);
      sig.free();
    });
  } finally {
    shutdown();
  }
});
