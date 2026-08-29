import type {CompletionContext} from "@codemirror/autocomplete";
import {autocompletion} from "@codemirror/autocomplete";
import {lintGutter} from "@codemirror/lint";
import type {Extension} from "@codemirror/state";
import {splitFrontmatter, validateFrontmatterTemplate} from "src/core/frontmatter-parser";
import {SKILL_FRONTMATTER_FIELDS, validateSkillFileContent} from "src/core/skill-parser";
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

function isInSkillFrontmatter(context: CompletionContext): boolean {
    const {prefix} = splitFrontmatter(context.state.doc.toString());
    return context.pos < prefix.length;
}

export const SKILL_EDITOR_FRONTMATTER_FIELDS = SKILL_FRONTMATTER_FIELDS.filter(
    ({key}) => key !== "built-in-skill" && key !== "built-in-skill-user-controllable"
);

export function createSkillEditorExtensions(): Extension[] {
    const markdownSupport = createMarkdownLanguageSupport();
    const mustacheCompletion = createMustacheCompletionSource({
        tags: MUSTACHE_TEMPLATE_TAGS,
        getVariableNames: () => MustacheView.getVariableNames(),
        isDisabledAt: isInSkillFrontmatter
    });
    const frontmatterCompletion = createFrontmatterCompletionSource({
        fields: SKILL_EDITOR_FRONTMATTER_FIELDS,
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
        createMustacheLinter(validateFrontmatterTemplate),
        createFrontmatterLinter((source) => validateSkillFileContent(source).issues),
        // The gutter is editor-wide and shared by both diagnostic sources.
        lintGutter()
    ];
}
