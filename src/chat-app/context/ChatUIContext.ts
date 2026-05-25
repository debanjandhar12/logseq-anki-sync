import {createContext, useContext} from "react";

interface ChatUIContextType {
    onClose?: () => void;
}

export const ChatUIContext = createContext<ChatUIContextType>({});
