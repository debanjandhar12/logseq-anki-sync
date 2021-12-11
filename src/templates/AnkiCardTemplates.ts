import fs from 'fs';
// @ts-expect-error
import logseq_anki_sync_css from "bundle-text:./logseq_anki_sync.css";
// @ts-expect-error
import logseq_anki_sync_front_css from "bundle-text:./logseq_anki_sync_front.css";
// @ts-expect-error
import logseq_anki_sync_back_css from "bundle-text:./logseq_anki_sync_back.css";

let template = fs.readFileSync(__dirname + '/template.html', 'utf8');

export let template_front = template + `
    <script src="logseq_anki_sync_front.js"></script>
    <link rel="stylesheet" href="logseq_anki_sync_front.css">`;
export let template_back = template + `
    <script src="logseq_anki_sync_back.js"></script>
    <link rel="stylesheet" href="logseq_anki_sync_back.css">`;
export let template_files = {"logseq_anki_sync.css": logseq_anki_sync_css,
                    "logseq_anki_sync_front.css": logseq_anki_sync_front_css,
                    "logseq_anki_sync_back.css": logseq_anki_sync_back_css,
                    "logseq_anki_sync.js": fs.readFileSync(__dirname + '/logseq_anki_sync.js', 'utf8'),
                    "logseq_anki_sync_front.js": fs.readFileSync(__dirname + '/logseq_anki_sync_front.js', 'utf8'),
                    "logseq_anki_sync_back.js": fs.readFileSync(__dirname + '/logseq_anki_sync_back.js', 'utf8')
                };

console.log(template_files);