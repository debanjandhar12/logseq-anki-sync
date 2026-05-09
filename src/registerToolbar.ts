import "@logseq/libs";
import type {LSPluginBaseInfo} from "@logseq/libs/dist/LSPlugin";
import {ANKI_ICON} from "./constants";
import {createLogger, LoggerCategory} from "./logger";
import {WindowParentBridge} from "./logseq/WindowParentBridge";
import {showToolbarMenu} from "./ui/pages/LogseqAnkiSyncToolbarMenu";

const logger = createLogger(LoggerCategory.UI);

export function registerToolbar(baseInfo: LSPluginBaseInfo) {
    logseq.provideModel({
        showToolbarMenu: () => {
            let triggerRect: DOMRect | null = null;
            let parentWidth: number | undefined;
            try {
                const iconElement = WindowParentBridge.querySelector(
                    `.logseq-anki-toolbar-item-${baseInfo.id}`
                );
                if (iconElement) {
                    triggerRect = iconElement.getBoundingClientRect();
                    parentWidth = WindowParentBridge.getDocument().documentElement.clientWidth;
                }
            } catch (error) {
                logger.warn("Could not access parent document for toolbar icon position:", error);
            }
            showToolbarMenu(triggerRect, parentWidth);
        }
    });

    logseq.provideStyle(`
        .logseq-anki-toolbar-item-${baseInfo.id} {
            display: flex;
            align-items: center;
            position: relative;
            top: 0px;
            opacity: 0.8;
            cursor: pointer;
        }
        .logseq-anki-toolbar-item-${baseInfo.id}:hover {
            opacity: 1;
        }
    `);

    logseq.App.registerUIItem("toolbar", {
        key: `logseq-anki-sync${baseInfo.id === "logseq-anki-sync" ? "" : "-" + baseInfo.id}`,
        template: String.raw`
      <a title="Logseq to Anki Sync Options" data-on-click="showToolbarMenu" class="button logseq-anki-toolbar-item-${baseInfo.id}">
        <i class="ui__icon ti" style="font-size: 18px;">${ANKI_ICON}</i>
      </a>
    `
    });
}
