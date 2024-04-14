import ReactDOM from "react-dom";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import React, {useEffect, useState} from "react";
import {Modal} from "../general/Modal";
import _ from "lodash";
import {getFirstNonEmptyLine} from "../../utils/utils";
import getUUIDFromBlock from "../../logseq/getUUIDFromBlock";
import {LogseqButton} from "../basic/LogseqButton";
import {BlockContentParser} from "../../logseq/BlockContentParser";

export async function LogseqAnkiFeatureExplorer(editingBlockUUID) {
    return new Promise(async function (resolve, reject) {
        try {
            const main = window.parent.document.querySelector("#root main");
            const div = window.parent.document.createElement("div");
            div.className = "logseq-anki-feature-explorer";
            main?.appendChild(div);
            let onClose = () => {
                try {
                    ReactDOM.unmountComponentAtNode(div);
                    div.remove();
                } catch (e) {}
            };
            onClose = onClose.bind(this);
            ReactDOM.render(
                <LogseqAnkiFeatureExplorerComponent
                    editingBlockUUID={editingBlockUUID}
                    onClose={onClose}
                />,
                div,
            );
            LogseqProxy.App.registerPluginUnloadListener(onClose);
        } catch (e) {
            logseq.UI.showMsg("Error", "Failed to open modal");
            console.log(e);
            reject(e);
        }
    });
}

