import {Extension} from "@tiptap/core";
import {Plugin, PluginKey} from "@tiptap/pm/state";
import {DecorationSet} from "@tiptap/pm/view";

export const HighlightPluginKey = new PluginKey("highlightMask");

export const HighlightMaskExtension = Extension.create({
    name: "highlightMask",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: HighlightPluginKey,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, set) {
                        const meta = tr.getMeta(HighlightPluginKey);
                        return meta?.type === "SET_DECORATIONS"
                            ? DecorationSet.create(tr.doc, meta.decorations)
                            : set.map(tr.mapping, tr.doc);
                    }
                },
                props: {decorations: (state) => HighlightPluginKey.getState(state)}
            })
        ];
    }
});
