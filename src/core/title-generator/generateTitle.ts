import type {ThreadMessage} from "@assistant-ui/react";
import nlp from "compromise";
import {getCustomVocab} from "./getCustomVocab";

export const generateTitle = (remoteId: string, messages: readonly ThreadMessage[]) => {
    nlp.plugin({words: getCustomVocab()});
    let message = "";
    if (messages.length > 0) {
        const firstTextPart = messages[0].content.find((part) => "text" in part);
        if (firstTextPart && "text" in firstTextPart) {
            message = firstTextPart.text;
        }
    }
    const doc = nlp(message);
    const potentialTitles = doc.topics().out("array");

    if (potentialTitles.length > 0) return potentialTitles[0];
    return remoteId;
};
