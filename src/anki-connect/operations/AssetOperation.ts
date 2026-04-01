import * as AnkiConnect from "../AnkiConnect";
import { AnkiAction } from "../types";
import { WindowParentBridge } from "../../logseq/WindowParentBridge";
import { createLogger, LoggerCategory } from "../../logger";
import _ from "lodash";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

interface AssetParams {
    filename: string;
    path: string;
}

export class AssetOperation {
    private queue: AssetParams[] = [];
    private readonly BATCH_SIZE = 10;

    storeAsset(filename: string, path: string): void {
        this.queue.push({ filename, path });
    }

    async execute(): Promise<void> {
        try {
            logger.info("Executing asset operation", this.queue);
            const uniqueAssets = _.uniqBy(this.queue, "filename");
            const batches = _.chunk(uniqueAssets, this.BATCH_SIZE);
            const allStoreActions: AnkiAction[] = [];
            const storeResults: any[] = [];

            for (const currentBatch of batches) {
                const retrieveActions = currentBatch.map((asset) => ({
                    action: "retrieveMediaFile",
                    params: { filename: asset.filename },
                }));

                const existingAssetContents = await AnkiConnect.invoke("multi", {
                    actions: retrieveActions,
                });

                const storeActionsWithNulls = await Promise.all(
                    currentBatch.map(async (asset, idx) =>
                        this.createStoreActionForAsset(asset, existingAssetContents[idx])
                    )
                );

                const storeActions = storeActionsWithNulls.filter(
                    (action): action is AnkiAction => action !== null
                );

                allStoreActions.push(...storeActions);

                const batchResults = await AnkiConnect.invoke("multi", {
                    actions: storeActions,
                });
                storeResults.push(...batchResults);
            }

            this.queue = [];
            logger.info("Asset stored successfully", storeResults);
        } catch (e) {
            logger.error("Error storing assets", e);
        }
    }

    private async createStoreActionForAsset(
        asset: AssetParams,
        existingContent: string | false
    ): Promise<AnkiAction | null> {
        if (asset.path == null || await this.shouldSkipAssetUpdate(asset, existingContent)) {
            return null;
        }

        const base64Content = await this.getBase64FromUrl(asset.path);
        if (base64Content && base64Content !== "data:") {
            return {
                action: "storeMediaFile",
                params: {
                    filename: asset.filename,
                    data: base64Content,
                },
            };
        }

        return {
            action: "storeMediaFile",
            params: {
                filename: asset.filename,
                path: asset.path,
            },
        };
    }

    private async getBase64FromUrl(url: string): Promise<string> {
        try {
            const response = await WindowParentBridge.getFetch()(url);
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise((resolve, reject) => {
                reader.onload = resolve;
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return (reader.result as string).replace(/^data:.+;base64,/, "");
        } catch {
            return "";
        }
    }

    private async shouldSkipAssetUpdate(
        asset: AssetParams,
        existingContent: string | false
    ): Promise<boolean> {
        if (existingContent === false || existingContent == null) {
            return false;
        }

        try {
            const newBase64Content = await this.getBase64FromUrl(asset.path);
            return (
                newBase64Content !== "" &&
                newBase64Content !== "data:" &&
                newBase64Content === existingContent
            );
        } catch {
            return false;
        }
    }
}
