import {LogseqCheckbox} from "../ui/components/LogseqCheckbox";
import React from "../ui/React";
import {AuiProvider, useAui} from "@assistant-ui/react";
import {CustomThread} from "./thread/CustomThread";
import {getSuggestions} from "./utils/getSuggestions";
import {ThreadBoundLocalAISDKRuntimeProvider} from "./runtime/ThreadBoundLocalAISDKRuntimeProvider";

export const App = () => {
    const aui = useAui({
        suggestions: getSuggestions(),
    });

    return (
        <div className="h-full" style={{height: "calc(100vh - 128px)", margin: "0px", padding: "0px"}}>
            <ThreadBoundLocalAISDKRuntimeProvider>
                <AuiProvider value={aui}>
                    <CustomThread />
                </AuiProvider>
            </ThreadBoundLocalAISDKRuntimeProvider>
        </div>
    );
};
