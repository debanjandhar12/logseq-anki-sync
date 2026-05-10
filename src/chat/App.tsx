import React from "react";
import {ThreadBoundLocalAISDKRuntimeProvider} from "./runtime/ThreadBoundLocalAISDKRuntimeProvider";
import {AppContent} from "./AppContent";

export const App = () => {
    return (
        <div className="h-full" style={{height: "calc(100vh - 128px)", margin: "0px", padding: "0px"}}>
            <ThreadBoundLocalAISDKRuntimeProvider>
                <AppContent />
            </ThreadBoundLocalAISDKRuntimeProvider>
        </div>
    );
};
