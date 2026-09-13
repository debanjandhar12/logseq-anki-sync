import {
    type ExportedMessageRepository,
    fromThreadMessageLike,
    type ThreadMessage
} from "@assistant-ui/react";
import {expect} from "vitest";
import {findLastLogseqReversibleTransactionTracker} from "../../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";

export interface TrackerLocation {
    messageId: string;
    toolCallId: string;
}

export interface TrackerWithLocation {
    tracker: NonNullable<ReturnType<typeof findLastLogseqReversibleTransactionTracker>>["tracker"];
    location: TrackerLocation;
}

/**
 * Find the last transaction tracker in a repository, optionally scoped to a specific message/tool call.
 */
export function trackerAt(
    repository: ExportedMessageRepository,
    location?: TrackerLocation
): TrackerWithLocation {
    const messages: ThreadMessage[] = (
        location
            ? repository.messages
                  .filter(({message}) => message.id === location.messageId)
                  .map(({message}) => {
                      if (message.role !== "assistant")
                          throw new Error("Tracker artifacts must belong to assistant messages");
                      return {
                          ...message,
                          content: message.content.filter(
                              (part) =>
                                  part.type === "tool-call" &&
                                  part.toolCallId === location.toolCallId
                          )
                      };
                  })
            : repository.messages.map(({message}) => message)
    ).map((message) =>
        fromThreadMessageLike(message, message.id!, {type: "complete", reason: "unknown"})
    );

    const located = findLastLogseqReversibleTransactionTracker(messages);
    expect(located, "The real tool must persist its transaction artifact").not.toBeNull();

    return {
        tracker: located!.tracker,
        location: location ?? {messageId: located!.messageId, toolCallId: located!.toolCallId}
    };
}
