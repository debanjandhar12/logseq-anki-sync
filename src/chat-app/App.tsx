import {RuntimeAdapterProvider} from "@assistant-ui/react";
import {ShadowWrapper} from "../ui";
import {AppContent} from "./components/AppContent";
import {useAssistantModelContextProvider} from "./context/AssistantModelContextProvider";
import {ChatUIContextProvider} from "./context/ChatUIContextProvider";
import {ThreadBoundLocalAISDKRuntimeProvider} from "./runtime/ThreadBoundLocalAISDKRuntimeProvider";
import chatAppCss from "./style/main.css?inline";

export const App = ({onClose}: {onClose?: () => void}) => {
    const modelContext = useAssistantModelContextProvider();

    return (
        <ChatUIContextProvider.Provider value={{onClose}}>
            <ShadowWrapper>
                <style>{chatAppCss}</style>
                <div
                    className="h-full"
                    style={{height: "calc(100vh - 128px)", margin: "0px", padding: "0px"}}>
                    <RuntimeAdapterProvider adapters={{modelContext}}>
                        <ThreadBoundLocalAISDKRuntimeProvider>
                            <AppContent />
                        </ThreadBoundLocalAISDKRuntimeProvider>
                    </RuntimeAdapterProvider>
                </div>
            </ShadowWrapper>
        </ChatUIContextProvider.Provider>
    );
};
