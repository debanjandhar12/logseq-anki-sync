import ReactDOM from "react-dom";
import React from "react";
import {Modal} from "./Modal";
import {LogseqButton} from "../basic/LogseqButton";

export async function showModelWithButtons(
    msg: string,
    btns: {name: string; f: Function; returnOnClick?: boolean}[],
): Promise<number | false> {
    return new Promise<number | false>(async (resolve, reject) => {
        try {
            const main = window.parent.document.querySelector("#root main");
            const div = window.parent.document.createElement("div");
            main?.appendChild(div);
            let onClose = () => {
                try {
                    ReactDOM.unmountComponentAtNode(div);
                    div.remove();
                } catch (e) {}
            };
            onClose = onClose.bind(this);
            ReactDOM.render(
                <ModelComponent
                    msg={msg}
                    btns={btns}
                    resolve={resolve}
                    reject={reject}
                    onClose={onClose}
                />,
                div,
            );
        } catch (e) {
            logseq.App.showMsg("Error", "Failed to open modal");
            console.log(e);
            reject(e);
        }
    });
}

const ModelComponent: React.FC<{
    msg: string;
    btns: {name: string; f: Function; returnOnClick?: boolean}[];
    resolve: Function;
    reject: Function;
    onClose: () => void;
}> = ({msg, btns, resolve, reject, onClose}) => {
    const [open, setOpen] = React.useState(true);
    const returnResult = React.useCallback(
        (result: number | false) => {
            resolve(result);
            setOpen(false);
        },
        [resolve],
    );

    const onKeydown = React.useCallback(
        (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === "Escape") {
                returnResult(false);
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.key === "Enter") {
                returnResult(1);
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        },
        [returnResult],
    );

    React.useEffect(() => {
        if (open) window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open]);

    React.useEffect(() => {
        if (!open) {
            returnResult(false);
        }
    }, [open]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} zDepth={"high"}>
            <div className="ui__confirm-modal is-">
                <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h2
                            className="headline text-lg leading-6 font-medium"
                            dangerouslySetInnerHTML={{__html: msg}}
                        />
                        <label className="sublabel">
                            <h3 className="subline text-gray-400"></h3>
                        </label>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    {btns.map((btn, i) => {
                        return (
                            <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                                <LogseqButton
                                    key={i}
                                    isFullWidth={true}
                                    color="primary"
                                    onClick={() => {
                                        btn.f();
                                        if (
                                            btn.returnOnClick == null ||
                                            btn.returnOnClick == true
                                        )
                                            returnResult(i);
                                    }}>
                                    {btn.name}
                                </LogseqButton>
                            </span>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
};
