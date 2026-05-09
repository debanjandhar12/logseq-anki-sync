import {LogseqProxy} from "../logseq/LogseqProxy";
import logseq_anki_sync_js from "./_logseq_anki_sync.js?string";
import logseq_anki_sync_css from "./_logseq_anki_sync.scss?inline";
import logseq_anki_sync_back_css from "./_logseq_anki_sync_back.css?inline";
import logseq_anki_sync_back_js from "./_logseq_anki_sync_back.js?string";
import logseq_anki_sync_front_css from "./_logseq_anki_sync_front.css?inline";
import logseq_anki_sync_front_js from "./_logseq_anki_sync_front.js?string";
import template from "./template.html?raw";

function getTemplate() {
    const templateModifiedBasedOnUserSetting = template;
    const {ankiFieldOptions} = LogseqProxy.Settings.getPluginSettings();
    if (!Array.isArray(ankiFieldOptions)) return template;

    let modifiedField = "{{cloze:Text}}";
    if (ankiFieldOptions.includes("tts")) {
        modifiedField = "{{tts en_US:" + modifiedField.substring(2);
    }
    if (ankiFieldOptions.includes("furigana")) {
        modifiedField = "{{furigana:" + modifiedField.substring(2);
    }
    if (ankiFieldOptions.includes("kanji")) {
        modifiedField = "{{kanji:" + modifiedField.substring(2);
    }
    if (ankiFieldOptions.includes("kana")) {
        modifiedField = "{{kana:" + modifiedField.substring(2);
    }
    if (ankiFieldOptions.includes("tags")) {
        modifiedField = modifiedField + `{{#Tags}}<br/><br/><sub>Tags: {{Tags}}</sub>{{/Tags}}`;
    }
    if (ankiFieldOptions.includes("rtl")) {
        modifiedField = "<div dir='rtl'>" + modifiedField + "</div>";
    }
    return templateModifiedBasedOnUserSetting.replace("{{cloze:Text}}", modifiedField);
}

export function getTemplateFront() {
    return `<script src="_logseq_anki_sync_front.js" type='text/javascript' async=false defer=false></script>
        ${getTemplate()}
        {{#User Controlled Field (Front)}}<div class="user-controlled-field-front">{{User Controlled Field (Front)}}</div>{{/User Controlled Field (Front)}}
        {{#User Controlled Field (Both)}}<div class="user-controlled-field-both">{{User Controlled Field (Both)}}</div>{{/User Controlled Field (Both)}}
        <span style="display: none" class="anki-card-front-side"></span>
        <link rel="stylesheet" href="_logseq_anki_sync_front.css">`;
}

export function getTemplateBack() {
    return `<script src="_logseq_anki_sync_back.js" type='text/javascript' async=false defer=false></script>
        ${getTemplate()}
        {{#User Controlled Field (Back)}}<div class="user-controlled-field-back">{{User Controlled Field (Back)}}</div>{{/User Controlled Field (Back)}}
        {{#User Controlled Field (Both)}}<div class="user-controlled-field-both">{{User Controlled Field (Both)}}</div>{{/User Controlled Field (Both)}}
        <span style="display: none" class="anki-card-back-side"></span>
        <link rel="stylesheet" href="_logseq_anki_sync_back.css">`;
}

export function getTemplateMediaFiles() {
    return {
        "_logseq_anki_sync.css": logseq_anki_sync_css,
        "_logseq_anki_sync_front.css": logseq_anki_sync_front_css,
        "_logseq_anki_sync_back.css": logseq_anki_sync_back_css,
        "_logseq_anki_sync.js": logseq_anki_sync_js,
        "_logseq_anki_sync_front.js": logseq_anki_sync_front_js,
        "_logseq_anki_sync_back.js": logseq_anki_sync_back_js
    };
}
