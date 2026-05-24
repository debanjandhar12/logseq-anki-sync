import {type FC, useState} from "react";
import {Thread} from "src/chat-app/components/Thread";
import {ThreadList} from "src/chat-app/components/ThreadList";
import {ThreadTopToolBar} from "src/chat-app/components/ThreadTopToolBar";

export const ThreadWrapper: FC = () => {
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);

    const showThread = () => setIsHistoryVisible(false);

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <ThreadTopToolBar
                isHistoryVisible={isHistoryVisible}
                onBackToThread={showThread}
                onShowHistory={() => setIsHistoryVisible(true)}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
                {isHistoryVisible ? <ThreadList onThreadSelected={showThread} /> : <Thread />}
            </div>
        </div>
    );
};
