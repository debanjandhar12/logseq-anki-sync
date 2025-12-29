import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { convertToHTMLFile } from "../../logseq/LogseqToHTMLConverterProxy";
import _ from "lodash";

export class ExtraFieldParser {
    static async parse(note: Note, assets: Set<string>): Promise<string> {
        let extra = _.get(note, "properties.extra") || 
                    _.get(note, "page.properties.extra") || "";

        if (Array.isArray(extra)) {
            extra = extra.join(" ");
        }

        const format = (await LogseqProxy.Editor.getBlock(note.uuid)).format;
        const converted = await convertToHTMLFile(extra, format);

        converted.assets.forEach((asset) => assets.add(asset));

        return converted.html;
    }
}
