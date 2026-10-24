import {useCallback, useEffect, useState} from "react";
import {createLogger, LoggerCategory} from "../../../logger";
import {countOcclusionGroups} from "../utils/countOcclusionGroups";
import {resolveOcclusionCount} from "../utils/resolveOcclusionCount";

const logger = createLogger(LoggerCategory.Others);

export function useOcclusionCount(blockId: string, value: unknown) {
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
        void resolveOcclusionCount(blockId, propertyValue, revision > 0).then(
            (count) => {
                if (active) setResolved({blockId, signature, count});
            },
            (error) => {
                if (active) {
                    setResolved({blockId, signature, count: null});
                    logger.warn("Could not resolve the occlusion card count.", error);
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
            : countOcclusionGroups(value);
    return {count, refresh};
}
