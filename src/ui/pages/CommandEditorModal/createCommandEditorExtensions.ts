import type {CompletionContext} from "@codemirror/autocomplete";
import {autocompletion} from "@codemirror/autocomplete";
import {lintGutter} from "@codemirror/lint";
import type {Extension} from "@codemirror/state";
import {COMMAND_FRONTMATTER_FIELDS, validateCommandFileContent} from "src/core/command-parser";
import {splitFrontmatter, validateFrontmatterTemplate} from "src/core/frontmatter-parser";
import {MUSTACHE_TEMPLATE_TAGS, MustacheView} from "src/core/template-engine";
import {
    createFrontmatterCompletionSource,
    createFrontmatterLinter,
    createMarkdownCompletionSource,
    createMarkdownLanguageSupport,
    createMustacheCompletionSource,
    createMustacheLinter,
    createYamlFrontmatterLanguageSupport
} from "src/ui/components/LogseqCodeEditor";
import type {FrontmatterFieldDefinition} from "src/ui/components/LogseqCodeEditor/extensions/yamlFrontmatter";

function isInCommandFrontmatter(context: CompletionContext): boolean {
    return context.pos < splitFrontmatter(context.state.doc.toString()).prefix.length;
}

export const COMMAND_EDITOR_FRONTMATTER_FIELDS: readonly FrontmatterFieldDefinition[] =
    COMMAND_FRONTMATTER_FIELDS.flatMap((field) => {
        const {key, valueType} = field;
        if (
            key === "built-in-command" ||
            key === "built-in-command-user-controllable" ||
            valueType === "string-array"
        ) {
            return [];
        }
        return [{key, valueType, required: "required" in field && field.required}];
    });

export function createCommandEditorExtensions(): Extension[] {
    const markdownSupport = createMarkdownLanguageSupport();
    return [
        createYamlFrontmatterLanguageSupport(markdownSupport),
        autocompletion({
            override: [
                createMustacheCompletionSource({
                    tags: MUSTACHE_TEMPLATE_TAGS,
                    getVariableNames: () => MustacheView.getVariableNames(),
                    isDisabledAt: isInCommandFrontmatter
                }),
                createFrontmatterCompletionSource({
                    fields: COMMAND_EDITOR_FRONTMATTER_FIELDS,
                    mustacheTags: MUSTACHE_TEMPLATE_TAGS
                }),
                createMarkdownCompletionSource({mustacheTags: MUSTACHE_TEMPLATE_TAGS})
            ]
        }),
        createMustacheLinter(validateFrontmatterTemplate),
        createFrontmatterLinter((source) => validateCommandFileContent(source).issues),
        lintGutter()
    ];
}
