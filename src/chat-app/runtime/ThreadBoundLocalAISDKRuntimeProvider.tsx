import {
    AssistantRuntimeProvider,
    type ChatModelAdapter,
    useRemoteThreadListRuntime
} from "@assistant-ui/react";
import {type ReactNode, useMemo} from "react";
import {LocalThreadListAdapter} from "./LocalThreadListAdapter";
import {useThreadBoundLocalAISDKChat} from "./useThreadBoundLocalAISDKChat";

interface LocalAiSDKRuntimeProviderProps {
    children: ReactNode;
    chatModelAdapter?: ChatModelAdapter;
}

export function ThreadBoundLocalAISDKRuntimeProvider({
    children,
    chatModelAdapter
}: Readonly<LocalAiSDKRuntimeProviderProps>) {
    const threadListAdapter = useMemo(() => new LocalThreadListAdapter(), []);
    const runtimeHook = useMemo(
        () =>
            function useRuntime() {
                // biome-ignore lint/correctness/useHookAtTopLevel: assistant-ui invokes runtimeHook as a React hook.
                return useThreadBoundLocalAISDKChat(chatModelAdapter);
            },
        [chatModelAdapter]
    );

    const runtime = useRemoteThreadListRuntime({
        adapter: threadListAdapter,
        runtimeHook
    });

    return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
