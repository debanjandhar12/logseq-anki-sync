import {createContext, type ReactNode, useContext, useMemo} from "react";
import {ChatToolRegistry} from "src/chat-app/tools/ToolRegistry";

type ChatToolRegistryContextValue = {
    registry: ChatToolRegistry;
    toolkit: ReturnType<ChatToolRegistry["getAUIToolkit"]>;
    humanToolNames: readonly string[];
};

const ChatToolRegistryContext = createContext<ChatToolRegistryContextValue | null>(null);

export function ChatToolRegistryProvider({children}: {children: ReactNode}) {
    const value = useMemo(() => {
        const registry = ChatToolRegistry.build();
        return {
            registry,
            toolkit: registry.getAUIToolkit(),
            humanToolNames: registry.getHumanToolNames()
        };
    }, []);

    return (
        <ChatToolRegistryContext.Provider value={value}>
            {children}
        </ChatToolRegistryContext.Provider>
    );
}

export function useChatToolRegistry(): ChatToolRegistryContextValue {
    const value = useContext(ChatToolRegistryContext);
    if (!value) throw new Error("useChatToolRegistry must be used within ChatToolRegistryProvider");
    return value;
}
