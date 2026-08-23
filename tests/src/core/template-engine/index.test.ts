import {describe, expect, test} from "vitest";
import * as templateEngine from "../../../../src/core/template-engine";

describe("template-engine module", () => {
    test("exports its public API", () => {
        expect(templateEngine.MUSTACHE_TEMPLATE_TAGS).toEqual(["<%", "%>"]);
        expect(templateEngine.createMustacheView).toBeTypeOf("function");
        expect(templateEngine.createMustacheViewFromValues).toBeTypeOf("function");
        expect(templateEngine.getMustacheTemplateVariableNames).toBeTypeOf("function");
        expect(templateEngine.parseTemplateString).toBeTypeOf("function");
        expect(templateEngine.validateMustacheTemplate).toBeTypeOf("function");
    });
});