const LogseqAnkiFeatureExplorerComponent: React.FC<{
    editingBlockUUID: string;
    onClose: () => void;
}> = ({editingBlockUUID, onClose}) => {
    const [open, setOpen] = useState(true);
    const [blockContent, setBlockContent] = useState("");
    const [pageTree, setPageTree] = useState([]);
    useEffect(() => {
        (async function () {
            const block = await logseq.Editor.getBlock(editingBlockUUID);
            setBlockContent(block.content);
        })();
    }, []);

    useEffect(() => {
        (async function () {
            const block = await logseq.Editor.getBlock(editingBlockUUID);
            const page = await logseq.Editor.getPage(block.page.id);
            const pageTree = await logseq.Editor.getPageBlocksTree(page.name);
            setPageTree(pageTree);
        })();
    }, [blockContent]);

    const [parentBlocksWithAnkiTags, setParentBlocksWithAnkiTags] = useState([]);
    useEffect(() => {
        (async function () {
            const block = await logseq.Editor.getBlock(editingBlockUUID);
            let parentBlock = await logseq.Editor.getBlock(block.parent.id);
            let parentBlockWithAnkiTags = [];
            while (parentBlock) {
                if (parentBlock.properties["tags"] || parentBlock.properties["deck"]) {
                    parentBlockWithAnkiTags.push(parentBlock);
                }
                parentBlock = await logseq.Editor.getBlock(parentBlock.parent.id);
            }
            setParentBlocksWithAnkiTags(parentBlockWithAnkiTags);
        })();
    }, [pageTree]);

    // Other useful info for rendering feature list
    const [isEditingBlockMultiline, setIsEditingBlockMultiline] = useState(false);
    useEffect(() => {
        (async function () {
            if (blockContent == "") return;
            const tags = await BlockContentParser.find(blockContent, "Markdown", ["tag"]);
            if (tags.map((tag) => tag.content).includes("#card") || tags.map((tag) => tag.content).includes("#flashcard")) {
                setIsEditingBlockMultiline(true);
            } else {
                const block = await logseq.Editor.getBlock(editingBlockUUID);
                const parentBlock = await logseq.Editor.getBlock(block.parent.id);
                if (!parentBlock) {
                    setIsEditingBlockMultiline(false);
                    return;
                }
                const tags = await BlockContentParser.find(parentBlock.content, "Markdown", [
                    "tag",
                ]);
                if (tags.map((tag) => tag.content).includes("#card-group")) {
                    setIsEditingBlockMultiline(true);
                } else {
                    setIsEditingBlockMultiline(false);
                }
            }
        })();
    }, [blockContent]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} hasCloseButton={false}>
            <div className="settings-modal of-plugins pb-2">
                <div className="absolute top-0 right-0 pt-2 pr-2">
                    <button
                        aria-label="Close"
                        type="button"
                        className="ui__modal-close opacity-60 hover:opacity-100"
                        onClick={() => setOpen(false)}>
                        <svg
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6">
                            <path
                                d="M6 18L18 6M6 6l12 12"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"></path>
                        </svg>
                    </button>
                </div>
                <header
                    style={{
                        borderBottom: "1px solid var(--ls-border-color)",
                        padding: "8px 12px",
                    }}>
                    <h3 className="title inline-flex items-center" style={{marginTop: "2px"}}>
                        <strong>Logseq Anki Feature Explorer (BETA)</strong>
                    </h3>
                </header>
                <div
                    style={{maxHeight: "71vh", padding: '4px', overflowY: "auto", overflowX: "hidden"}}>
                    {pageTree[0] && (
                        <BlockFeatureContainer
                            uuid={getUUIDFromBlock(pageTree[0])}
                            title={"Page Properties Block"}>
                            <FeatureGrid>
                                <PropFeature
                                    blockContent={pageTree[0].content}
                                    setBlockContent={async (content) => {
                                        const page = await logseq.Editor.getPage(
                                            pageTree[0].page.id,
                                        );
                                        const pageTreeNew =
                                            await logseq.Editor.getPageBlocksTree(page.name);
                                        setPageTree(pageTreeNew);
                                    }}
                                    editingBlockUUID={getUUIDFromBlock(pageTree[0])}
                                    propName={"deck"}
                                    helpMsg={
                                        "This property sets the anki deck of all notes from this page."
                                    }
                                />
                                <PropFeature
                                    blockContent={pageTree[0].content}
                                    setBlockContent={async (content) => {
                                        const page = await logseq.Editor.getPage(
                                            pageTree[0].page.id,
                                        );
                                        const pageTreeNew =
                                            await logseq.Editor.getPageBlocksTree(page.name);
                                        setPageTree(pageTreeNew);
                                    }}
                                    editingBlockUUID={getUUIDFromBlock(pageTree[0])}
                                    propName={"tags"}
                                    placeHolderValue={"tag1, [[tag2]], tag3"}
                                    helpMsg={
                                        "This property sets the anki tags of all notes from this page."
                                    }
                                />
                            </FeatureGrid>
                        </BlockFeatureContainer>
                    )}
                    {parentBlocksWithAnkiTags.map((block) => {
                        return (
                            <BlockFeatureContainer
                                uuid={block.uuid}
                                title={"Parent Block: " + getFirstNonEmptyLine(block.content)}
                                key={block.uuid}>
                                <FeatureGrid>
                                    <PropFeature
                                        blockContent={block.content}
                                        setBlockContent={async () => {
                                            const page = await logseq.Editor.getPage(
                                                block.page.id,
                                            );
                                            const pageTreeNew =
                                                await logseq.Editor.getPageBlocksTree(
                                                    page.name,
                                                );
                                            setPageTree(pageTreeNew);
                                        }}
                                        editingBlockUUID={block.uuid}
                                        propName={"deck"}
                                        helpMsg={
                                            "This property sets the anki deck of all children notes. This overrides the page property / other parent block property."
                                        }
                                    />
                                    <PropFeature
                                        blockContent={block.content}
                                        setBlockContent={async () => {
                                            const page = await logseq.Editor.getPage(
                                                block.page.id,
                                            );
                                            const pageTreeNew =
                                                await logseq.Editor.getPageBlocksTree(
                                                    page.name,
                                                );
                                            setPageTree(pageTreeNew);
                                        }}
                                        editingBlockUUID={block.uuid}
                                        propName={"tags"}
                                        placeHolderValue={"tag1, [[tag2]], tag3"}
                                        helpMsg={
                                            "This property sets the anki tags of all children notes."
                                        }
                                    />
                                    <TagFeature
                                        blockContent={block.content}
                                        setBlockContent={async () => {
                                            const page = await logseq.Editor.getPage(
                                                block.page.id,
                                            );
                                            const pageTreeNew =
                                                await logseq.Editor.getPageBlocksTree(
                                                    page.name,
                                                );
                                            setPageTree(pageTreeNew);
                                        }}
                                        editingBlockUUID={block.uuid}
                                        tagName={"hide-when-card-parent"}
                                        helpMsg={
                                            "This tag hides this block in front side of anki card."
                                        }
                                    />
                                </FeatureGrid>
                            </BlockFeatureContainer>
                        );
                    })}
                    {editingBlockUUID == getUUIDFromBlock(pageTree[0]) && (
                        <BlockFeatureContainer uuid={editingBlockUUID} title={"Current Block"}>
                            <span style={{userSelect: "none"}}>
                                ⚠️
                            </span>
                            <span style={{color: "var(--amplify-components-button-warning-color, red)"}}>
                                Not recomended to create anki notes in page properties block.
                            </span>
                        </BlockFeatureContainer>
                    )
                    }
                    {editingBlockUUID != getUUIDFromBlock(pageTree[0]) && (
                        <BlockFeatureContainer uuid={editingBlockUUID} title={"Current Block"}>
                            <h4>All Notes</h4>
                            <FeatureGrid>
                                <PropFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    propName={"deck"}
                                    helpMsg={
                                        "This property sets the anki deck of block notes. If parent block / page property has this defined, it will be overridden."
                                    }
                                />
                                <PropFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    propName={"tags"}
                                    placeHolderValue={"tag1, [[tag2]], tag3"}
                                    helpMsg={
                                        "This property sets the anki tags of block notes. If parent block / page property has this defined, the tag list will be merged."
                                    }
                                />
                                <TagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    tagName={"type-in"}
                                    helpMsg={
                                        "This tag presents a text box in anki, enabling you to input your answer. This works with multiline, cloze and swift notes."
                                    }
                                />
                                <TagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    tagName={"hide-all-test-one"}
                                    helpMsg={
                                        "This tag hides all clozes except the one being tested. This works with multiline and cloze notes."
                                    }
                                />
                                <TagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    tagName={"no-anki-sync"}
                                    helpMsg={
                                        "This tag prevents the block from being synced to anki."
                                    }
                                />
                                {/*Extra*/}
                                <OrgBlockFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    orgBlockDisplayHTML={
                                        "<div><code>#+BEGIN_EXTRA</code></br><code>#+END_EXTRA</code></div>"
                                    }
                                    orgBlockText={"#+BEGIN_EXTRA\n\n#+END_EXTRA"}
                                    helpMsg={
                                        "This tag is used to add extra information to the anki card. This is only shown in back side of anki cards."
                                    }
                                />
                                <OrgBlockFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    orgBlockDisplayHTML={
                                        "<div><code>#+BEGIN_ANKI_ONLY</code></br><code>#+END_ANKI_ONLY</code></div>"
                                    }
                                    orgBlockText={"#+BEGIN_ANKI_ONLY\n\n#+END_ANKI_ONLY"}
                                    helpMsg={
                                        "This contents inside this tag is not shown in logseq preview mode. Only shown in anki."
                                    }
                                />
                            </FeatureGrid>
                            <h4>Multiline Note</h4>
                            <FeatureGrid>
                                <TagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    tagName={"flashcard"}
                                    tagDisplayText="#flashcard / #card"
                                    isEnabledFn={() => {
                                        if (
                                            isEditingBlockMultiline &&
                                            !blockContent.includes("#card") &&
                                            !blockContent.includes("#flashcard")
                                        )
                                            return {
                                                isEnabled: false,
                                                helpMsg:
                                                    "This block already is a multiline card due to #card-group tag in parent block.",
                                            };
                                        return {isEnabled: true};
                                    }}
                                    helpMsg={"This tag marks a block as multiline card."}
                                />
                                <DirectionTagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    isEnabledFn={() => {
                                        if (isEditingBlockMultiline || blockContent.includes("#card-group"))
                                            return {isEnabled: true};
                                        return {
                                            isEnabled: false,
                                            helpMsg:
                                                "This tag only works with multiline card. The current block is not a multiline card.",
                                        };
                                    }}
                                    helpMsg={
                                        blockContent.includes("#card-group") ?
                                        "This dropdown adds tags which sets the direction of the children multiline cards." :
                                        "This dropdown adds tags which sets the direction of the multiline card."
                                    }
                                />
                                <TagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    tagName={"incremental"}
                                    isEnabledFn={() => {
                                        if (isEditingBlockMultiline) return {isEnabled: true};
                                        return {
                                            isEnabled: false,
                                            helpMsg:
                                                "This tag only works with multiline card. The current block is not a multiline card.",
                                        };
                                    }}
                                    helpMsg={
                                        "This tag marks a block as incremental multiline card. In incremental multiline card, each children bullet is displayed a separate card."
                                    }
                                />
                                <DepthTagFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    isEnabledFn={() => {
                                        if (isEditingBlockMultiline) return {isEnabled: true};
                                        return {
                                            isEnabled: false,
                                            helpMsg:
                                                "This tag only works with multiline card. The current block is not a multiline card.",
                                        };
                                    }}
                                    editingBlockUUID={editingBlockUUID}
                                    helpMsg={
                                        "This tag limits the children display depth in anki to specified value."
                                    }
                                />
                                <PropFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    propName={"extra"}
                                    isEnabledFn={() => {
                                        if (isEditingBlockMultiline) return {isEnabled: true};
                                        return {
                                            isEnabled: false,
                                            helpMsg:
                                                "This property only works with multiline card. The current block is not a multiline card.",
                                        };
                                    }}
                                    helpMsg={
                                        "This property is used to add extra information to the anki card. This is only shown in back side of anki cards. Only works for multiline cards."
                                    }
                                />
                            </FeatureGrid>
                            <h4>Cloze Note</h4>
                            <FeatureGrid>
                                <TextFeatureComponent
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    displayText="{{c1 content::hint}} / {{cloze content::hint}}"
                                    text="{{c1 content::hint}}"
                                    helpMsg={
                                        "This syntax is used to create clozed cards in anki."
                                    }
                                />
                                <PropFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    propName={"replacecloze"}
                                    placeHolderValue={`" 'function', /x^2|x^3/i "`}
                                    helpMsg={
                                        "This property is used to created replace cloze cards (advanced). For normal usage, use {{c1 tokyo}} syntax instead of this."
                                    }
                                />
                                <PropFeature
                                    blockContent={blockContent}
                                    setBlockContent={setBlockContent}
                                    editingBlockUUID={editingBlockUUID}
                                    propName={"replaceclozehint"}
                                    placeHolderValue={`" hint1, hint2"`}
                                    helpMsg={
                                        "This property is used to add hints to replace cloze cards (advanced)."
                                    }
                                />
                            </FeatureGrid>
                            <h4>Image Occlusion Note</h4>
                            TODO
                            {/* <FeatureGrid> */}
                            {/*<code style={{fontSize: '17px'}}>occlusion::</code>*/}
                            {/*<LogseqButton title={"Add Prop"} size={"xs"} color={"primary"} isFullWidth={true} onClick={async () => {*/}
                            {/*    */}
                            {/*}}>*/}
                            {/*    Create / Edit Image Occlusion*/}
                            {/*</LogseqButton>*/}
                            {/*<HelpButton helpMsg={"This property is used to create image occlusion cards."} />*/}
                            {/* </FeatureGrid> */}
                        </BlockFeatureContainer>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const BlockFeatureContainer: React.FC<{
    children: React.ReactNode;
    uuid: string;
    title: string;
    containerBorderColor?: 'ls-page-blockquote-border-color' | 'amplify-components-badge-success-color';
}> = ({children, uuid, title, containerBorderColor = 'amplify-components-badge-success-color'}) => {
    return (
        <div
            style={{
                color: "var(--ls-page-blockquote-color,hsl(var(--secondary-foreground)))",
                backgroundColor: "var(--ls-page-blockquote-bg-color,hsl(var(--secondary)))",
                borderLeftColor:
                    "var(--amplify-components-badge-success-color,hsl(var(--primary)/.4))",
                borderLeft: "4px solid",
                marginTop: "12px",
            }}
            className={"ls-block"}>
            <h3
                style={{margin: "4px", borderBottom: "1px dotted", userSelect: "none"}}
                className="title">
                {title}
            </h3>
            <div style={{margin: "6px"}}>{children}</div>
        </div>
    );
};

export const FeatureGrid: React.FC<{children: React.ReactNode}> = ({children}) => {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "44% 1fr auto",
                gridGap: "32px",
                alignItems: "center",
            }}>
            {children}
        </div>
    );
};

