// @ts-expect-error
import frontTemplate from "bundle-text:./front_template.html";
// @ts-expect-error
import backTemplate from "bundle-text:./back_template.html";

export class AnkiCardTemplates {
    static frontTemplate = frontTemplate;
    static backTemplate = backTemplate;
};