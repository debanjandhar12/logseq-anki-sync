import {splitFrontmatter} from "../template-engine/parser/splitFrontmatter";
import type {MustacheTemplateView} from "../template-engine/renderer/MustacheView";
import {parseTemplateString} from "../template-engine/renderer/parseTemplateString";

export async function renderCommandFileTemplate(
    content: string,
    view?: MustacheTemplateView
): Promise<string> {
    const {body} = splitFrontmatter(content);
    return parseTemplateString(body, view);
}
