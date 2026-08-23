import {HighlightStyle, syntaxHighlighting} from "@codemirror/language";
import {EditorView} from "@codemirror/view";
import {tags} from "@lezer/highlight";
import CodeMirror, {type ReactCodeMirrorProps} from "@uiw/react-codemirror";
import type React from "react";

export type LogseqCodeEditorProps = Omit<ReactCodeMirrorProps, "theme">;

export const LogseqCodeEditor: React.FC<LogseqCodeEditorProps> = ({
    className,
    basicSetup,
    ...props
}) => {
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
            theme={logseqCodeEditorTheme}
            className={`h-full [&>.cm-editor]:h-full ${className ?? ""}`}
            basicSetup={resolvedBasicSetup}
        />
    );
};

const logseqCodeEditorTheme = [
    EditorView.theme({
        "&": {
            backgroundColor: "var(--ls-primary-background-color)",
            color: "var(--ls-primary-text-color)",
            fontFamily: "var(--ls-font-family)"
        },
        ".cm-content": {
            caretColor: "var(--ls-primary-text-color)"
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "var(--ls-primary-text-color)"
        },
        "&.cm-focused .cm-selectionBackground, .cm-content ::selection": {
            backgroundColor:
                "color-mix(in srgb, var(--ls-link-text-color, #2563eb) 32%, transparent) !important"
        },
        ".cm-selectionBackground": {
            backgroundColor:
                "color-mix(in srgb, var(--ls-link-text-color, #2563eb) 24%, transparent) !important",
            zIndex: "2"
        },
        ".cm-selectionBackground *": {
            backgroundColor: "transparent !important"
        },
        ".cm-activeLine .cm-selectionBackground": {
            backgroundColor:
                "color-mix(in srgb, var(--ls-link-text-color, #2563eb) 42%, transparent) !important"
        },
        ".cm-selectionMatch": {
            backgroundColor:
                "color-mix(in srgb, var(--ls-link-text-color, #2563eb) 20%, transparent)",
            outline:
                "1px solid color-mix(in srgb, var(--ls-link-text-color, #2563eb) 42%, transparent)"
        },
        ".cm-searchMatch": {
            backgroundColor:
                "color-mix(in srgb, var(--ls-link-text-color, #2563eb) 24%, transparent)",
            outline:
                "1px solid color-mix(in srgb, var(--ls-link-text-color, #2563eb) 46%, transparent)"
        },
        ".cm-searchMatch.cm-searchMatch-selected": {
            backgroundColor:
                "color-mix(in srgb, var(--ls-link-text-color, #2563eb) 38%, transparent)",
            outline:
                "1px solid color-mix(in srgb, var(--ls-link-text-color, #2563eb) 60%, transparent)"
        },
        ".cm-activeLine": {
            backgroundColor: "transparent",
            boxShadow:
                "inset 0 0 0 9999px color-mix(in srgb, var(--ls-secondary-text-color) 8%, transparent)"
        },
        ".cm-activeLine .cm-selectionBackground *": {
            backgroundColor: "transparent !important"
        },
        ".cm-gutters": {
            backgroundColor: "var(--ls-secondary-background-color)",
            borderColor: "var(--ls-border-color)",
            color: "var(--ls-secondary-text-color)"
        },
        ".cm-activeLineGutter": {
            backgroundColor: "var(--ls-tertiary-background-color)",
            color: "var(--ls-primary-text-color)"
        },
        ".cm-line .tok-heading": {
            borderBottom: "1px solid var(--ls-border-color)",
            color: "var(--ls-title-text-color)",
            fontWeight: "600"
        },
        ".cm-line .tok-meta, .cm-line .tok-propertyName, .cm-line .tok-string, .cm-line .tok-punctuation":
            {
                textDecoration: "none",
                borderBottom: "none"
            }
    }),
    syntaxHighlighting(
        HighlightStyle.define([
            {tag: tags.comment, color: "var(--ls-secondary-text-color)", fontStyle: "italic"},
            {
                tag: tags.heading,
                color: "var(--ls-title-text-color)",
                fontWeight: "600",
                textDecoration: "underline",
                textUnderlineOffset: "0.2em"
            },
            {tag: tags.strong, color: "var(--ls-title-text-color)", fontWeight: "600"},
            {tag: tags.emphasis, color: "var(--ls-primary-text-color)", fontStyle: "italic"},
            {
                tag: [tags.link, tags.url],
                color: "var(--ls-link-text-color)",
                textDecoration: "underline"
            },
            {
                tag: tags.monospace,
                color: "var(--ls-page-inline-code-color)",
                fontStyle: "italic"
            },
            {tag: [tags.string, tags.literal], color: "var(--ls-tag-text-color)"},
            {
                tag: [tags.keyword, tags.operator, tags.modifier],
                color: "var(--ls-link-ref-text-color)"
            },
            {tag: [tags.number, tags.bool, tags.null], color: "var(--ls-page-inline-code-color)"},
            {tag: [tags.variableName, tags.propertyName], color: "var(--ls-link-ref-text-color)"},
            {tag: [tags.punctuation, tags.separator], color: "var(--ls-secondary-text-color)"}
        ])
    )
];
