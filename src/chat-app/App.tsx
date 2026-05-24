import {ShadowWrapper} from "../ui";
import {AppContent} from "./components/AppContent";
import {ThreadBoundLocalAISDKRuntimeProvider} from "./runtime/ThreadBoundLocalAISDKRuntimeProvider";
import chatAppCss from "./style/main.css?inline";

export const App = () => {
    return (
        <ShadowWrapper>
            <style>{chatAppCss}</style>
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
