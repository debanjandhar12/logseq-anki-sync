import CodeMirror, {type ReactCodeMirrorProps} from "@uiw/react-codemirror";
import {dark, light} from "codemirror-themes-for-shadcn";
import React from "react";

type LogseqThemeMode = "light" | "dark";

export type LogseqCodeEditorProps = Omit<ReactCodeMirrorProps, "theme">;

export const LogseqCodeEditor: React.FC<LogseqCodeEditorProps> = ({
    className,
    basicSetup,
    ...props
}) => {
    const themeMode = useLogseqThemeMode();
    const resolvedBasicSetup =
        basicSetup === false
            ? false
            : {
                  foldGutter: true,
                  lineNumbers: true,
                  ...(basicSetup === true || basicSetup == null ? {} : basicSetup)
              };

    return (
        <CodeMirror
            {...props}
            theme={themeMode === "dark" ? dark : light}
            className={`h-full [&>.cm-editor]:h-full ${className ?? ""}`}
            basicSetup={resolvedBasicSetup}
        />
    );
};

function useLogseqThemeMode(): LogseqThemeMode {
    const [themeMode, setThemeMode] = React.useState<LogseqThemeMode>("light");

    React.useEffect(() => {
        let isMounted = true;

        logseq.App.getUserConfigs().then((configs) => {
            if (!isMounted) return;
            setThemeMode(configs.preferredThemeMode);
        });

        const unsubscribe = logseq.App.onThemeModeChanged(({mode}) => {
            setThemeMode(mode);
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    return themeMode;
}
