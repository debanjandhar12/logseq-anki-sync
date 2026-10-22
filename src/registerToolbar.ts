import "@logseq/libs";
import type {LSPluginBaseInfo} from "@logseq/libs/dist/LSPlugin";
import AI_ICON from "../node_modules/@tabler/icons/icons/outline/robot-face.svg?raw";
import {createLogger, LoggerCategory} from "./logger";
import {WindowParentBridge} from "./logseq/WindowParentBridge";
import {showToolbarMenu} from "./ui/pages/LogseqAstroBoxToolbarMenu";

const logger = createLogger(LoggerCategory.OTHER_UI);

export function registerToolbar(baseInfo: LSPluginBaseInfo) {
    logseq.provideModel({
        showToolbarMenu: () => {
            let triggerRect: DOMRect | null = null;
            let parentWidth: number | undefined;
            try {
                const iconElement = WindowParentBridge.querySelector(
                    `.logseq-astro-box-item-${baseInfo.id}`
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
        .logseq-astro-box-item-${baseInfo.id} {
            display: flex;
            align-items: center;
            position: relative;
            top: 0px;
            opacity: 0.8;
            cursor: pointer;
        }
        .logseq-astro-box-item-${baseInfo.id}:hover {
            opacity: 1;
        }
    `);

    logseq.App.registerUIItem("toolbar", {
        key: `logseq-astro-box-${baseInfo.id}`,
        template: `
      <a title="Logseq AstroBox Menubar" style="padding: 0px 4px;" data-on-click="showToolbarMenu" class="button logseq-astro-box-item-${baseInfo.id}">
        <i class="ui__icon ti" style="font-size: 20px;">${AI_ICON}</i>
      </a>
    `
    });
}
