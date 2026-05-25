import {createContext, useContext} from "react";

interface ChatUIContextType {
    onClose?: () => void;
}

export const ChatUIContextProvider = createContext<ChatUIContextType>({});

export const useChatUI = () => useContext(ChatUIContextProvider);
