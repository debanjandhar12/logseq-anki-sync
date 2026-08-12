import type {ThreadMessage} from "@assistant-ui/react";
import {extractContentWordsTitle} from "./extractContentWordsTitle";
import {extractVocabTitle} from "./extractVocabTitle";

export const generateTitle = (remoteId: string, messages: readonly ThreadMessage[]): string => {
    if (messages.length === 0) return remoteId;

    const firstTextPart = messages[0].content.find((part) => "text" in part);
    if (!firstTextPart || !("text" in firstTextPart)) return remoteId;
    const message = firstTextPart.text.trim();
    if (!message) return remoteId;

    return extractVocabTitle(message) ?? extractContentWordsTitle(message) ?? remoteId;
};
