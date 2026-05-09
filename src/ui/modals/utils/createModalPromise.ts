import {createLogger, LoggerCategory} from "../../../logger";
import type React from "../../React";
import {UI} from "../../UI";

const logger = createLogger(LoggerCategory.UI);

export interface ModalPromiseOptions {
    mountPath?: string;
    errorMessage?: string;
}

interface ModalPromiseContext {
    modalId: string | null;
}

/**
 * A standardized modal promise wrapper that handles mounting/unmounting
 */
export async function createModalPromise<T>(
    ComponentFactory: (props: {
        resolve: (value: T) => void;
        reject: (error: any) => void;
        modalContext?: ModalPromiseContext;
        [key: string]: any;
    }) => React.ReactElement,
    componentProps: Record<string, any> = {},
    options: ModalPromiseOptions = {}
): Promise<T> {
    const {errorMessage = "Failed to open modal"} = options;

    return new Promise<T>(async (resolve, reject) => {
        try {
            const modalId = `modal-${++UI.modalIdCounter}`;

            const modalContext: ModalPromiseContext = {modalId};

            await UI.showModal(
                ComponentFactory({
                    resolve,
                    reject,
                    modalContext,
                    ...componentProps
                }),
                modalId
            );
        } catch (e) {
            await logseq.UI.showMsg(errorMessage, "error");
            logger.info(e);
            reject(e);
        }
    });
}
