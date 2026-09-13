import type {ChatModelAdapter} from "@assistant-ui/react";
import {ShadowWrapper} from "../ui";
import {AppContent} from "./components/AppContent";
import {ChatUIContext} from "./context/ChatUIContext";
import {ThreadBoundLocalAISDKRuntimeProvider} from "./runtime/ThreadBoundLocalAISDKRuntimeProvider";
import chatAppCss from "./style/main.css?inline";
import {ChatToolRegistryProvider} from "./tools";

type AppProps = {
    onClose?: () => void;
    chatModelAdapter?: ChatModelAdapter;
};

export const App = ({onClose, chatModelAdapter}: AppProps) => {
    return (
        <ChatUIContext.Provider value={{onClose}}>
            <ShadowWrapper>
                <style>{chatAppCss}</style>
                <div
                    className="h-full"
                    style={{height: "calc(100vh - 128px)", margin: "0px", padding: "0px"}}>
                    <ChatToolRegistryProvider>
                        <ThreadBoundLocalAISDKRuntimeProvider chatModelAdapter={chatModelAdapter}>
                            <AppContent />
                        </ThreadBoundLocalAISDKRuntimeProvider>
                    </ChatToolRegistryProvider>
                </div>
            </ShadowWrapper>
        </ChatUIContext.Provider>
    );
};
