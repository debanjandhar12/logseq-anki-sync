import * as AnkiConnect from './anki-connect/AnkiConnect';
import { get_better_error_msg } from './utils';

export async function previewBlockNotesInAnki(...a) {
    console.log(a);
    try {
        await AnkiConnect.requestPermission();
        await AnkiConnect.guiBrowse("uuid:" + a[0].uuid);
    } 
    catch (e) {
        logseq.UI.showMsg(get_better_error_msg(e.toString()), 'warning', {timeout: 4000});
        console.error(e);
    } 
}