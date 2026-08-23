import Mustache from "mustache";
import {MUSTACHE_TEMPLATE_TAGS} from "./constants";
import {
    createCaseInsensitiveMustacheView,
    createMustacheView,
    type MustacheTemplateView
} from "./MustacheView";

const mustache = Mustache as unknown as {
    render: (
        template: string,
        view: MustacheTemplateView,
        partials: Record<string, string>,
        tags: [string, string]
    ) => string;
};

export async function parseTemplateString(
    template: string,
    view?: MustacheTemplateView
): Promise<string> {
    const resolvedView = view
        ? createCaseInsensitiveMustacheView(view)
        : await createMustacheView();

    return mustache.render(template, resolvedView, {}, [...MUSTACHE_TEMPLATE_TAGS]);
}
