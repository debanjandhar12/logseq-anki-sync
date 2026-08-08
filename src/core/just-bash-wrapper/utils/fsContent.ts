import {Buffer} from "buffer";
import type {BufferEncoding, FileContent} from "just-bash";

export type FileEncodingOptions = {encoding?: BufferEncoding | null};

/** Re-encode stored UTF-8 text into the encoding requested by just-bash. */
export function encodeStoredText(
    text: string,
    options?: FileEncodingOptions | BufferEncoding
): string {
    const encoding = typeof options === "string" ? options : options?.encoding;
    if (encoding == null || encoding === "utf8" || encoding === "utf-8") return text;
    return Buffer.from(text, "utf8").toString(encoding);
}

/** Convert just-bash file content to UTF-8 text suitable for plugin storage. */
export function toStorableText(content: FileContent): string {
    return typeof content === "string" ? content : new TextDecoder().decode(content);
}
