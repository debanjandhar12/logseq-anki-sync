import {Modal} from "./Modal";
import React from "react";
import {LogseqButton} from "../basic/LogseqButton";
import ReactDOM from "react-dom";
import {waitForElement} from "../../utils/waitForElement";
import {Notification} from "./Notification";

export async function ActionNotification(
    btns: {name: string; func: Function}[],
    msg: string,
    timeout?: number,
    icon?: string,
): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        const uniqueNotificationId =
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
        try {
            await logseq.UI.showMsg(uniqueNotificationId, "success", {
                timeout: 0,
                key: uniqueNotificationId,
            });
            let main = await waitForElement(
                `//div[text()='${uniqueNotificationId}']`,
                360 * 1000,
                window.parent.document,
            );
            if (!main) throw new Error("Failed to find notification");
            main = main.closest(".notifications > .ui__notifications-content");
            main.innerHTML = "";
            let onClose = () => {
                ReactDOM.unmountComponentAtNode(main);
                // main.remove();
                logseq.UI.closeMsg(uniqueNotificationId);
            };
            onClose = onClose.bind(this);
            ReactDOM.render(
                <ActionNotificationComponent
                    btns={btns}
                    msg={msg}
                    resolve={resolve}
                    reject={reject}
                    icon={icon}
                    onClose={onClose}
                    timeout={timeout}
                />,
                main as HTMLElement,
            );
        } catch (e) {
            logseq.UI.closeMsg(uniqueNotificationId);
            await logseq.UI.showMsg(msg, "success");
            console.log(e);
            reject(e);
        }
    });
}

const ActionNotificationComponent: React.FC<{
    btns: {name: string; func: Function}[];
    msg?: string;
    onClose: () => void;
    resolve: Function;
    reject: Function;
    icon?: string;
    timeout?: number;
}> = ({btns, msg, onClose, resolve, reject, icon, timeout}) => {
    const [open, setOpen] = React.useState(true);
    let [buttons, setButtons] = React.useState(btns);
    const handleAction = React.useCallback(
        (selection: number | null) => {
            buttons[selection].func();
            resolve(selection);
            setOpen(false);
        },
        [resolve, buttons],
    );

    React.useEffect(() => {
        if (!open) {
            resolve(null);
        }
    }, [open]);

    React.useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        if (timeout && timeout > 0) {
            timeoutId = setTimeout(() => {
                setOpen(false);
            }, timeout);
        }
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [timeout]);

    return (
        <Notification
            open={open}
            setOpen={setOpen}
            onClose={onClose}
            hasCloseBtn={true}
            icon={icon}>
            <div style={{display: "flex", flexDirection: "column", alignItems: "flex-end"}}>
                <span style={{alignSelf: "flex-start", marginBottom: "0.2em"}}>{msg}</span>
                {buttons.map((btn, index) => (
                    <LogseqButton
                        key={index}
                        onClick={() => handleAction(index)}
                        color="primary"
                        depth={2}
                        size="sm">
                        {btn.name}
                    </LogseqButton>
                ))}
            </div>
        </Notification>
    );
};
