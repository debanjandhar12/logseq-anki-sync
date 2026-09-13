import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {UpsertPropertyPageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const createPropertyKey = "test-upsert-property-page-command-create";
const restorePropertyKey = "test-upsert-property-page-command-restore";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

function getPropertyType(property: unknown): string | undefined {
    if (typeof property !== "object" || property === null) return undefined;
    const record = property as Record<string, unknown>;
    const type = record.type ?? record["logseq.property/type"] ?? record[":logseq.property/type"];
    return typeof type === "string" ? type.replace(/^:/, "") : undefined;
}

describe("UpsertPropertyPageCommand args", () => {
    it("requires a property UUID or indent", () => {
        expect(() => new UpsertPropertyPageCommand({schema: {type: "default"}} as never)).toThrow();
        expect(() => new UpsertPropertyPageCommand({propertyUuidOrIndent: "deck"})).not.toThrow();
    });
});

describe.skipIf(!shouldRunTests())("UpsertPropertyPageCommand", () => {
    const cleanup = async () => {
        for (const key of [createPropertyKey, restorePropertyKey]) {
            await deletePagePermanently(key);
        }
    };
    beforeAll(cleanup, 60_000);
    afterAll(cleanup, 60_000);

    it("creates a property page and removes it on revert", async () => {
        const command = new UpsertPropertyPageCommand({
            propertyUuidOrIndent: createPropertyKey,
            schema: {type: "number", cardinality: "one"}
        });

        const property = await command.execute();

        expect(property?.uuid).toBeTruthy();
        expect(command.getChangedPages()).toEqual([property?.uuid]);
        expect(await logseq.Editor.getProperty(createPropertyKey)).toBeTruthy();

        await command.revert();

        expect(await logseq.Editor.getProperty(createPropertyKey)).toBeNull();
    }, 60_000);

    it("restores an existing property schema on revert", async () => {
        await logseq.Editor.upsertProperty(restorePropertyKey, {
            type: "default",
            cardinality: "one"
        });

        const propertyPage = (await logseq.Editor.getProperty(restorePropertyKey))!;
        const command = new UpsertPropertyPageCommand({
            propertyUuidOrIndent: propertyPage.uuid,
            schema: {type: "number", cardinality: "one"}
        });

        const updatedProperty = await command.execute();
        expect(command.getChangedPages()).toEqual([updatedProperty?.uuid]);
        expect(getPropertyType(await logseq.Editor.getProperty(restorePropertyKey))).toBe("number");

        await command.revert();

        expect(getPropertyType(await logseq.Editor.getProperty(restorePropertyKey))).toBe(
            "default"
        );
    }, 60_000);
});
