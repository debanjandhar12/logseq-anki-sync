import { Note } from "../../anki-notes/Note";
import { ParsedNoteData } from "../types";
import { DeckParser } from "./DeckParser";
import { BreadcrumbAndParentBlockParser } from "./BreadcrumbAndParentBlockParser";
import { TagParser } from "./TagParser";
import { ExtraFieldParser } from "./ExtraFieldParser";
import { ParentContentParser } from "./ParentContentParser";

export async function parseNote(note: Note, graphName: string): Promise<ParsedNoteData> {
    let { html, assets, tags } = await note.getClozedContentHTML();
    
    const tagsSet = tags instanceof Set ? tags : new Set(tags);
    const parentResult = await ParentContentParser.parse(note, html, assets, tagsSet);
    html = parentResult.html;
    assets = parentResult.assets;

    const deck = await DeckParser.parse(note);

    const breadcrumb = await BreadcrumbAndParentBlockParser.parse(note, graphName);

    const collectedTags = await TagParser.parse(note, Array.from(parentResult.tags));

    const extra = await ExtraFieldParser.parse(note, assets);

    return [html, assets, deck, breadcrumb, collectedTags, extra];
}
