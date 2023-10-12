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
            ReactDOM.render(<ModelComponent arr={arr} msg={msg} resolve={resolve} reject={reject} enableKeySelect={enableKeySelect} onClose={onClose}/>, div);
        } catch (e) {
            logseq.App.showMsg("Error", "Failed to open modal");
            console.log(e)
            reject(e);
        }
    });
}

const ModelComponent: React.FC<{ arr: {name : string, icon? : string}[], msg?:string, onClose : Function, resolve : Function, reject : Function, enableKeySelect? : boolean}> = ({arr, msg, onClose, resolve, reject, enableKeySelect}) => {
    const [open, setOpen] = React.useState(true);
    let [items, setItems] = React.useState(arr);
    const handleSelection = React.useCallback((selection: number | null) => {
        resolve(selection);
        setOpen(false);
    }, [resolve]);

    React.useEffect(() => {
        if(enableKeySelect) {
            setItems(() => items.map((item, i) => {
                if (i+1 >= 1 && i+1 <= 9)
                    item.name = `${item.name}<span class="keyboard-shortcut px-3"><code>${i+1}</code></span>`;
                console.log(item.name);
                return item;
            }));
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
    }, [arr, enableKeySelect, onClose]);

    React.useEffect(() => {
        if (!open) {
            resolve(null);
        }
    }, [open]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose}>
            {msg && <h1 className="mb-4 text-2xl p-1">{msg}</h1>}
            {items.map((item, index) => (
                <LogseqButton
                    key={index}
                    onClick={() => handleSelection(index)}
                    color='primary'
                    isCentered={item.icon == null}
                    isFullWidth={true}
                    icon={item.icon}
                >
                    <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} dangerouslySetInnerHTML={{__html: item.name}} />
                </LogseqButton>
            ))}
        </Modal>
    );
};