import * as AnkiConnect from './AnkiConnect';

export async function getAnkiIDForModelFromUUID(uuid: string, modelName: string): Promise<any> {
    let ankiId: number = NaN;
    if (uuid != "" && uuid != null)
        ankiId = parseInt((await AnkiConnect.query(`uuid:${uuid} note:${modelName}`))[0]);
    return ankiId;
}
