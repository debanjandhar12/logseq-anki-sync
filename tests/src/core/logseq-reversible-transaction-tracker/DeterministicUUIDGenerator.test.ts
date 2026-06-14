import {describe, expect, test} from "vitest";
import {DeterministicUUIDGenerator} from "../../../../src/core/logseq-reversible-transaction-tracker";

describe("DeterministicUUIDGenerator", () => {
    test("returns a valid UUID v5 string", () => {
        const generator = new DeterministicUUIDGenerator("5f9c57d6-3466-4ba3-b6bf-01e12f11c91d");

        const uuid = generator.getUUID();

        expect(uuid).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
    });

    test("returns a different UUID on each invocation", () => {
        const generator = new DeterministicUUIDGenerator("5f9c57d6-3466-4ba3-b6bf-01e12f11c91d");

        const uuid1 = generator.getUUID();
        const uuid2 = generator.getUUID();
        const uuid3 = generator.getUUID();

        expect(uuid1).not.toBe(uuid2);
        expect(uuid2).not.toBe(uuid3);
        expect(uuid1).not.toBe(uuid3);
    });

    test("is deterministic for the same seed", () => {
        const seed = "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d";
        const generator1 = new DeterministicUUIDGenerator(seed);
        const generator2 = new DeterministicUUIDGenerator(seed);

        expect(generator1.getUUID()).toBe(generator2.getUUID());
        expect(generator1.getUUID()).toBe(generator2.getUUID());
        expect(generator1.getUUID()).toBe(generator2.getUUID());
    });

    test("produces different UUIDs for different seeds", () => {
        const generator1 = new DeterministicUUIDGenerator("5f9c57d6-3466-4ba3-b6bf-01e12f11c91d");
        const generator2 = new DeterministicUUIDGenerator("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

        expect(generator1.getUUID()).not.toBe(generator2.getUUID());
    });
});
