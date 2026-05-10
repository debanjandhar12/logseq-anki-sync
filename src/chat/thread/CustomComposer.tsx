import {ComposerPrimitive} from "@assistant-ui/react";
import React from "react";

export const CustomComposer = () => (
    <ComposerPrimitive.Root className="composer-box">
        <ComposerPrimitive.Input placeholder="Type a message..." className="chat-input" />
        <ComposerPrimitive.Send className="chat-send-btn">Send</ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
);
