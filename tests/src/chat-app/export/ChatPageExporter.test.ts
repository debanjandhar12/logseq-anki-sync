import type {ThreadMessage} from "@assistant-ui/react";
import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test, vi} from "vitest";
import {
    ChatPageExporter,
    type ChatPageExporterDependencies
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
                children: [
                    {content: "First answer", children: []},
                    {
                        content: "Tool Call: logseq_read_block",
                        children: [
                            {content: 'Tool Args: {"uuid":"block-1"}', children: []},
                            {content: "Tool Result: false", children: []}
                        ]
                    },
                    {content: "Second answer", children: []}
                ]
            },
            {content: "Next question", children: []}
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
                        children: [{content: "Tool Args: {}"}, {content: "Tool Result: null"}]
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

    test("builds the exact page name and resolves title fallbacks", () => {
        const messages = [createUserMessage("user-1", "Explain photosynthesis")];
        expect(ChatPageExporter.createPageName("thread-1", "  My Chat  ")).toBe(
            "_chat_export_thread-1_My Chat"
        );
        expect(ChatPageExporter.resolveTitle("thread-1", messages, " Active ", "Stored")).toBe(
            "Active"
        );
        expect(ChatPageExporter.resolveTitle("thread-1", messages, "", " Stored ")).toBe("Stored");
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
                {
                    content: "New user",
                    children: [
                        {
                            content: "Unchanged",
                            children: [{content: "New grandchild", children: []}]
                        }
                    ]
                },
                {content: "New root", children: []}
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
            [{content: "User message", children: []}],
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
                [{content: "User message", children: []}],
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
            [{content: "Keep", children: []}],
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
            ChatPageExporter.exportPage("export", [{content: "New", children: []}], dependencies)
        ).rejects.toThrow("page: export, parent: page-1, path: 0");
        expect(dependencies.removeBlock).not.toHaveBeenCalled();
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
        ...overrides
    };
}
