import {createLogger, LoggerCategory} from "../../logger";
import {LogseqProxy} from "../../logseq/LogseqProxy";

const logger = createLogger(LoggerCategory.Others);

interface ActionButton {
    name: string;
    func: Function;
}

export async function ActionNotification(
    btns: ActionButton[],
    msg: string,
    timeout?: number,
    icon?: string
): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        const uniqueNotificationId =
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);

        const uiKey = `action-notification-${uniqueNotificationId}`;

        try {
            // Register model for button handlers
            const buttonHandlers: Record<string, () => void> = {};
            btns.forEach((btn, index) => {
                const handlerKey = `handleAction${index}`;
                buttonHandlers[handlerKey] = () => {
                    try {
                        btn.func();
                        resolve(String(index));
                    } catch (e) {
                        logger.error("Error executing button action", e);
                    } finally {
                        closeNotification();
                    }
                };
            });

            buttonHandlers["handleClose"] = () => {
                resolve(null);
                closeNotification();
            };

            logseq.provideModel(buttonHandlers);

            // Generate button HTML
            const buttonsHtml = btns
                .map(
                    (btn, index) => `
                <button 
                    class="ui__button inline-flex items-center justify-center whitespace-nowrap text-xs gap-1 font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none bg-primary/90 hover:bg-primary/100 active:opacity-90 text-primary-foreground hover:text-primary-foreground as-classic h-6 rounded px-2 py-0.5 shadow-none focus:shadow-none"
                    data-on-click="handleAction${index}"
                    style="margin-top: 0.2em;"
                >
                    ${btn.name}
                </button>
            `
                )
                .join("");

            // Provide UI
            logseq.provideUI({
                key: uiKey,
                path: "div.notifications",
                template: `
                    <div class="ui__notifications-content enter-done">
                        <div class="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto notification-area transition ease-out duration-300 transform translate-y-0 opacity-100 sm:translate-x-0">
                            <div class="rounded-lg shadow-xs" style="max-height: calc(100vh - 200px); overflow: hidden auto;">
                                <div class="p-4">
                                    <div class="flex items-start">
                                        <div class="flex-shrink-0">
                                            ${icon || ""}
                                        </div>
                                        <div class="ml-3 w-0 flex-1">
                                            <div class="text-sm leading-5 font-medium" style="margin: 0px;">
                                                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                                    <span style="align-self: flex-start; margin-bottom: 0.2em;" class="whitespace-pre-line">${msg}</span>
                                                    ${buttonsHtml}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="ml-4 flex-shrink-0 flex">
                                            <button
                                                aria-label="Close"
                                                class="inline-flex text-gray-400 focus:outline-none focus:text-gray-500 transition ease-in-out duration-150 notification-close-button"
                                                data-on-click="handleClose"
                                            >
                                                <span class="ui__icon ti ls-icon-x">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        class="icon icon-tabler icon-tabler-x"
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        strokeWidth="2"
                                                        stroke="currentColor"
                                                        fill="currentColor"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            });

            // Handle timeout
            if (timeout && timeout > 0) {
                setTimeout(() => {
                    resolve(null);
                    closeNotification();
                }, timeout);
            }

            // Register cleanup on plugin unload
            const closeNotification = () => {
                logseq.provideUI({
                    key: uiKey,
                    template: ``
                });
            };

            LogseqProxy.App.registerPluginUnloadListener(closeNotification);
        } catch (e) {
            logger.error("Failed to show action notification", e);
            await logseq.UI.showMsg(msg, "success");
            reject(e);
        }
    });
}
