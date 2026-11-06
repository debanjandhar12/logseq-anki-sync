import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {LogseqContentPreprocessor} from "../../../src/logseq/LogseqContentPreprocessor";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";

const pageName = "Test Preprocessor Page";

describe.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
    "LogseqContentPreprocessor E2E Tests (file graphs)",
    () => {
        let page: PageEntity;

        beforeEach(async () => {
            await deletePagePermanently(pageName);
            page = await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: true}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
        }, 60_000);

        afterEach(async () => {
            await deletePagePermanently(pageName);
        }, 60_000);

        test("Normalizes page references to page IDs", async () => {
            const result = await LogseqContentPreprocessor.preprocess(
                `Hello [[${pageName}]]`,
                "markdown"
            );

            expect(result).toEqual({
                content: `Hello [[${page.id}]]`,
                properties: {},
                rawPropertiesStr: ""
            });
        });

        test("Normalizes page embeds to page IDs", async () => {
            const result = await LogseqContentPreprocessor.preprocess(
                `{{embed [[${pageName}]]}}`,
                "markdown"
            );

            expect(result).toEqual({
                content: `{{embed [[${page.id}]]}}`,
                properties: {},
                rawPropertiesStr: ""
            });
        });

        test("Preserves labels when normalizing renamed page references", async () => {
            const result = await LogseqContentPreprocessor.preprocess(
                `[Label]([[${pageName}]])`,
                "markdown"
            );

            expect(result).toEqual({
                content: `[Label]([[${page.id}]])`,
                properties: {},
                rawPropertiesStr: ""
            });
        });

        test("Extracts properties while normalizing page references", async () => {
            const result = await LogseqContentPreprocessor.preprocess(
                `deck:: Default\nHello [[${pageName}]]`,
                "markdown"
            );

            expect(result).toEqual({
                content: `Hello [[${page.id}]]`,
                properties: {deck: "Default"},
                rawPropertiesStr: "deck:: Default\n"
            });
        });
    }
);
