import {Modal} from "./Modal";
import React from "react";
import {LogseqButton} from "./basic/LogseqButton";
import ReactDOM from "react-dom";

export async function SelectionPrompt(arr: {name : string, icon? : string}[], msg? : string, enableKeySelect? : boolean): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        const modal = await Modal(({uid}) => {
            let handleSelection = (selection: number | null) => {
                   resolve(selection);
                   window.parent.LogseqAnkiSync.dispatchEvent(`close${uid}`);
            }
            const onKeydown = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    handleSelection(null);
                }
                else if (e.key >= "1" && e.key <= "9" && enableKeySelect) {
                    if (parseInt(e.key) <= arr.length) {
                        handleSelection(parseInt(e.key) - 1);
                    }
                }
            };
            if(enableKeySelect) {
                arr = arr.map((obj, i) => {
                    if (i+1 >= 1 && i+1 <= 9)
                        obj.name = `${obj.name}<span class="keyboard-shortcut px-4"><code>${i+1}</code></span>`;
                    return obj;
                });
            }
            window.parent.document.addEventListener("keydown", onKeydown);
            window.addEventListener(`close${uid}`, () => {
                window.parent.document.removeEventListener("keydown", onKeydown);
                resolve(null);
            });
            handleSelection = handleSelection.bind(this);
            return <ModelContent
                arr={arr}
                msg={msg}
                handleSelection={handleSelection}
            />;
        });

        if (!modal) {
            logseq.App.showMsg("Failed to open modal");
            reject();
        }
    });
}

const ModelContent: React.FC<{ arr: {name : string, icon? : string}[], msg?:string, handleSelection: (selection: number | null) => void }> = ({arr, msg, handleSelection}) => {
    return (
        <>
            {msg && <h1 className="mb-4 text-2xl p-1">{msg}</h1>}
            {arr.map((obj, index) => (
                <LogseqButton
                    key={index}
                    onClick={() => handleSelection(index)}
                    color='indigo'
                    isCentered={obj.icon == null}
                    isFullWidth={true}
                    icon={obj.icon}
                >
                    <span dangerouslySetInnerHTML={{__html: obj.name}}/>
                </LogseqButton>
            ))}
        </>
    );
};