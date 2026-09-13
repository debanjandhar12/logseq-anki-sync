import type {ChatModelAdapter} from "@assistant-ui/react";

export async function createChatApp(chatModelAdapter: ChatModelAdapter) {
    // Load App after scenario fixtures have registered their module mocks.
    const {App} = await import("../../src/chat-app/App");
    return <App chatModelAdapter={chatModelAdapter} />;
}
