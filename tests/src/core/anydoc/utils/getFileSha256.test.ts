import {describe, expect, test} from "vitest";
import {getFileSha256} from "../../../../../src/core/anydoc";

describe("getFileSha256", () => {
    test("hashes the complete byte sequence as lowercase SHA-256", async () => {
        await expect(getFileSha256(new TextEncoder().encode("abc"))).resolves.toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    });
});
