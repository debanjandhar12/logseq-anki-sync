import Mustache from "mustache";
import {MUSTACHE_TEMPLATE_TAGS} from "./constants";
import {type MustacheTemplateView, MustacheView} from "./MustacheView";

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
        ? MustacheView.createCaseInsensitive(view)
        : await MustacheView.create();

    return mustache.render(template, resolvedView, {}, [...MUSTACHE_TEMPLATE_TAGS]);
}
