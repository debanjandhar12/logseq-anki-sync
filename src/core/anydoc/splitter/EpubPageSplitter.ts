import type {PreparedDocumentPage} from "../types";
import {EpubArchive} from "./epub/EpubArchive";
import {EpubPackage} from "./epub/EpubPackage";

export class EpubPageSplitter {
    static async *split(
        bytes: Uint8Array,
        abortSignal?: AbortSignal
    ): AsyncGenerator<PreparedDocumentPage> {
        const archive = await EpubArchive.open(bytes, abortSignal);
        const publication = EpubPackage.read(archive);
        for (let index = 0; index < publication.pageCount; index++) {
            abortSignal?.throwIfAborted();
            const pageBytes = await archive.withPackage(
                publication.path,
                publication.selectPage(index),
                abortSignal
            );
            abortSignal?.throwIfAborted();
            yield {
                pageNo: index + 1,
                bytes: pageBytes
            };
            // Allow cancellation to arrive between synchronous WASM conversions.
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
}
