import React from "../../React";
import { UI } from "../../UI";

import { createLogger, LoggerCategory } from "../../../utils/logger";

const logger = createLogger(LoggerCategory.Others);

export interface ModalPromiseOptions {
    mountPath?: string;
    errorMessage?: string;
    position?: { left: number; top: number };
}

/**
 * A standardized modal promise wrapper that handles mounting/unmounting
 */
export async function createModalPromise<T>(
    ComponentFactory: (props: {
        resolve: (value: T) => void;
        reject: (error: any) => void;
        [key: string]: any;
    }) => React.ReactElement,
    componentProps: Record<string, any> = {},
    options: ModalPromiseOptions = {}
): Promise<T> {
    const {
        errorMessage = 'Failed to open modal',
        position
    } = options;

    return new Promise<T>(async (resolve, reject) => {
        try {
            await UI.showModal(
                ComponentFactory({
                    resolve,
                    reject,
                    ...componentProps,
                }),
                position
            );
        } catch (e) {
            await logseq.UI.showMsg(errorMessage, "error");
            logger.info(e);
            reject(e);
        }
    });
}
