import {AssistantRuntimeProvider, useRemoteThreadListRuntime} from "@assistant-ui/react";
import React, {type ReactNode, useMemo} from "../../ui/React";
import {LocalThreadListAdapter} from "./LocalThreadListAdapter";
import {useThreadBoundLocalAISDKChat} from "./useThreadBoundLocalAISDKChat";

interface LocalAiSDKRuntimeProviderProps {
    children: ReactNode;
}

export function ThreadBoundLocalAISDKRuntimeProvider({
    children
}: Readonly<LocalAiSDKRuntimeProviderProps>) {
    const threadListAdapter = useMemo(() => new LocalThreadListAdapter(), []);

    const runtime = useRemoteThreadListRuntime({
        adapter: threadListAdapter,
        runtimeHook: useThreadBoundLocalAISDKChat
    });

    return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
