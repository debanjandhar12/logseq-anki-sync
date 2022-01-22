import _ from 'lodash';

const ANKI_PORT = 8765;

// Read https://github.com/FooSoft/anki-connect#supported-actions

export function invoke(action: string, params = {}): any {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.addEventListener('error', () => reject('failed to issue request'));
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (Object.getOwnPropertyNames(response).length != 2) {
                    throw 'response has an unexpected number of fields';
                }
                if (!response.hasOwnProperty('error')) {
                    throw 'response is missing required error field';
                }
                if (!response.hasOwnProperty('result')) {
                    throw 'response is missing required result field';
                }
                if (response.error) {
                    throw response.error;
                }
                resolve(response.result);
            } catch (e) {
                reject(e);
            }
        });

        xhr.open('POST', 'http://127.0.0.1:' + ANKI_PORT.toString());
        xhr.send(JSON.stringify({ action, version: 6, params }));
    })
}

export async function requestPermission(): Promise<any> {
    let r = await invoke("requestPermission", {});
    if (r.permission != "granted") {
        return new Promise((resolve, reject) => { throw 'Permission to access anki was denied'; });
    }
    return r;
}

export async function createDeck(deckName: string): Promise<any> {
    return await invoke("createDeck", { "deck": deckName });
}


export async function addNote(deckName: string, modelName: string, fields, tags: string[]): Promise<any> {
    let r; // Bug Fix: Await doesnt work proerly without this
    r = await createDeck(deckName); // Create Deck with name if it does not exists

    // Some versions of Anki doesnt allow to add notes without cloze
    // The trick below adds an empty note with a cloze block, and then overwites it to overcome the above problem.
    let cloze_id = _.get(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g.exec(fields["Text"]), 2) || 1;
    let ankiId = await invoke("addNote", { "note": { "modelName": modelName, "deckName": deckName, "fields": { ...fields, "Text": `{{c${cloze_id}:: placeholder}}` }, "tags": tags, "options": { "allowDuplicate": true } } });
    r = updateNote(ankiId, deckName, modelName, fields, tags);
    return ankiId;
}

// Update existing note (NB: Note must exists)
export async function updateNote(ankiId: number, deckName: string, modelName: string, fields, tags: string[]): Promise<any> {
    let noteinfo = (await invoke("notesInfo", { "notes": [ankiId] }))[0];
    console.debug(noteinfo);
    let cards = noteinfo.cards;
    let r = await invoke("changeDeck", { "cards": cards, "deck": deckName }); // Move cards made by note to new deck and create new deck if deck not created

    // Remove all old tags and add new ones
    let to_remove_tags = _.difference(noteinfo.tags, tags);
    let to_add_tags = _.difference(tags, noteinfo.tags);
    for (let tag of to_remove_tags)
        r = await invoke("removeTags", { "notes": [ankiId], "tags": tag });
    for (let tag of to_add_tags)
        r = await invoke("addTags", { "notes": [ankiId], "tags": tag });
    r = await invoke("clearUnusedTags", {});
    return await invoke("updateNoteFields", { "note": { id: ankiId, "deckName": deckName, "modelName": modelName, "fields": fields } });
}

export async function deteteNote(ankiId: number): Promise<any> {
    return await invoke("deleteNotes", { notes: [ankiId] });
}

export async function removeEmptyNotes(): Promise<any> {
    return await invoke("removeEmptyNotes", {});
}

export async function query(q: string): Promise<any> {
    return await invoke("findNotes", { "query": q });
}

export async function createBackup(): Promise<any> {
    let timestamp = Date.now();
    let decknames = await invoke("deckNames", {});
    for (let deck of decknames) {
        if (deck.includes("::") == false) {  // if is not a subdeck then only create backup
            console.log(`Created backup with name LogseqAnkiSync-Backup-${timestamp}_${deck}.apkg`);
            await invoke("exportPackage", { "deck": deck, "path": `../LogseqAnkiSync-Backup-${timestamp}_${deck}.apkg`, "includeSched": true });
        }
    }
    return;
}

// Create a model with given name if it does not exists
export async function createModel(modelName: string, fields: string[], template_front: string, template_back: string, template_files: any): Promise<void> {
    let models = await invoke("modelNames", {});
    if (!models.includes(modelName)) {
        await invoke("createModel", {
            "modelName": modelName, "inOrderFields": fields, "css": "", "isCloze": true,
            "cardTemplates": [
                {
                    "Name": "Card",
                    "Front": template_front,
                    "Back": template_back
                }
            ]
        });
        console.log(`Created new model ${modelName}`);
    }

    try {
        await invoke("updateModelTemplates", {
            "model": {
                "name": modelName,
                "templates": {
                    "Card": {
                        "Front": template_front,
                        "Back": template_back
                    }
                }
            }
        });
    }
    // Solves #1 by failing silenty, #1 was caused by AnkiConnect calling old Anki API but apprarenty even if it gives error, it works correctly.
    catch (e) { if (e == "save() takes from 1 to 2 positional arguments but 3 were given") console.error(e); else throw e; };

    // Iterate over files obj and add them to anki
    for (var filename in template_files){
        try {await storeMediaFileByContent(filename, template_files[filename]);} catch(e) { console.error(filename);console.error(e); }
    }
}

export async function storeMediaFileByContent(filename: string, content: string): Promise<any> {
    return await invoke('storeMediaFile', {
        filename: filename,
        data: btoa(content)
    });
}

export async function storeMediaFileByPath(filename: string, path: string): Promise<any> {
    return await invoke('storeMediaFile', {
        filename: filename,
        path: path
    });
}