const TagFeature: React.FC<{
    blockContent: string;
    setBlockContent: (content: string) => void;
    editingBlockUUID: string;
    tagName: string;
    tagDisplayText?: string;
    isEnabledFn?: () => {isEnabled: boolean; helpMsg?: string};
    helpMsg: string;
}> = ({
    blockContent,
    setBlockContent,
    editingBlockUUID,
    tagName,
    tagDisplayText,
    isEnabledFn = () => {
        return {isEnabled: true};
    },
    helpMsg,
}) => {
    const [doesContainTag, setDoesContainTag] = useState(false);
    useEffect(() => {
        (async function () {
            const tags = await BlockContentParser.find(blockContent, "Markdown", ["tag"]);
            if (tags.map((tag) => tag.content).includes("#" + tagName)) {
                setDoesContainTag(true);
            } else {
                setDoesContainTag(false);
            }
        })();
    }, [blockContent]);
    const isEnabled = isEnabledFn();
    return (
        <>
            <div>
                <code style={{fontSize: "17px"}}>{tagDisplayText || "#" + tagName}</code>
            </div>
            <div>
                <LogseqButton
                    disabled={!doesContainTag && !isEnabled.isEnabled}
                    title={
                        !doesContainTag && !isEnabled.isEnabled
                            ? isEnabled.helpMsg || ""
                            : doesContainTag
                            ? "Remove Tag"
                            : "Add Tag"
                    }
                    size={"xs"}
                    color={doesContainTag ? "failed" : "primary"}
                    isFullWidth={true}
                    onClick={async () => {
                        if (doesContainTag) {
                            const newContent = await BlockContentParser.findAndReplace(
                                blockContent,
                                "Markdown",
                                ["tag"],
                                (tag) => {
                                    if (tag.content == "#" + tagName) {
                                        return "";
                                    } else {
                                        return tag.content;
                                    }
                                },
                            );
                            await logseq.Editor.updateBlock(editingBlockUUID, newContent);
                            setBlockContent(newContent);
                        } else {
                            const newContent = blockContent + "\n#" + tagName;
                            await logseq.Editor.updateBlock(editingBlockUUID, newContent);
                            setBlockContent(newContent);
                        }
                    }}>
                    {doesContainTag ? "Remove Tag" : "Add Tag"}
                </LogseqButton>
            </div>
            <div>
                <HelpButton helpMsg={helpMsg} disabledHelpMsg={isEnabled.helpMsg} />
            </div>
        </>
    );
};

