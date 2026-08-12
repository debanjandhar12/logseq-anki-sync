import type {ThreadMessage} from "@assistant-ui/react";
import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test, vi} from "vitest";
import {
    ChatPageExporter,
    type ChatPageExporterDependencies,
    type DesiredLogseqBlock,
    type DesiredLogseqBlockIcon
} from "../../../../src/chat-app/export/ChatPageExporter";

const createUserMessage = (id: string, text: string): ThreadMessage =>
    ({
        id,
        role: "user",
        createdAt: new Date(),
        content: [{type: "text", text}],
        attachments: [],
        metadata: {custom: {}}
    }) as ThreadMessage;

const createAssistantMessage = (id: string, content: ThreadMessage["content"]): ThreadMessage =>
    ({
        id,
        role: "assistant",
        createdAt: new Date(),
        content,
        status: {type: "complete", reason: "stop"},
        metadata: {custom: {}}
    }) as ThreadMessage;

const createBlock = (uuid: string, content: string, children: BlockEntity[] = []): BlockEntity =>
    ({uuid, content, children}) as BlockEntity;

const createPage = (uuid = "page-1"): PageEntity => ({uuid, name: "export"}) as PageEntity;

const createDesiredBlock = (
    content: string,
    children: DesiredLogseqBlock[] = [],
    icon: DesiredLogseqBlockIcon = null,
    collapseToolCall = false
): DesiredLogseqBlock => ({content, children, icon, collapseToolCall});

