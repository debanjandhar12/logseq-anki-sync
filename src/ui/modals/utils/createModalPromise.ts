import React from "../../React";
import { UI } from "../../UI";

export interface ModalPromiseOptions {
    mountPath?: string;
    errorMessage?: string;
}

/**
 * A standardized modal promise wrapper that handles mounting/unmounting
 */
export async function createModalPromise<T>(
    ComponentFactory: (props: {
        resolve: (value: T) => void;
        reject: (error: any) => void;
        onClose: () => void;
        uiKey: string;
        [key: string]: any;
    }) => React.ReactElement,
    componentProps: Record<string, any> = {},
    options: ModalPromiseOptions = {}
): Promise<T> {
    const {
        mountPath = '#root main',
        errorMessage = 'Failed to open modal'
    } = options;

    return new Promise<T>(async (resolve, reject) => {
        try {
            const { key, onClose } = await UI.getEventHandlersForMountedReactComponent(
                await logseq.Editor.newBlockUUID()
            );
            const boundOnClose = onClose.bind(this);

            await UI.mountReactComponentInLogseq(
                key,
                mountPath,
                ComponentFactory({
                    resolve,
                    reject,
                    onClose: boundOnClose,
                    uiKey: key,
                    ...componentProps,
                })
            );
        } catch (e) {
            await logseq.UI.showMsg(errorMessage, "error");
            console.log(e);
            reject(e);
        }
    });
}
