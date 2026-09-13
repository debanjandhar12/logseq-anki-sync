import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {LogseqBlockPropertyHelper} from "../../../src/logseq/LogseqBlockPropertyHelper";
import {LogseqEditor} from "../../../src/logseq/LogseqEditor";

const propertyKey = ":plugin.property.test/example";
const blockUuid = "block-uuid";
const property = {ident: propertyKey, type: "default", cardinality: "many"};
let rawValue: unknown;

beforeEach(() => {
    rawValue = [
        {id: 101, content: "first value"},
        {id: 102, title: "second value"}
    ];
    vi.spyOn(LogseqEditor, "getProperty").mockImplementation(async () => property as never);
    vi.stubGlobal("logseq", {
        ...logseq,
        Editor: {
            getBlockProperties: vi.fn(async () => ({[propertyKey]: rawValue})),
            getBlockProperty: vi.fn(async () => rawValue)
        }
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("LogseqBlockPropertyHelper value contracts", () => {
    it("keeps raw value entities separate from normalized text and writable snapshots", async () => {
        await expect(
            LogseqBlockPropertyHelper.getRawBlockProperty(blockUuid, propertyKey)
        ).resolves.toBe(rawValue);
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(blockUuid, propertyKey)
        ).resolves.toEqual(["first value", "second value"]);
        await expect(
            LogseqBlockPropertyHelper.getBlockPropertyInputValue(blockUuid, propertyKey)
        ).resolves.toEqual(["first value", "second value"]);
    });

    it.each([
        "node",
        "date",
        "asset"
    ])("keeps %s write snapshots as reference IDs", async (type) => {
        vi.mocked(LogseqEditor.getProperty).mockResolvedValue({...property, type} as never);
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(blockUuid, propertyKey)
        ).resolves.toEqual(["first value", "second value"]);
        await expect(
            LogseqBlockPropertyHelper.getBlockPropertyInputValue(blockUuid, propertyKey)
        ).resolves.toEqual([101, 102]);
    });

    it.each([null, false, 0, ""])("preserves primitive values: %j", async (value) => {
        rawValue = value;
        vi.mocked(LogseqEditor.getProperty).mockResolvedValue({
            ...property,
            cardinality: "one"
        } as never);
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(blockUuid, propertyKey)
        ).resolves.toBe(value);
        await expect(
            LogseqBlockPropertyHelper.getBlockPropertyInputValue(blockUuid, propertyKey)
        ).resolves.toBe(value);
    });
});
