import {Modal} from "./Modal";
import React from "react";
import {LogseqButton} from "./basic/LogseqButton";
import ReactDOM from "react-dom";

export async function SelectionModal(arr: {name : string, icon? : string}[], msg? : string, enableKeySelect? : boolean): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        try {
            const main = window.parent.document.querySelector("#root main");
            const div = window.parent.document.createElement("div");
            main?.appendChild(div);
            let onClose = () => {
                ReactDOM.unmountComponentAtNode(div);
                div.remove();
            }
            onClose = onClose.bind(this);
            ReactDOM.render(<ModelContent arr={arr} msg={msg} resolve={resolve} reject={reject} enableKeySelect={enableKeySelect} onClose={onClose}/>, div);
        } catch (e) {
            logseq.App.showMsg("Error", "Failed to open modal");
            console.log(e)
            reject(e);
        }
    });
}

const ModelContent: React.FC<{ arr: {name : string, icon? : string}[], msg?:string, onClose : Function, resolve : Function, reject : Function, enableKeySelect? : boolean}> = ({arr, msg, onClose, resolve, reject, enableKeySelect}) => {
    const [open, setOpen] = React.useState(true);
    const handleSelection = React.useCallback((selection: number | null) => {
        resolve(selection);
        setOpen(false);
    }, [resolve]);

    React.useEffect(() => {
        if(enableKeySelect) {
            arr = arr.map((obj, i) => {
                if (i+1 >= 1 && i+1 <= 9)
                    obj.name = `${obj.name}<span class="keyboard-shortcut px-4"><code>${i+1}</code></span>`;
                return obj;
            });
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

        window.parent.document.addEventListener("keydown", onKeydown);

        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, []);

    React.useEffect(() => {
        if (!open) {
            resolve(null);
        }
    }, [open]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose}>
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
        </Modal>
    );
};