export function parseFailedNoteKey(key: string) {
    const separator = key.lastIndexOf("-");
    return {uuid: key.substring(0, separator), type: key.substring(separator + 1)};
}
