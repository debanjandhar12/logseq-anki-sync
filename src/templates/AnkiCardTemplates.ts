import logseq_anki_sync_css from "./_logseq_anki_sync.scss?inline";
import logseq_anki_sync_front_css from "./_logseq_anki_sync_front.css?inline";
import logseq_anki_sync_back_css from "./_logseq_anki_sync_back.css?inline";
import logseq_anki_sync_js from "./_logseq_anki_sync.js?string";
import logseq_anki_sync_front_js from "./_logseq_anki_sync_front.js?string";
import logseq_anki_sync_back_js from "./_logseq_anki_sync_back.js?string";
import template from "./template.html?raw";

export const template_front = `<script src="_logseq_anki_sync_front.js" type='text/javascript' async=false defer=false></script>
     ${template}
     <link rel="stylesheet" href="_logseq_anki_sync_front.css">`;
export const template_back = `<script src="_logseq_anki_sync_back.js" type='text/javascript' async=false defer=false></script>
     ${template}
     <link rel="stylesheet" href="_logseq_anki_sync_back.css">`;
export const template_files = {
    "_logseq_anki_sync.css": logseq_anki_sync_css,
    "_logseq_anki_sync_front.css": logseq_anki_sync_front_css,
    "_logseq_anki_sync_back.css": logseq_anki_sync_back_css,
    "_logseq_anki_sync.js": logseq_anki_sync_js,
    "_logseq_anki_sync_front.js": logseq_anki_sync_front_js,
    "_logseq_anki_sync_back.js": logseq_anki_sync_back_js,
};

console.log(template_files);
