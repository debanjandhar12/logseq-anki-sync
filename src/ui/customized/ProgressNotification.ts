import {ANKI_ICON, GRAPH_ICON} from "../../constants";

export class ProgressNotification {
    max: number;
    current: number;
    progressBar: HTMLElement;

    constructor(msg: string, max: number, icon: "anki" | "graph" = "graph") {
        this.max = max;
        this.current = 0;
        logseq.provideUI({
            key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`,
            path: "div.notifications",
            template: `
            <div class="ui__notifications-content enter-done" style=""><div class="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto notification-area transition ease-out duration-300 transform translate-y-0 opacity-100 sm:translate-x-0"><div class="rounded-lg shadow-xs" style="max-height: calc(100vh - 200px); overflow: hidden scroll;"><div class="p-4"><div class="flex items-start"><div class="flex-shrink-0">${
                icon == "anki" ? ANKI_ICON : GRAPH_ICON
            }</div><div class="ml-3 w-0 flex-1">
            <div class="text-sm leading-5 font-medium whitespace-pre-line " style="margin: 0px;">${msg}
            <progress id="logseq-anki-sync-progress-bar-${logseq.baseInfo.id}" value="${
                this.current
            }" max="${this.max}" style="width: 62%;" />
            </div>
            </div><div class="ml-4 flex-shrink-0 flex">
            </div></div></div></div></div></div>
            `,
        });
        logseq.provideStyle(`
        #logseq-anki-sync-progress-bar-${logseq.baseInfo.id}::-webkit-progress-bar {
          border-radius: 7px; 
        }
        #logseq-anki-sync-progress-bar-${logseq.baseInfo.id}::-webkit-progress-value {
          border-radius: 7px; 
          background-color: var(--ls-link-text-color,#045591);
        }
        `);
    }

    increment(amount = 1) {
        this.current += amount;
        try {
            if (this.progressBar == null) {
                this.progressBar = window.parent.document.getElementById(
                    `logseq-anki-sync-progress-bar-${logseq.baseInfo.id}`,
                );
            }
            this.progressBar.setAttribute("value", `${this.current}`);
        } catch (e) {}
        if (this.current >= this.max)
            logseq.provideUI({
                key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`,
                template: ``,
            }); // Remove notification
    }
}
