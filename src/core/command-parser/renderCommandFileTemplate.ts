import {splitFrontmatter} from "../frontmatter-parser";
import type {MustacheTemplateView} from "../template-engine/MustacheView";
import {parseTemplateString} from "../template-engine/parseTemplateString";

export async function renderCommandFileTemplate(
    content: string,
    view?: MustacheTemplateView
): Promise<string> {
    const {body} = splitFrontmatter(content);
    return parseTemplateString(body, view);
}
