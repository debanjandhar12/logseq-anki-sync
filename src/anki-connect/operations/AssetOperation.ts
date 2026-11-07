import _ from "lodash";
import {createLogger, LoggerCategory} from "../../logger";
import * as AnkiConnect from "../AnkiConnect";
import type {AnkiAction, AnkiActionResult, StoreAssetsResult} from "../types";
import {getPathForPassingToAnki} from "./utils/getPathForPassingToAnki";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

interface AssetParams {
    filename: string;
    path: string;
}

export class AssetOperation {
    private queue: AssetParams[] = [];
    private readonly BATCH_SIZE = 10;

    storeAsset(filename: string, path: string): void {
        this.queue.push({filename, path});
    }

    async execute(): Promise<StoreAssetsResult> {
        logger.info("Executing asset operation", this.queue);
        const result: StoreAssetsResult = {successfulAssets: [], failedAssets: []};
        const batches = _.chunk(_.uniqBy(this.queue, "filename"), this.BATCH_SIZE);
        this.queue = [];

        const recordFailures = (assets: AssetParams[], reason: unknown) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            for (const asset of assets) {
                result.failedAssets.push({identifier: asset.path, error});
            }
            logger.error("Error storing assets", {assets, error});
        };

        for (const currentBatch of batches) {
            let pendingAssets = currentBatch;
            try {
                const retrieveActions = currentBatch.map((asset) => ({
                    action: "retrieveMediaFile",
                    params: {filename: asset.filename}
                }));

                const existingAssetContents: (string | false | AnkiActionResult)[] =
                    await AnkiConnect.invoke("multi", {
                        actions: retrieveActions
                    });
                if (!Array.isArray(existingAssetContents)) {
                    throw new Error("Anki returned an invalid asset retrieval response.");
                }

                const preparations = await Promise.allSettled(
                    currentBatch.map(async (asset, index) => {
                        const existingContent = existingAssetContents[index];
                        if (typeof existingContent !== "string" && existingContent !== false) {
                            throw (
                                existingContent?.error ||
                                new Error(`Unable to retrieve asset "${asset.filename}" from Anki.`)
                            );
                        }
                        return this.createStoreActionForAsset(asset, existingContent);
                    })
                );
                const preparedAssets: {asset: AssetParams; action: AnkiAction}[] = [];
                for (const [index, preparation] of preparations.entries()) {
                    const asset = currentBatch[index];
                    if (preparation.status === "rejected") {
                        recordFailures([asset], preparation.reason);
                    } else if (preparation.value !== null) {
                        preparedAssets.push({asset, action: preparation.value});
                    }
                }

                pendingAssets = preparedAssets.map(({asset}) => asset);
                if (preparedAssets.length === 0) continue;
                const batchResults: (string | AnkiActionResult)[] = await AnkiConnect.invoke(
                    "multi",
                    {
                        actions: preparedAssets.map(({action}) => action)
                    }
                );
                if (!Array.isArray(batchResults)) {
                    throw new Error("Anki returned an invalid asset storage response.");
                }
                for (const [index, {asset}] of preparedAssets.entries()) {
                    const storeResult = batchResults[index];
                    if (typeof storeResult === "string" && storeResult.length > 0) {
                        result.successfulAssets.push(asset.path);
                    } else {
                        const error = typeof storeResult === "object" && storeResult?.error;
                        recordFailures(
                            [asset],
                            error ||
                                new Error(`Anki did not confirm storing asset "${asset.filename}".`)
                        );
                    }
                }
            } catch (error) {
                recordFailures(pendingAssets, error);
            }
        }

        logger.info("Asset operation completed", result);
        return result;
    }

    private async createStoreActionForAsset(
        asset: AssetParams,
        existingContent: string | false
    ): Promise<AnkiAction | null> {
        if (asset.path == null) {
            throw new Error(`No source URL provided for asset "${asset.filename}".`);
        }

        const base64Content = await this.getBase64FromUrl(asset.path);
        if (base64Content && base64Content !== "data:") {
            if (base64Content === existingContent) return null;
            return {
                action: "storeMediaFile",
                params: {
                    filename: asset.filename,
                    data: base64Content
                }
            };
        }

        const nativePath = getPathForPassingToAnki(asset.path);
        if (nativePath === null) {
            throw new Error(`Unable to read asset "${asset.filename}" from ${asset.path}.`);
        }

        return {
            action: "storeMediaFile",
            params: {
                filename: asset.filename,
                path: nativePath
            }
        };
    }

    private async getBase64FromUrl(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Asset fetch failed: ${response.status}`);
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
}
