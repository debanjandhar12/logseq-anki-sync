import { useCallback } from 'react';
import { useAui } from '@assistant-ui/react-ink';
import type { ThreadFileData } from '../../core/storage/ThreadStorage';
import { ThreadStorage } from '../../core/storage/ThreadStorage';

export function useThreadManager() {
  const aui = useAui();

  const createThread = useCallback(async (thread: ThreadFileData) => {
    await ThreadStorage.saveThread(thread);
    aui.threads().switchToThread(thread.id);
  }, [aui]);

  const selectThread = useCallback((threadId: string) => {
    aui.threads().switchToThread(threadId);
  }, [aui]);

  return {
    createThread,
    selectThread,
  };
}
