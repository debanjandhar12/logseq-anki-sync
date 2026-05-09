import type {Note} from "../../anki-notes/Note";
import type {ParsedNoteData} from "../types";
import {BreadcrumbAndParentBlockParser} from "./BreadcrumbAndParentBlockParser";
import {DeckParser} from "./DeckParser";
import {ParentContentParser} from "./ParentContentParser";
import {TagParser} from "./TagParser";

export async function parseNote(note: Note, graphName: string): Promise<ParsedNoteData> {
    let {html, assets, tags} = await note.getClozedContentHTML();

    const tagsSet = tags instanceof Set ? tags : new Set(tags);
    const parentResult = await ParentContentParser.parse(note, html, assets, tagsSet);
    html = parentResult.html;
    assets = parentResult.assets;

    const deck = await DeckParser.parse(note);

    const breadcrumb = await BreadcrumbAndParentBlockParser.parse(note, graphName, tagsSet);

    const collectedTags = await TagParser.parse(note, Array.from(parentResult.tags));

    return [html, assets, deck, breadcrumb, collectedTags];
}