describe("ChatPageExporter", () => {
    test("groups assistant text and tools under the preceding user message", () => {
        const messages = [
            createUserMessage("user-1", "First question"),
            createAssistantMessage("assistant-1", [
                {type: "text", text: "First answer"},
                {type: "reasoning", text: "private thought"},
                {
                    type: "tool-call",
                    toolCallId: "tool-1",
                    toolName: "logseq_read_block",
                    args: {uuid: "block-1"},
                    argsText: '{"uuid":"block-1"}',
                    result: false
                },
                {type: "data", name: "ignored", data: {value: 1}}
            ] as ThreadMessage["content"]),
            createAssistantMessage("assistant-2", [{type: "text", text: "Second answer"}]),
            createUserMessage("user-2", "Next question")
        ];

        expect(ChatPageExporter.createBlockTree(messages)).toEqual([
            {
                content: "First question",
                icon: "message-user",
                collapseToolCall: false,
                children: [
                    {
                        content: "First answer",
                        children: [],
                        icon: "message-chatbot",
                        collapseToolCall: false
                    },
                    {
                        content: "Tool Call: logseq_read_block",
                        icon: "message-chatbot",
                        collapseToolCall: true,
                        children: [
                            {
                                content: 'Tool Args:\n```json\n{"uuid":"block-1"}\n```',
                                children: [],
                                icon: null,
                                collapseToolCall: false
                            },
                            {
                                content: "Tool Result:\n```json\nfalse\n```",
                                children: [],
                                icon: null,
                                collapseToolCall: false
                            }
                        ]
                    },
                    {
                        content: "Second answer",
                        children: [],
                        icon: "message-chatbot",
                        collapseToolCall: false
                    }
                ]
            },
            {
                content: "Next question",
                children: [],
                icon: "message-user",
                collapseToolCall: false
            }
        ]);
    });

    test("uses null for a missing tool result and rejects a leading assistant message", () => {
        const toolMessage = createAssistantMessage("assistant-1", [
            {
                type: "tool-call",
                toolCallId: "tool-1",
                toolName: "pending_tool",
                args: {},
                argsText: "{}"
            }
        ]);

        expect(
            ChatPageExporter.createBlockTree([createUserMessage("user-1", "Question"), toolMessage])
        ).toMatchObject([
            {
                children: [
                    {
                        children: [
                            {content: "Tool Args:\n```json\n{}\n```"},
                            {content: "Tool Result:\n```json\nnull\n```"}
                        ]
                    }
                ]
            }
        ]);
        expect(() => ChatPageExporter.createBlockTree([toolMessage])).toThrow(
            "without a preceding user message"
        );
    });

    test("rejects an explicitly undefined tool result", () => {
        const toolMessage = createAssistantMessage("assistant-1", [
            {
                type: "tool-call",
                toolCallId: "tool-1",
                toolName: "invalid_tool",
                args: {},
                argsText: "{}",
                result: undefined
            }
        ]);

        expect(() =>
            ChatPageExporter.createBlockTree([createUserMessage("user-1", "Question"), toolMessage])
        ).toThrow("Unable to serialize tool result");
    });

    test("builds the exact page name and resolves title fallbacks", async () => {
        const messages = [createUserMessage("user-1", "Explain photosynthesis")];
        expect(ChatPageExporter.createPageName("thread-1", "  My Chat  ")).toBe(
            "_chat_export_thread-1_My Chat"
        );
        await expect(
            ChatPageExporter.resolveTitle("thread-1", messages, " Active ", "Stored")
        ).resolves.toBe("Active");
        await expect(
            ChatPageExporter.resolveTitle("thread-1", messages, "", " Stored ")
        ).resolves.toBe("Stored");
    });

    test("recursively updates, removes, and inserts blocks by position", async () => {
        const currentTree = [
            createBlock("root-1", "Old user", [
                createBlock("child-1", "Unchanged"),
                createBlock("child-2", "Remove", [createBlock("grandchild-1", "Remove too")])
            ])
        ];
        let insertedBlockIndex = 0;
        const dependencies = createDependencies({
            getPage: vi.fn(async () => createPage()),
            getPageBlocksTree: vi.fn(async () => currentTree),
            insertBlock: vi.fn(async (_parent, content) =>
                createBlock(`inserted-${++insertedBlockIndex}`, content)
            )
        });

        await ChatPageExporter.exportPage(
            "export",
            [
                createDesiredBlock(
                    "New user",
                    [createDesiredBlock("Unchanged", [createDesiredBlock("New grandchild")])],
                    "message-user"
                ),
                createDesiredBlock("New root", [], "message-user")
            ],
            dependencies
        );

        expect(dependencies.updateBlock).toHaveBeenCalledWith("root-1", "New user");
        expect(dependencies.updateBlock).toHaveBeenCalledTimes(1);
        expect(dependencies.removeBlock).toHaveBeenCalledWith("child-2");
        expect(dependencies.removeBlock).not.toHaveBeenCalledWith("grandchild-1");
        expect(dependencies.insertBlock).toHaveBeenNthCalledWith(1, "child-1", "New grandchild");
        expect(dependencies.insertBlock).toHaveBeenNthCalledWith(2, "page-1", "New root");
    });

    test("preserves an existing page and refetches after nullable creation", async () => {
        const existingPageDependencies = createDependencies({
            getPage: vi.fn(async () => createPage("existing-page"))
        });
        await ChatPageExporter.exportPage(
            "export",
            [createDesiredBlock("User message", [], "message-user")],
            existingPageDependencies
        );
        expect(existingPageDependencies.createPage).not.toHaveBeenCalled();

        const getPage = vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(createPage("created-page"));
        const creationDependencies = createDependencies({
            getPage,
            createPage: vi.fn(async () => null)
        });
        await expect(
            ChatPageExporter.exportPage(
                "export",
                [createDesiredBlock("User message", [], "message-user")],
                creationDependencies
            )
        ).resolves.toEqual({pageName: "export", pageUuid: "created-page"});
        expect(getPage).toHaveBeenCalledTimes(2);
    });

    test("rejects an empty tree before reading or mutating the page", async () => {
        const dependencies = createDependencies();

        await expect(ChatPageExporter.exportPage("export", [], dependencies)).rejects.toThrow(
            "no user messages"
        );
        expect(dependencies.getPage).not.toHaveBeenCalled();
        expect(dependencies.getPageBlocksTree).not.toHaveBeenCalled();
        expect(dependencies.removeBlock).not.toHaveBeenCalled();
    });

    test("removes multiple excess siblings in reverse order", async () => {
        const dependencies = createDependencies({
            getPage: vi.fn(async () => createPage()),
            getPageBlocksTree: vi.fn(async () => [
                createBlock("root-1", "Keep"),
                createBlock("root-2", "Remove second"),
                createBlock("root-3", "Remove first")
            ])
        });

        await ChatPageExporter.exportPage(
            "export",
            [createDesiredBlock("Keep", [], "message-user")],
            dependencies
        );

        expect(vi.mocked(dependencies.removeBlock).mock.calls).toEqual([["root-3"], ["root-2"]]);
        expect(dependencies.updateBlock).not.toHaveBeenCalled();
        expect(dependencies.insertBlock).not.toHaveBeenCalled();
    });

    test("adds page and position context and stops after a reconciliation failure", async () => {
        const dependencies = createDependencies({
            getPage: vi.fn(async () => createPage()),
            getPageBlocksTree: vi.fn(async () => [
                createBlock("root-1", "Old"),
                createBlock("root-2", "Remove")
            ]),
            updateBlock: vi.fn(async () => {
                throw new Error("write failed");
            })
        });

        await expect(
            ChatPageExporter.exportPage(
                "export",
                [createDesiredBlock("New", [], "message-user")],
                dependencies
            )
        ).rejects.toThrow("page: export, parent: page-1, path: 0");
        expect(dependencies.removeBlock).not.toHaveBeenCalled();
    });

    test("applies exact icons to reused blocks and collapses tool calls after children", async () => {
        const operationLog: string[] = [];
        const currentTree = [
            createBlock("user", "Question", [
                createBlock("tool", "Tool Call: search", [
                    createBlock("args", "Tool Args:\n```json\n{}\n```"),
                    createBlock("result", 'Tool Result:\n```json\n{"ok":true}\n```')
                ])
            ])
        ];
        const dependencies = createDependencies({
            getPage: vi.fn(async () => createPage()),
            getPageBlocksTree: vi.fn(async () => currentTree),
            setBlockIcon: vi.fn(async (uuid, icon) => {
                operationLog.push(`icon:${String(uuid)}:${icon}`);
            }),
            removeBlockIcon: vi.fn(async (uuid) => {
                operationLog.push(`remove-icon:${String(uuid)}`);
            }),
            setBlockCollapsed: vi.fn(async (uuid) => {
                operationLog.push(`collapse:${String(uuid)}`);
            })
        });

        await ChatPageExporter.exportPage(
            "export",
            [
                createDesiredBlock(
                    "Question",
                    [
                        createDesiredBlock(
                            "Tool Call: search",
                            [
                                createDesiredBlock("Tool Args:\n```json\n{}\n```"),
                                createDesiredBlock('Tool Result:\n```json\n{"ok":true}\n```')
                            ],
                            "message-chatbot",
                            true
                        )
                    ],
                    "message-user"
                )
            ],
            dependencies
        );

        expect(operationLog).toEqual([
            "icon:user:message-user",
            "icon:tool:message-chatbot",
            "remove-icon:args",
            "remove-icon:result",
            "collapse:tool"
        ]);
        expect(dependencies.updateBlock).not.toHaveBeenCalled();
        expect(dependencies.insertBlock).not.toHaveBeenCalled();
        expect(dependencies.removeBlock).not.toHaveBeenCalled();
    });

    test("sets icons and collapses a newly inserted tool block after inserting its children", async () => {
        const operationLog: string[] = [];
        let insertedBlockIndex = 0;
        const dependencies = createDependencies({
            insertBlock: vi.fn(async (_parent, content) => {
                const block = createBlock(`inserted-${++insertedBlockIndex}`, content);
                operationLog.push(`insert:${block.uuid}`);
                return block;
            }),
            setBlockIcon: vi.fn(async (uuid, icon) => {
                operationLog.push(`icon:${String(uuid)}:${icon}`);
            }),
            setBlockCollapsed: vi.fn(async (uuid) => {
                operationLog.push(`collapse:${String(uuid)}`);
            })
        });

        await ChatPageExporter.exportPage(
            "export",
            [
                createDesiredBlock(
                    "Question",
                    [
                        createDesiredBlock(
                            "Tool Call: search",
                            [
                                createDesiredBlock("Tool Args:\n```json\n{}\n```"),
                                createDesiredBlock("Tool Result:\n```json\nnull\n```")
                            ],
                            "message-chatbot",
                            true
                        )
                    ],
                    "message-user"
                )
            ],
            dependencies
        );

        expect(operationLog).toEqual([
            "insert:inserted-1",
            "icon:inserted-1:message-user",
            "insert:inserted-2",
            "icon:inserted-2:message-chatbot",
            "insert:inserted-3",
            "insert:inserted-4",
            "collapse:inserted-2"
        ]);
        expect(dependencies.removeBlockIcon).not.toHaveBeenCalled();
    });

    test.each([
        ["set icon", "setBlockIcon", createDesiredBlock("Question", [], "message-user")],
        ["remove icon", "removeBlockIcon", createDesiredBlock("Tool Args:\n```json\n{}\n```")],
        ["collapse", "setBlockCollapsed", createDesiredBlock("Tool Call: x", [], null, true)]
    ] as const)("adds block context when %s fails", async (operation, dependencyName, desired) => {
        const failure = new Error("presentation failed");
        const dependencies = createDependencies({
            getPage: vi.fn(async () => createPage()),
            getPageBlocksTree: vi.fn(async () => [createBlock("root-1", desired.content)]),
            [dependencyName]: vi.fn(async () => {
                throw failure;
            })
        });

        const promise = ChatPageExporter.exportPage("export", [desired], dependencies);
        await expect(promise).rejects.toThrow(
            `Failed to ${operation} export page block (page: export, parent: page-1, block: root-1, path: 0)`
        );
        await expect(promise).rejects.toMatchObject({cause: failure});
    });
});

function createDependencies(
    overrides: Partial<ChatPageExporterDependencies> = {}
): ChatPageExporterDependencies {
    return {
        getPage: vi.fn(async () => null),
        createPage: vi.fn(async () => createPage()),
        getPageBlocksTree: vi.fn(async () => []),
        insertBlock: vi.fn(async (_parent, content) => createBlock("inserted", content)),
        updateBlock: vi.fn(async () => undefined),
        removeBlock: vi.fn(async () => undefined),
        setBlockIcon: vi.fn(async () => undefined),
        removeBlockIcon: vi.fn(async () => undefined),
        setBlockCollapsed: vi.fn(async () => undefined),
        ...overrides
    };
}
