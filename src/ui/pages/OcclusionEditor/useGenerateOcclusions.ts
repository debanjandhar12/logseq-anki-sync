import {fabric} from "fabric";
import _ from "lodash";
import {type RefObject, useState} from "react";
import {createWorker, OEM, PSM, type Worker} from "tesseract.js";
import workerPath from "tesseract.js/dist/worker.min.js?url";
import corePath from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";
import {createLogger, LoggerCategory} from "../../../logger";
import {createOcclusionRectEl} from "../../../utils/occlusionUtils";

const logger = createLogger(LoggerCategory.Others);

export function useGenerateOcclusions(
    fabricRef: RefObject<any>,
    imgEl: HTMLImageElement,
    saveCanvasState: () => void
) {
    const [isAIGeneratingOcclusion, setIsAIGeneratingOcclusion] = useState(false);
    const aiGenerateOcclusion = async () => {
        let worker: Worker | null = null;
        try {
            setIsAIGeneratingOcclusion(true);
            worker = await createWorker("eng", OEM.LSTM_ONLY, {
                workerPath,
                corePath,
                workerBlobURL: true,
                langPath: "https://tessdata.projectnaptha.com/4.0.0_best"
            });
            await worker.setParameters({tessedit_pageseg_mode: PSM.SPARSE_TEXT});
            const ret = await worker.recognize(imgEl.src, {}, {text: true, blocks: true});
            logger.info(ret);
            let counter = 0;
            if (!ret.data.confidence || ret.data.confidence < 40)
                throw new Error("AI failed to recognize the image");
            const paragraphs = (ret.data.blocks ?? []).flatMap((block) => block.paragraphs);
            const avgParagraphTextLength = _.meanBy(
                paragraphs,
                (paragraph) => paragraph.text.trim().length
            );
            for (const paragraph of paragraphs) {
                const width = paragraph.bbox.x1 - paragraph.bbox.x0;
                const height = paragraph.bbox.y1 - paragraph.bbox.y0;
                if (paragraph.confidence < 48) continue;
                if (width < 4 || height < 4) continue;
                if (width * height < 0.025 ** 2 * imgEl.width * imgEl.height) continue;
                if (paragraph.text.trim().length < Math.min(avgParagraphTextLength / 2, 3))
                    continue;
                function doRectsCollide(a, b) {
                    return !(
                        a.top + a.height < b.top ||
                        a.top > b.top + b.height ||
                        a.left + a.width < b.left ||
                        a.left > b.left + b.width
                    );
                }
                let intersects = false;
                for (const obj of fabricRef.current.getObjects()) {
                    const matrix = obj.calcTransformMatrix();
                    if (
                        doRectsCollide(
                            {top: paragraph.bbox.y0, left: paragraph.bbox.x0, width, height},
                            {
                                top: matrix[5] - (obj.height * obj.scaleY) / 2,
                                left: matrix[4] - (obj.width * obj.scaleX) / 2,
                                width: obj.width * obj.scaleX,
                                height: obj.height * obj.scaleY
                            }
                        )
                    ) {
                        intersects = true;
                        break;
                    }
                }
                if (intersects) continue;
                fabricRef.current.add(
                    createOcclusionRectEl(
                        fabric,
                        paragraph.bbox.x0 + width / 2,
                        paragraph.bbox.y0 + height / 2,
                        width,
                        height,
                        null,
                        (counter++ % 9) + 1
                    )
                );
                fabricRef.current.renderAll();
            }
            if (counter === 0)
                logseq.Editor.showMsg("All possible occlusions already present.", "warning");
            else {
                logseq.Editor.showMsg(`Generated ${counter} occlusions`, "success");
                saveCanvasState();
            }
        } catch (e) {
            logger.error(e);
            logseq.Editor.showMsg("Failed to generate occlusions", "error");
        } finally {
            try {
                if (worker) await worker.terminate();
            } catch (e) {
                logger.error(e);
            } finally {
                setIsAIGeneratingOcclusion(false);
            }
        }
    };
    return {isAIGeneratingOcclusion, aiGenerateOcclusion};
}
