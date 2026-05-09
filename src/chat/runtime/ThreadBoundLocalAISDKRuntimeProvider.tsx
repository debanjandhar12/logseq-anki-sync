import React, { ReactNode, useMemo } from 'react';
import { AssistantRuntimeProvider, useRemoteThreadListRuntime } from '@assistant-ui/react-ink';
import { LocalThreadListAdapter } from './LocalThreadListAdapter';
import { useThreadBoundLocalAISDKChat } from './useThreadBoundLocalAISDKChat';

interface LocalAiSDKRuntimeProviderProps {
    children: ReactNode;
}

export function ThreadBoundLocalAISDKRuntimeProvider({ children }: Readonly<LocalAiSDKRuntimeProviderProps>) {
    const threadListAdapter = useMemo(() => new LocalThreadListAdapter(), []);

    const runtime = useRemoteThreadListRuntime({
        adapter: threadListAdapter,
        runtimeHook: useThreadBoundLocalAISDKChat,
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
