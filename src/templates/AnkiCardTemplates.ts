import fs from 'fs';
// @ts-expect-error
import logseq_anki_sync_css from "bundle-text:./_logseq_anki_sync.css";
// @ts-expect-error
import logseq_anki_sync_front_css from "bundle-text:./_logseq_anki_sync_front.css";
// @ts-expect-error
import logseq_anki_sync_back_css from "bundle-text:./_logseq_anki_sync_back.css";
// @ts-expect-error
import logseq_anki_sync_js from "bundle-text:./_logseq_anki_sync.js";
// @ts-expect-error
import logseq_anki_sync_front_js from "bundle-text:./_logseq_anki_sync_front.js";
// @ts-expect-error
import logseq_anki_sync_back_js from "bundle-text:./_logseq_anki_sync_back.js";

let template = fs.readFileSync(__dirname + '/template.html', 'utf8');

export let template_front =
    `<script src="_logseq_anki_sync_front.js" type='text/javascript' async=false defer=false></script>
     ${template}
     <link rel="stylesheet" href="_logseq_anki_sync_front.css">`;
export let template_back =
    `<script src="_logseq_anki_sync_back.js" type='text/javascript' async=false defer=false></script>
     ${template}
     <link rel="stylesheet" href="_logseq_anki_sync_back.css">`;
export let template_files = {
                    "_logseq_anki_sync.css": logseq_anki_sync_css,
                    "_logseq_anki_sync_front.css": logseq_anki_sync_front_css,
                    "_logseq_anki_sync_back.css": logseq_anki_sync_back_css,
                    "_logseq_anki_sync.js": logseq_anki_sync_js,
                    "_logseq_anki_sync_front.js": logseq_anki_sync_front_js,
                    "_logseq_anki_sync_back.js": logseq_anki_sync_back_js
                };

console.log(template_files);