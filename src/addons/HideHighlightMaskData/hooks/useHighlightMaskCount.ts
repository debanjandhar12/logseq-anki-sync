import {useCallback, useEffect, useState} from "react";
import {createLogger, LoggerCategory} from "../../../logger";
import {countHighlightMaskGroups} from "../utils/countHighlightMaskGroups";
import {resolveHighlightMaskCount} from "../utils/resolveHighlightMaskCount";

const logger = createLogger(LoggerCategory.Others);

export function useHighlightMaskCount(blockId: string, value: unknown) {
    // Host reference objects may be freshly allocated even when their contents are unchanged.
    const signature = JSON.stringify(value);
    const [revision, setRevision] = useState(0);
    const [resolved, setResolved] = useState<{
        blockId: string;
        signature: string;
        count: number | null;
    }>(null);
    const refresh = useCallback(() => setRevision((previous) => previous + 1), []);

    useEffect(() => {
        let active = true;
        const propertyValue: unknown = signature === undefined ? undefined : JSON.parse(signature);
        void resolveHighlightMaskCount(blockId, propertyValue, revision > 0).then(
            (count) => {
                if (active) setResolved({blockId, signature, count});
            },
            (error) => {
                if (active) {
                    setResolved({blockId, signature, count: null});
                    logger.warn("Could not resolve the highlight mask card count.", error);
                }
            }
        );
        return () => {
            active = false;
        };
    }, [blockId, signature, revision]);

    const count =
        resolved?.blockId === blockId && resolved.signature === signature
            ? resolved.count
            : countHighlightMaskGroups(value);
    return {count, refresh};
}
