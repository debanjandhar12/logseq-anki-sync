import {Modal} from "./Modal";
import React from "react";
import {LogseqButton} from "./basic/LogseqButton";
import ReactDOM from "react-dom";
import {waitForElement} from "../utils/waitForElement";
import {Notification} from "./Notification";

export async function ActionNotification(btns: {name : string, func: Function}[], msg : string, icon? : string): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        const uniqueNotificationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        try {
            await logseq.UI.showMsg(uniqueNotificationId, 'success', {timeout: 0, key: uniqueNotificationId});
            let main = await waitForElement(`//div[text()='${uniqueNotificationId}']`, 360*1000, window.parent.document);
            if (!main) throw new Error("Failed to find notification");
            main = main.closest(".notifications > .ui__notifications-content");
            main.innerHTML = "";
            const div = window.parent.document.createElement("div");
            main?.appendChild(div);
            let onClose = () => {
                ReactDOM.unmountComponentAtNode(div);
                div.remove();
            }
            onClose = onClose.bind(this);
            ReactDOM.render(<ActionNotificationComponent btns={btns} msg={msg} resolve={resolve} reject={reject} icon={icon} onClose={onClose}/>, div);
        } catch (e) {
            await logseq.UI.closeMsg(uniqueNotificationId);
            await logseq.UI.showMsg(msg, 'success');
            console.log(e)
            reject(e);
        }
    });
}

const ActionNotificationComponent: React.FC<{ btns: {name : string, func: Function}[], msg?:string, onClose : Function, resolve : Function, reject : Function, icon? : string}> = ({btns, msg, onClose, resolve, reject, icon}) => {
    const [open, setOpen] = React.useState(true);
    let [buttons, setButtons] = React.useState(btns);
    const handleAction = React.useCallback((selection: number | null) => {
        buttons[selection].func();
        resolve(selection);
        setOpen(false);
    }, [resolve]);

    React.useEffect(() => {
        if (!open) {
            resolve(null);
        }
    }, [open]);

    return (
        <Notification open={open} setOpen={setOpen} onClose={onClose} hasCloseBtn={true} icon={icon}>
            {msg}
            {buttons.map((btn, index) => (
                <LogseqButton
                    key={index}
                    onClick={() => handleAction(index)}
                    color='indigo'
                >
                    {btn.name}
                </LogseqButton>
            ))}
        </Notification>
    );
};