import {describe, expect, test} from "vitest";
import * as templateEngine from "../../../../src/core/template-engine";

describe("template-engine module", () => {
    test("exports its public API", () => {
        expect(templateEngine.MUSTACHE_TEMPLATE_TAGS).toEqual(["<%", "%>"]);
        expect(templateEngine.MustacheView).toBeTypeOf("function");
        expect(templateEngine.parseTemplateString).toBeTypeOf("function");
        expect(templateEngine.validateMustacheTemplate).toBeTypeOf("function");
    });
});
