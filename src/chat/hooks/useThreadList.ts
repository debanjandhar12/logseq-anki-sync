import { useMemo, useEffect, useState } from 'react';
import {useAui, useAuiState} from '@assistant-ui/react-ink';
import { ThreadStorage } from '../../core/storage/ThreadStorage';

export interface ThreadListItem {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: Date;
  isCurrent: boolean;
}

/**
 * Hook for fetching and sorting thread list with message counts.
 * Handles data fetching, enrichment, and sorting in one place.
 */
export function useThreadList(options: { filter?: (item: any) => boolean } = {}) {
  const threadIds = useAuiState((state) => state.threads.threadIds);
  const threadItems = useAuiState((state) => state.threads.threadItems);
  const currentThreadId = useAuiState((state) => state.threads.mainThreadId);
  const [messageCounts, setMessageCounts] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch message counts from storage (parallel for performance)
  useEffect(() => {
    const fetchCounts = async () => {
      setIsLoading(true);
      const counts = new Map<string, number>();
      
      await Promise.all(
        threadIds.map(async (threadId) => {
          try {
            const thread = await ThreadStorage.loadThread(threadId);
            if (thread) {
              counts.set(threadId, thread.messages.length);
            }
          } catch (error) {
            console.error(`Failed to load thread ${threadId}:`, error);
            counts.set(threadId, 0);
          }
        })
      );
      
      setMessageCounts(counts);
      setIsLoading(false);
    };

    fetchCounts();
  }, [threadIds]);

  // Filter, enrich, and sort threads
  const threads = useMemo((): ThreadListItem[] => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    
    // Get and filter threads
    let filtered = threadIds
      .map((id) => itemsById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    
    if (options.filter) {
      filtered = filtered.filter(options.filter);
    }

    // Enrich with message counts and current status
    const enriched = filtered.map((item) => ({
      id: item.id,
      title: item.title ?? 'Untitled',
      messageCount: messageCounts.get(item.id) ?? 0,
      updatedAt: new Date((item as any).updatedAt),
      isCurrent: item.id === currentThreadId,
    }));

    // Sort: current thread first, then by updatedAt (latest first)
    return enriched.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [threadIds, threadItems, currentThreadId, messageCounts, options.filter]);

  return {
    threads,
    currentThreadId,
    isLoading,
  };
}
