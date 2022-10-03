export class ProgressNotification {
    max: number;
    current: number;
    progressBar: HTMLElement;

    constructor(msg: string, max: number) {
        this.max = max;
        this.current = 0;
        logseq.provideUI({
            key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`,
            path: "div.notifications",
            template: `
            <div class="ui__notifications-content enter-done" style=""><div class="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto notification-area transition ease-out duration-300 transform translate-y-0 opacity-100 sm:translate-x-0"><div class="rounded-lg shadow-xs" style="max-height: calc(100vh - 200px); overflow: hidden scroll;"><div class="p-4"><div class="flex items-start"><div class="flex-shrink-0"><svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6 text-green-400"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path></svg></div><div class="ml-3 w-0 flex-1">
            <div class="text-sm leading-5 font-medium whitespace-pre-line text-gray-900 dark:text-gray-300 " style="margin: 0px;">${msg}:
            <progress id="logseq-anki-sync-progress-bar-${logseq.baseInfo.id}" value="${this.current}" max="${this.max}" />
            </div>
            </div><div class="ml-4 flex-shrink-0 flex">
            </div></div></div></div></div></div>
            `
        });
    }

    increment() {
        this.current++;
        try {
            if (this.progressBar == null) {
                this.progressBar = window.parent.document.getElementById(`logseq-anki-sync-progress-bar-${logseq.baseInfo.id}`);
            }
            this.progressBar.setAttribute("value", `${this.current}`);
        } catch (e) {
        }
        if (this.current >= this.max)
            logseq.provideUI({key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`, template: ``});  // Remove notification
    }
}