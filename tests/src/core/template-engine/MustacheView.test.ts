import {afterEach, describe, expect, test, vi} from "vitest";
import * as skillListModule from "../../../../src/core/template-engine/getModelInvokableSkillListString";
import * as dateFormatModule from "../../../../src/core/template-engine/getUserPreferredDayjsFormat";
import * as timeZoneModule from "../../../../src/core/template-engine/getUserTimeZone";
import {createMustacheView} from "../../../../src/core/template-engine/MustacheView";
import {MUSTACHE_TEMPLATE_VARIABLES} from "../../../../src/core/template-engine/mustacheTemplateVariables";
import {LogseqEditor} from "../../../../src/logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../../../src/logseq/LogseqSettingAccessor";

describe("MustacheView", () => {
    afterEach(() => vi.restoreAllMocks());

    test("exposes canonical variables and compatibility aliases", async () => {
        vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({
            disabled: false,
            globalAgentInstruction: "  Be precise  "
        });
        vi.spyOn(LogseqEditor, "getCurrentPage").mockResolvedValue({uuid: "page-uuid"} as never);
        vi.spyOn(LogseqEditor, "getCurrentEditingBlock").mockResolvedValue({
            uuid: "block-uuid"
        } as never);
        vi.spyOn(skillListModule, "getModelInvokableSkillListString").mockResolvedValue("skills");
        vi.spyOn(dateFormatModule, "getUserPreferredDayjsFormat").mockResolvedValue("YYYY-MM-DD");
        vi.spyOn(timeZoneModule, "getUserTimeZone").mockReturnValue("UTC");

        const view = await createMustacheView(new Date("2026-08-22T12:30:00"));

        expect(view.globalAgentInstruction).toBe("Be precise");
        expect(view.additionalSystemMessage).toBe("Be precise");
        expect(view["additional system message"]).toBe("Be precise");
        expect(view.ADDITIONALSYSTEMMESSAGE).toBe("Be precise");
        expect(view.currentPage).toBe("page-uuid");
        expect(view["current page"]).toBe("page-uuid");
        expect(view.lastSaturday).toBeDefined();
        expect(view["last saturday"]).toBe(view.lastSaturday);
    });

    test("has no case-insensitive name collisions across variable definitions", () => {
        const ownerByName = new Map<string, string>();

        for (const definition of MUSTACHE_TEMPLATE_VARIABLES) {
            for (const name of [definition.canonicalName, ...definition.aliases]) {
                const normalizedName = name.toLowerCase();
                const existingOwner = ownerByName.get(normalizedName);
                expect(existingOwner).toBeUndefined();
                ownerByName.set(normalizedName, definition.canonicalName);
            }
        }
    });
});