const DepthTagFeature: React.FC<{
    blockContent: string;
    setBlockContent: (content: string) => void;
    editingBlockUUID: string;
    isEnabledFn?: () => {isEnabled: boolean; helpMsg?: string};
    helpMsg: string;
}> = ({
    blockContent,
    setBlockContent,
    editingBlockUUID,
    isEnabledFn = () => {
        return {isEnabled: true};
    },
    helpMsg,
}) => {
    const [tagIndex, setTagIndex] = useState(1);
    const tagName = "depth-" + tagIndex;
    const [doesContainTag, setDoesContainTag] = useState(false);
    useEffect(() => {
        (async function () {
            const tags = await BlockContentParser.find(blockContent, "Markdown", ["tag"]);
            if (tags.map((tag) => tag.content).includes("#" + tagName)) {
                setDoesContainTag(true);
            } else {
                setDoesContainTag(false);
            }
        })();
    }, [blockContent, tagName]);
    const isEnabled = isEnabledFn();
    if (tagIndex < 1 || tagIndex > 9) isEnabled.isEnabled = false;
    return (
        <>
            <div>
                <code style={{fontSize: "17px"}}>
                    #depth-
                    <input
                        onChange={(e) => {
                            setTagIndex(parseInt(e.target.value));
                        }}
                        type={"number"}
                        min={1}
                        max={9}
                        value={tagIndex}
                        style={{fontSize: "16px", height: "17px", width: "38px"}}
                    />
                </code>
            </div>
            <div>
                <LogseqButton
                    disabled={!doesContainTag && !isEnabled.isEnabled}
                    title={
                        !doesContainTag && !isEnabled.isEnabled
                            ? isEnabled.helpMsg || ""
                            : doesContainTag
                            ? "Remove Tag"
                            : "Add Tag"
                    }
                    size={"xs"}
                    color={doesContainTag ? "failed" : "primary"}
                    isFullWidth={true}
                    onClick={async () => {
                        if (doesContainTag) {
                            const newContent = await BlockContentParser.findAndReplace(
                                blockContent,
                                "Markdown",
                                ["tag"],
                                (tag) => {
                                    if (tag.content == "#" + tagName) {
                                        return "";
                                    } else {
                                        return tag.content;
                                    }
                                },
                            );
                            await logseq.Editor.updateBlock(editingBlockUUID, newContent);
                            setBlockContent(newContent);
                        } else {
                            const newContent = blockContent + "\n#" + tagName;
                            await logseq.Editor.updateBlock(editingBlockUUID, newContent);
                            setBlockContent(newContent);
                        }
                    }}>
                    {doesContainTag ? "Remove Tag" : "Add Tag"}
                </LogseqButton>
            </div>
            <div>
                <HelpButton helpMsg={helpMsg} disabledHelpMsg={isEnabled.helpMsg} />
            </div>
        </>
    );
};
const DirectionTagFeature: React.FC<{
    blockContent: string;
    setBlockContent: (content: string) => void;
    editingBlockUUID: string;
    isEnabledFn?: () => {isEnabled: boolean; helpMsg?: string};
    helpMsg: string;
}> = ({
    blockContent,
    setBlockContent,
    editingBlockUUID,
    isEnabledFn = () => {
        return {isEnabled: true};
    },
    helpMsg,
}) => {
    const [actualDirection, setActualDirection] = useState("forward");
    useEffect(() => {
        // Check for forward, reversed, bidirectional
        (async function () {
            const tags = await BlockContentParser.find(blockContent, "Markdown", ["tag"]);
            if (tags.map((tag) => tag.content).includes("#forward")) {
                setActualDirection("forward");
            }
            if (tags.map((tag) => tag.content).includes("#reversed")) {
                setActualDirection("reversed");
            }
            if (
                tags.map((tag) => tag.content).includes("#forward") &&
                tags.map((tag) => tag.content).includes("#reversed")
            ) {
                setActualDirection("bidirectional");
            }
            if (tags.map((tag) => tag.content).includes("#bidirectional")) {
                setActualDirection("bidirectional");
            }
        })();
    }, [blockContent]);
    const isEnabled = isEnabledFn();

    return (
        <>
            <div>
                <code style={{fontSize: "16px"}}>Direction</code>
            </div>
            <div>
                <select
                    disabled={!isEnabled.isEnabled}
                    className={"form-select is-small"}
                    value={actualDirection}
                    onChange={async (e) => {
                        setActualDirection(e.target.value);
                        const newContent = (
                            await BlockContentParser.findAndReplace(
                                blockContent,
                                "Markdown",
                                ["tag"],
                                (tag) => {
                                    if (
                                        tag.content == "#forward" ||
                                        tag.content == "#reversed" ||
                                        tag.content == "#bidirectional"
                                    ) {
                                        return "";
                                    } else {
                                        return tag.content;
                                    }
                                },
                            )
                        ).trimEnd();
                        if (e.target.value == "forward") {
                            await logseq.Editor.updateBlock(
                                editingBlockUUID,
                                newContent + "\n#forward",
                            );
                            setBlockContent(newContent + "\n#forward");
                        }
                        if (e.target.value == "reversed") {
                            await logseq.Editor.updateBlock(
                                editingBlockUUID,
                                newContent + "\n#reversed",
                            );
                            setBlockContent(newContent + "\n#reversed");
                        }
                        if (e.target.value == "bidirectional") {
                            await logseq.Editor.updateBlock(
                                editingBlockUUID,
                                newContent + "\n#bidirectional",
                            );
                            setBlockContent(newContent + "\n#bidirectional");
                        }
                        setActualDirection(e.target.value);
                    }}>
                    <option value={"forward"}>Forward</option>
                    <option value={"reversed"}>Reversed</option>
                    <option value={"bidirectional"}>Bidirectional</option>
                </select>
            </div>
            <div>
                <HelpButton helpMsg={helpMsg} disabledHelpMsg={isEnabled.helpMsg} />
            </div>
        </>
    );
};
const PropFeature: React.FC<{
    blockContent: string;
    setBlockContent: (content: string) => void;
    editingBlockUUID: string;
    propName: string;
    isEnabledFn?: () => {isEnabled: boolean; helpMsg?: string};
    placeHolderValue?: string;
    helpMsg: string;
}> = ({
    blockContent,
    setBlockContent,
    editingBlockUUID,
    propName,
    helpMsg,
    placeHolderValue,
    isEnabledFn = () => {
        return {isEnabled: true};
    },
}) => {
    const [doesContainProp, setDoesContainProp] = useState(false);
    const [propValue, setPropValue] = useState("");
    const isEnabled = isEnabledFn();
    useEffect(() => {
        (async function () {
            const props = (await logseq.Editor.getBlock(editingBlockUUID)).properties;
            if (props[propName] != null) {
                setDoesContainProp(true);
                setPropValue(props[propName]);
            } else {
                setDoesContainProp(false);
            }
        })();
    }, [blockContent]);
    return (
        <>
            <div>
                <code style={{fontSize: "17px"}}>{propName}::</code>
            </div>
            <div>
                {(!doesContainProp || !isEnabled.isEnabled) && (
                    <LogseqButton
                        title={"Add Prop"}
                        size={"xs"}
                        color={"primary"}
                        isFullWidth={true}
                        onClick={async () => {
                            await logseq.Editor.upsertBlockProperty(
                                editingBlockUUID,
                                propName,
                                "",
                            );
                            const block = await logseq.Editor.getBlock(editingBlockUUID);
                            setBlockContent(block.content);
                        }}
                        disabled={!isEnabled.isEnabled}>
                        Add Prop
                    </LogseqButton>
                )}
                {doesContainProp && isEnabled.isEnabled && (
                    <div style={{display: "flex", alignItems: "center"}}>
                        <input
                            type={"text"}
                            value={propValue}
                            onChange={async (e) => {
                                await logseq.Editor.upsertBlockProperty(
                                    editingBlockUUID,
                                    propName,
                                    e.target.value,
                                );
                                const block = await logseq.Editor.getBlock(editingBlockUUID);
                                setBlockContent(block.content);
                                setPropValue(e.target.value);
                            }}
                            placeholder={placeHolderValue || ""}
                            style={{height: "28px"}}
                            className={"form-input"}
                        />
                        <LogseqButton
                            title={"Remove Prop"}
                            size={"xs"}
                            color={"failed"}
                            onClick={async () => {
                                await logseq.Editor.upsertBlockProperty(
                                    editingBlockUUID,
                                    propName,
                                    null,
                                );
                                const block = await logseq.Editor.getBlock(editingBlockUUID);
                                setBlockContent(block.content);
                                setPropValue("");
                            }}>
                            X
                        </LogseqButton>
                    </div>
                )}
            </div>
            <div>
                <HelpButton helpMsg={helpMsg} disabledHelpMsg={isEnabled.helpMsg} />
            </div>
        </>
    );
};

