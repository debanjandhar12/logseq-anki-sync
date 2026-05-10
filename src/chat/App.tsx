import React from "react";
import {ShadowWrapper} from "../ui";
import {AppContent} from "./AppContent";
import {ThreadBoundLocalAISDKRuntimeProvider} from "./runtime/ThreadBoundLocalAISDKRuntimeProvider";

export const App = () => {
    return (
        <ShadowWrapper>
            <div
                className="h-full"
                style={{height: "calc(100vh - 128px)", margin: "0px", padding: "0px"}}>
                <ThreadBoundLocalAISDKRuntimeProvider>
                    <AppContent />
                </ThreadBoundLocalAISDKRuntimeProvider>
            </div>
        </ShadowWrapper>
    );
};
