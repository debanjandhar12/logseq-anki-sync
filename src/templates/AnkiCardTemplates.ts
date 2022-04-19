import fs from 'fs';
// @ts-expect-error
import logseq_anki_sync_css from "bundle-text:./_logseq_anki_sync.css";
// @ts-expect-error
import logseq_anki_sync_front_css from "bundle-text:./_logseq_anki_sync_front.css";
// @ts-expect-error
import logseq_anki_sync_back_css from "bundle-text:./_logseq_anki_sync_back.css";

let template = fs.readFileSync(__dirname + '/template.html', 'utf8');

export let template_front = template + `
    <script src="_logseq_anki_sync_front.js"></script>
    <link rel="stylesheet" href="_logseq_anki_sync_front.css">`;
export let template_back = template + `
    <script src="_logseq_anki_sync_back.js"></script>
    <link rel="stylesheet" href="_logseq_anki_sync_back.css">`;
export let template_files = {
                    "_logseq_anki_sync.css": logseq_anki_sync_css,
                    "_logseq_anki_sync_front.css": logseq_anki_sync_front_css,
                    "_logseq_anki_sync_back.css": logseq_anki_sync_back_css,
                    "_logseq_anki_sync.js": fs.readFileSync(__dirname + '/_logseq_anki_sync.js', 'utf8'),
                    "_logseq_anki_sync_front.js": fs.readFileSync(__dirname + '/_logseq_anki_sync_front.js', 'utf8'),
                    "_logseq_anki_sync_back.js": fs.readFileSync(__dirname + '/_logseq_anki_sync_back.js', 'utf8')
                };

console.log(template_files);