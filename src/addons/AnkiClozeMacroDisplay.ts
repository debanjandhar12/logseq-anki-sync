import { createHook } from "async_hooks";
import { Addon } from "./Addon";

export class AnkiClozeMacroDisplay extends Addon {
    static _instance: AnkiClozeMacroDisplay;
    static observer;
    static hooks = [];

    public getName(): string {
        return "Anki Cloze Macro Display";
    }

    public init(): void {
        if (!this.isEnabled()) return;
        // Set up observer for Anki Cloze Macro Syntax
        let displayAnkiCloze = (elem : Element) => {
            let clozes : Element | NodeListOf<Element> = elem.querySelector(
                'span[title^="Unsupported macro name: c"]'
            );
            if (!clozes) return;
            clozes = elem.querySelectorAll(
                'span[title^="Unsupported macro name: c"]'
            );
            clozes.forEach((cloze) => {
                if (/c\d$/.test((cloze as Element & {title}).title))
                    cloze.outerHTML = `<span style="background-color:rgb(59 130 246 / 0.1);">${cloze.innerHTML.replace(/^{{{c\d (.*?)(::.*)?}}}$/,"$1")}</span>`;
            });
        };
        AnkiClozeMacroDisplay.observer = new MutationObserver((mutations) => {
            if(mutations.length <= 8) {
                for(let mutation of mutations) {
                    const addedNode = mutation.addedNodes[0];
                    if (addedNode && addedNode.childNodes.length) {
                        displayAnkiCloze(addedNode as Element);
                    }
                }
            }
            else displayAnkiCloze(window.parent.document.body as Element);
        });
        AnkiClozeMacroDisplay.observer.observe(window.parent.document, {
            subtree: true,
            childList: true
        });
    }

    public remove(): void {
        if (this.isEnabled()) return;
        AnkiClozeMacroDisplay.observer.disconnect();
        while(AnkiClozeMacroDisplay.hooks.length > 0) {
            (AnkiClozeMacroDisplay.hooks.pop())();
        }
    }

    public static getInstance(): Addon {
        if (!AnkiClozeMacroDisplay._instance) 
        AnkiClozeMacroDisplay._instance = new AnkiClozeMacroDisplay();
        return AnkiClozeMacroDisplay._instance;
    }
}