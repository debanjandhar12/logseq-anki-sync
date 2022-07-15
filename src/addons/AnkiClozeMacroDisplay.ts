import { createHook } from "async_hooks";
import { Addon } from "./Addon";

export class AnkiClozeMacroDisplay extends Addon {
    static _instance: AnkiClozeMacroDisplay;
    static observer;
    static lastObserved;
    static timeOutFunc;
    static hooks = [];

    public getName(): string {
        return "Anki Cloze Macro Display";
    }

    public init(): void {
        if (!this.isEnabled()) return;
        // Set up observer for Anki Cloze Macro Syntax
        const watchTarget = window.parent.document.getElementById("app-container");
        AnkiClozeMacroDisplay.timeOutFunc = null;
        AnkiClozeMacroDisplay.lastObserved = Date.now() - 1000;
        let displayAnkiCloze = () => {
            // console.log("Display");
            if (!this.isEnabled())  return;
            let clozes = window.parent.document.querySelectorAll(
                'span[title^="Unsupported macro name: c"]'
            );
            clozes.forEach((cloze) => {
                if (/c\d$/.test((cloze as Element & {title}).title))
                    cloze.outerHTML = `<span style="background-color:rgb(59 130 246 / 0.1);">${cloze.innerHTML.replace(/^{{{c\d (.*)}}}$/,"$1")}</span>`;
            });
            AnkiClozeMacroDisplay.lastObserved = Date.now();
        }
        AnkiClozeMacroDisplay.observer = new MutationObserver((mutations) => {
            if(Date.now() - AnkiClozeMacroDisplay.lastObserved < 1000 && mutations.length < 50) {
                clearTimeout(AnkiClozeMacroDisplay.timeOutFunc);
                AnkiClozeMacroDisplay.timeOutFunc = setTimeout(displayAnkiCloze, 1000 - (Date.now() - AnkiClozeMacroDisplay.lastObserved));
                return;
            }
            displayAnkiCloze();
            clearTimeout(AnkiClozeMacroDisplay.timeOutFunc);
        });
        AnkiClozeMacroDisplay.hooks.push(logseq.App.onCurrentGraphChanged(() => { displayAnkiCloze(); }));
        AnkiClozeMacroDisplay.hooks.push(logseq.Editor.onBlockChanged(() => { displayAnkiCloze(); }));
        AnkiClozeMacroDisplay.hooks.push(logseq.Editor.onSidebarVisibleChanged(() => { displayAnkiCloze(); }));
        AnkiClozeMacroDisplay.observer.observe(watchTarget, {
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