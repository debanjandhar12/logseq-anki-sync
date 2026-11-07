export function formatLogPath(filePathWithLine = ""): string {
    try {
        const decodedPath = decodeURIComponent(filePathWithLine);
        return decodedPath.startsWith("/external/")
            ? decodedPath.slice("/external/".length)
            : decodedPath;
    } catch {
        return filePathWithLine;
    }
}
