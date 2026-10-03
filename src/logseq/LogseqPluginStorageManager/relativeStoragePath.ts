/** Assert an opaque, canonical relative POSIX storage key without rewriting it. */
export function assertRelativeStoragePath(value: string): void {
    if (
        typeof value !== "string" ||
        !value ||
        value.includes("\\") ||
        Array.from(value).some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || (code >= 127 && code <= 159);
        }) ||
        /^[a-z]:/i.test(value) ||
        value.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
        throw new Error(`Invalid relative storage path: ${JSON.stringify(value)}`);
    }
}

/** Reject file keys whose ancestors are also files. */
export function assertStorageFileTree(paths: readonly string[]): void {
    const files = new Set(paths);
    for (const file of files) {
        assertRelativeStoragePath(file);
        const segments = file.split("/");
        for (let index = 1; index < segments.length; index += 1) {
            const ancestor = segments.slice(0, index).join("/");
            if (files.has(ancestor)) {
                throw new Error(`Storage file/directory collision: ${ancestor}`);
            }
        }
    }
}