const OrgBlockFeature: React.FC<{
    blockContent: string;
    setBlockContent: (content: string) => void;
    editingBlockUUID: string;
    orgBlockDisplayHTML: string;
    orgBlockText: string;
    helpMsg: string;
}> = ({
    blockContent,
    setBlockContent,
    editingBlockUUID,
    orgBlockDisplayHTML,
    orgBlockText,
    helpMsg,
}) => {
    return (
        <>
            <div
                dangerouslySetInnerHTML={{__html: orgBlockDisplayHTML}}
                style={{fontSize: "12px"}}
            />
            <div>
                <LogseqButton
                    title={"Add Org Block"}
                    size={"xs"}
                    color={"primary"}
                    isFullWidth={true}
                    onClick={async () => {
                        const newContent = blockContent + "\n" + orgBlockText;
                        await logseq.Editor.updateBlock(editingBlockUUID, newContent);
                        setBlockContent(newContent);
                        await logseq.UI.showMsg("ORG Block Added", "success", {timeout: 1000});
                    }}>
                    Add ORG Block
                </LogseqButton>
            </div>
            <div>
                <HelpButton helpMsg={helpMsg} />
            </div>
        </>
    );
};

const TextFeatureComponent: React.FC<{
    blockContent: string;
    setBlockContent: (content: string) => void;
    editingBlockUUID: string;
    text: string;
    displayText?: string;
    helpMsg: string;
}> = ({blockContent, setBlockContent, editingBlockUUID, text, displayText, helpMsg}) => {
    return (
        <>
            <div>
                <code style={{fontSize: "17px"}}>{displayText || text}</code>
            </div>
            <div>
                <LogseqButton
                    title={"Add Text"}
                    size={"xs"}
                    color={"primary"}
                    isFullWidth={true}
                    onClick={async () => {
                        const newContent = blockContent + "\n" + text;
                        await logseq.Editor.updateBlock(editingBlockUUID, newContent);
                        setBlockContent(newContent);
                        await logseq.UI.showMsg("Text Added", "success", {timeout: 1000});
                    }}>
                    Add Text
                </LogseqButton>
            </div>
            <div>
                <HelpButton helpMsg={helpMsg} />
            </div>
        </>
    );
};

const HelpButton: React.FC<{helpMsg: string; disabledHelpMsg?: string | null | undefined}> = ({
    helpMsg,
    disabledHelpMsg,
}) => {
    return (
        <div style={{marginRight: "8px"}}>
            <LogseqButton
                title={helpMsg}
                size={"xs"}
                color={"outline-link"}
                isFullWidth={true}
                onClick={() => {
                    const alertMsg = disabledHelpMsg
                        ? `${helpMsg}\n\n\nButton disabled due to: ${disabledHelpMsg}`
                        : helpMsg;
                    const alertType = disabledHelpMsg ? "warning" : "";
                    logseq.UI.showMsg(alertMsg, alertType, {timeout: 10000});
                }}
                icon={
                    '<svg stroke="currentColor" fill="none" width="24" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="scale-125 icon icon-tabler icon-tabler-help-small" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" height="24"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M12 16v.01"></path><path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483"></path></svg>'
                }
            />
        </div>
    );
};
