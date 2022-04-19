import * as AnkiConnect from './anki-connect/AnkiConnect';
import { get_better_error_msg, confirm } from './utils';

export async function previewBlockNotesInAnki(...a) {
    console.log(a);
    try {
        await AnkiConnect.requestPermission();
        await AnkiConnect.guiBrowse("uuid:" + a[0].uuid);
    } 
    catch (e) {
    logseq.App.showMsg(get_better_error_msg(e.toString()), 'warning');
    console.error(e);
    } 
}