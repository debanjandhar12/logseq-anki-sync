import {createContext, useContext} from "react";

interface ChatUIContextType {
    onClose?: () => void;
}

export const ChatUIContext = createContext<ChatUIContextType>({});

export const useChatUI = () => useContext(ChatUIContext);
