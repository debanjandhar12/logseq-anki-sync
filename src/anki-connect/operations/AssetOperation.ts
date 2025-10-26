import * as AnkiConnect from "../AnkiConnect";
import { AnkiAction } from "../types";
import { WindowParentBridge } from "../../logseq/WindowParentBridge";
import _ from "lodash";

interface AssetParams {
    filename: string;
    path: string;
}

export class AssetOperation {
    private queue: AssetParams[] = [];

    storeAsset(filename: string, path: string): void {
        this.queue.push({ filename, path });
    }

    async execute(): Promise<void> {
        try {
            const uniqueQueue = _.uniqBy(this.queue, "filename");
            let finalStoreAssetActionsQueue: AnkiAction[] = [];
            const maxBatchSize = 10;
            const result: any[] = [];

            while (uniqueQueue.length > 0) {
                let batchQueue: AssetParams[] = [];
                while (batchQueue.length < maxBatchSize && uniqueQueue.length > 0) {
                    batchQueue.push(uniqueQueue.pop()!);
                }

                const retrieveAnkiAssetContentActionQueue = batchQueue.map((asset) => ({
                    action: "retrieveMediaFile",
                    params: { filename: asset.filename },
                }));

                const getBase64Image = async (url: string): Promise<string> => {
                    const response = await WindowParentBridge.getFetch()(url);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    await new Promise((resolve, reject) => {
                        reader.onload = resolve;
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    return (reader.result as string).replace(/^data:.+;base64,/, "");
                };

                const ankiAssetContent = await AnkiConnect.invoke("multi", {
                    actions: retrieveAnkiAssetContentActionQueue,
                });

                const batchStoreAssetActionsQueueWithNulls = await Promise.all(
                    batchQueue.map(async (asset, idx) => {
                        if (asset.path != null) {
                            // Check if asset content has changed using base64 comparison
                            if (await this.shouldSkipAssetUpdate(asset, ankiAssetContent[idx], getBase64Image)) {
                                return null;
                            }

                            let fimg = "";
                            try {
                                fimg = await getBase64Image(asset.path);
                            } catch {}
                            if (fimg !== "" && fimg !== "data:" && fimg != null) {
                                return {
                                    action: "storeMediaFile",
                                    params: {
                                        filename: asset.filename,
                                        data: fimg,
                                    },
                                } as AnkiAction;
                            } else {
                                return {
                                    action: "storeMediaFile",
                                    params: {
                                        filename: asset.filename,
                                        path: asset.path,
                                    },
                                } as AnkiAction;
                            }
                        }
                        return {
                            action: "storeMediaFile",
                            params: {
                                filename: asset.filename,
                                path: asset.path,
                            },
                        } as AnkiAction;
                    })
                );

                const batchStoreAssetActionsQueue = batchStoreAssetActionsQueueWithNulls.filter(
                    (action): action is AnkiAction => action !== null
                );

                finalStoreAssetActionsQueue = [
                    ...finalStoreAssetActionsQueue,
                    ...batchStoreAssetActionsQueue,
                ];

                result.push(
                    ...(await AnkiConnect.invoke("multi", {
                        actions: batchStoreAssetActionsQueue,
                    }))
                );
            }

            this.queue = [];
            console.log("Assets Stored:", finalStoreAssetActionsQueue, result);
        } catch (e) {
            console.error("[AssetOperation] Error storing assets:", e);
        }
    }

    private async shouldSkipAssetUpdate(
        asset: AssetParams,
        ankiAssetContent: string | false,
        getBase64Image: (url: string) => Promise<string>
    ): Promise<boolean> {
        if (ankiAssetContent === false || ankiAssetContent == null) {
            return false;
        }

        // Compare base64 content to determine if asset has changed
        try {
            const fimg = await getBase64Image(asset.path);
            if (fimg !== "" && fimg !== "data:" && fimg != null && fimg === ankiAssetContent) {
                return true;
            }
        } catch (e) {
            // If base64 comparison fails, proceed with update
        }

        return false;
    }
}
