import React, {PropsWithChildren} from "react";
import ReactDOM from "react-dom";

// This function is used to mount a React component as a modal in Logseq.
export async function Modal(Contents: React.FC<any>) : Promise<true | null> {
    return new Promise<true | null>(async (resolve, reject) => {
        try {
                const uid = `logseq-anki-sync-modal-${Date.now()}`;
                const root = window.parent.document.querySelector("#root main");
                const div = window.parent.document.createElement("div");
                div.innerHTML = `
                <div class="ui__modal settings-modal cp__settings-main ${uid}" style="z-index: 9999;margin-left: 50px; margin-right: 50px;">
                <div class="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
                   <div class="absolute inset-0 opacity-75"></div>
                </div>
                <div class="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
                   <div class="absolute top-0 right-0 pt-2 pr-2">
                      <a aria-label="Close" type="button" class="ui__modal-close opacity-60 hover:opacity-100" onclick="window.LogseqAnkiSync.dispatchEvent('close${uid}')">
                         <svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6">
                            <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                         </svg>
                      </a>
                   </div>
                   <div class="panel-content">
                   </div>
                </div>
             </div>
            `;
            root?.appendChild(div);
            let handleModalClose = () => {
                window.parent.LogseqAnkiSync.dispatchEvent(`close${uid}`);
            }
            window.addEventListener(`close${uid}`, () => {
                ReactDOM.unmountComponentAtNode(window.parent.document.querySelector(`div.${uid} .panel-content`) as HTMLElement);
                div.innerHTML = '';
            });
            const panelContent = window.parent.document.querySelector(`div.${uid} .panel-content`) as HTMLElement;
            ReactDOM.render(<Contents uid={uid} />, panelContent);
            return true;
        } catch (e) {
            console.log("%cError mounting UIModal", "background: #222; color: #bada55", e);
            return null;
        }
    });
}