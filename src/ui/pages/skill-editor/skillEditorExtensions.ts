import {autocompletion} from "@codemirror/autocomplete";
import type {Extension} from "@codemirror/state";
import {
    getMustacheTemplateVariableNames,
    MUSTACHE_TEMPLATE_TAGS,
    validateMustacheTemplate
} from "src/core/template-engine";
import {
    createFrontmatterCompletionSource,
    createMarkdownCompletionSource,
    createMarkdownLanguageSupport,
    createMustacheCompletionSource,
    createMustacheLintExtensions,
    createYamlFrontmatterLanguageSupport,
    type FrontmatterFieldDefinition
} from "src/ui/components/LogseqCodeEditor";

const SKILL_FRONTMATTER_FIELDS: readonly FrontmatterFieldDefinition[] = [
    {key: "name", valueType: "string", required: true},
    {key: "description", valueType: "string", required: true},
    {key: "disable-model-invocation", valueType: "boolean"},
    {key: "built-in-skill", valueType: "boolean"},
    {key: "built-in-skill-user-controllable", valueType: "boolean"}
];

export function createSkillEditorExtensions(): Extension[] {
    const markdownSupport = createMarkdownLanguageSupport();
    const mustacheCompletion = createMustacheCompletionSource({
        tags: MUSTACHE_TEMPLATE_TAGS,
        variableNames: getMustacheTemplateVariableNames()
    });
    const frontmatterCompletion = createFrontmatterCompletionSource({
        fields: SKILL_FRONTMATTER_FIELDS,
        mustacheTags: MUSTACHE_TEMPLATE_TAGS
    });
    const markdownCompletion = createMarkdownCompletionSource({
        mustacheTags: MUSTACHE_TEMPLATE_TAGS
    });

    return [
        createYamlFrontmatterLanguageSupport(markdownSupport),
        autocompletion({
            override: [mustacheCompletion, frontmatterCompletion, markdownCompletion]
        }),
        ...createMustacheLintExtensions(validateMustacheTemplate)
    ];
}
