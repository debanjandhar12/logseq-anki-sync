import { ThreadPrimitive, AuiIf } from "@assistant-ui/react";
import React from "react";
import {CustomComposer} from "./CustomComposer";

export const CustomThread = () => {
    return (
        <ThreadPrimitive.Root>
            <ThreadPrimitive.Viewport>
                <AuiIf condition={(s) => s.thread.isEmpty}>
                    {/* Thread welcome */}
                    <div>Welcome!</div>
                </AuiIf>
                <ThreadPrimitive.Messages>
                    {({ message }) => {
                        return 'Hi';
                    }}
                </ThreadPrimitive.Messages>
                <ThreadPrimitive.ViewportFooter>
                    <ThreadPrimitive.ScrollToBottom />
                    <CustomComposer />
                </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
    );
}