// @vitest-environment node
import {type CompleteAttachment, ExportedMessageRepository} from "@assistant-ui/core";
import {describe, expect, it, vi} from "vitest";
import pkg from "../../../package.json";
import {
    assistantMessage,
    buildBranchedThread,
    buildLinearThread,
    buildRepository,
    buildThread,
    buildThreadList,
    type RepositoryNode,
    userMessage
} from "./threadBuilders";

const attachment: CompleteAttachment = {
    id: "page-attachment",
    type: "logseq-page",
    name: "Scenario page",
    status: {type: "complete"},
    content: [{type: "text", text: "Page context"}]
};

describe("message builders", () => {
    it("preserves separate user text parts, whitespace and complete attachment content", () => {
        const text = ["First line\n", "  Second line"];
        const createdAt = new Date("2026-03-04T05:06:07Z");
        const message = userMessage({id: "u", text, attachments: [attachment], createdAt});
        expect(message).toMatchObject({
            id: "u",
            role: "user",
            content: [
                {type: "text", text: text[0]},
                {type: "text", text: text[1]}
            ],
            attachments: [attachment],
            createdAt
        });
        expect(message.createdAt).not.toBe(createdAt);
        expect(text).toEqual(["First line\n", "  Second line"]);
        expect(userMessage({id: "single", text: "Hello"}).content).toEqual([
            {type: "text", text: "Hello"}
        ]);
    });

    it("normalizes completed assistant messages with reasoning before text and no tool results", () => {
        const message = assistantMessage({id: "a", text: "**Answer**", reasoning: "Thinking"});
        expect(message.content).toEqual([
            {type: "reasoning", text: "Thinking"},
            {type: "text", text: "**Answer**"}
        ]);
        expect(message.status).toEqual({type: "complete", reason: "stop"});
        expect(message.metadata).toMatchObject({steps: [], custom: {}});
        expect(assistantMessage({id: "reasoning", reasoning: "Only reasoning"}).content).toEqual([
            {type: "reasoning", text: "Only reasoning"}
        ]);
        expect(assistantMessage({id: "empty"}).content).toEqual([]);
        expect(assistantMessage({id: "blank", text: "  "}).content).toEqual([]);
    });

    it.each(["", " \n "])("rejects empty message IDs (%j)", (id) => {
        expect(() => userMessage({id, text: "question"})).toThrow(/nonempty ID/);
        expect(() => assistantMessage({id, text: "answer"})).toThrow(/nonempty ID/);
    });
});

describe("buildRepository", () => {
    const nodes = (): RepositoryNode[] => [
        {message: {id: "u", role: "user", content: "Question"}, parentId: null},
        {message: {id: "a", role: "assistant", content: "Answer"}, parentId: "u"}
    ];

    it("uses the public converter with an explicit leaf and deterministic fallback dates", () => {
        const converter = vi.spyOn(ExportedMessageRepository, "fromBranchableArray");
        try {
            const input = nodes();
            const repository = buildRepository(input, {headId: "a"});
            expect(converter).toHaveBeenCalledOnce();
            expect(converter.mock.calls[0][1]).toEqual({headId: "a"});
            expect(repository.headId).toBe("a");
            expect(
                repository.messages.map(({message, parentId}) => [message.id, parentId])
            ).toEqual([
                ["u", null],
                ["a", "u"]
            ]);
            expect(repository.messages[1].message).toMatchObject({
                role: "assistant",
                status: {type: "complete", reason: "unknown"}
            });
            expect(buildRepository(input, {headId: "a"})).toEqual(repository);
            expect(input[0].message.createdAt).toBeUndefined();
        } finally {
            converter.mockRestore();
        }
    });

    it.each([
        [
            "missing ID",
            [{message: {role: "user", content: "q"}, parentId: null}],
            "u",
            /nonempty ID/
        ],
        [
            "whitespace ID",
            [{message: {id: " ", role: "user", content: "q"}, parentId: null}],
            " ",
            /nonempty ID/
        ],
        ["duplicate ID", [...nodes(), nodes()[1]], "a", /Duplicate message ID: a/],
        [
            "missing parent",
            [{...nodes()[0], parentId: "missing"}],
            "u",
            /Parent missing must precede child u/
        ],
        ["child before parent", nodes().toReversed(), "a", /Parent u must precede child a/],
        ["self parent", [{...nodes()[0], parentId: "u"}], "u", /Parent u must precede child u/],
        ["unknown head", nodes(), "missing", /Head message not found/],
        ["nonleaf head", nodes(), "u", /Head must be a leaf/],
        ["null nonempty head", nodes(), null, /nonempty ID/],
        ["empty head", nodes(), "", /nonempty ID/],
        ["nonempty head for empty repository", [], "a", /empty repository/]
    ] as [
        string,
        RepositoryNode[],
        string | null,
        RegExp
    ][])("rejects %s before importing an invalid history", (_label, input, headId, error) => {
        expect(() => buildRepository(input, {headId})).toThrow(error);
    });

    it("represents an empty history with an explicit null head", () => {
        expect(buildRepository([], {headId: null})).toEqual({headId: null, messages: []});
    });
});

describe("thread presets", () => {
    it("builds a multi-turn linear history with attachments, exact edges and final head", () => {
        const options = {
            id: "linear",
            title: "Seeded conversation",
            turns: [
                {user: ["First", "Second"], assistant: "Reply", attachments: [attachment]},
                {user: "Follow-up", assistant: "Final reply"}
            ]
        };
        const thread = buildLinearThread(options);
        const repository = thread.exportedMessageRepository;
        expect(repository.headId).toBe("linear:a1");
        expect(repository.messages.map(({message, parentId}) => [message.id, parentId])).toEqual([
            ["linear:u0", null],
            ["linear:a0", "linear:u0"],
            ["linear:u1", "linear:a0"],
            ["linear:a1", "linear:u1"]
        ]);
        expect(repository.messages[0].message).toMatchObject({attachments: [attachment]});
        expect(repository.messages[2].message).toMatchObject({attachments: []});
        expect(repository.messages.map(({message}) => message.createdAt.getTime())).toEqual([
            Date.parse("2026-01-01T00:00:00Z"),
            Date.parse("2026-01-01T00:00:01Z"),
            Date.parse("2026-01-01T00:00:02Z"),
            Date.parse("2026-01-01T00:00:03Z")
        ]);
        expect(buildLinearThread(options)).toEqual(thread);
        expect(buildLinearThread({turns: []}).exportedMessageRepository).toEqual({
            headId: null,
            messages: []
        });
    });

    it.each([
        "original",
        "refreshed",
        "edited"
    ] as const)("preserves all seven nodes and selects the %s leaf without changing picker order", (head) => {
        const {thread, ids, texts} = buildBranchedThread({id: "branches", head});
        const repository = thread.exportedMessageRepository;
        const heads = {original: ids.a1Original, refreshed: ids.a1Refreshed, edited: ids.a1Edited};
        expect(repository.headId).toBe(heads[head]);
        expect(repository.messages.map(({message, parentId}) => [message.id, parentId])).toEqual([
            [ids.u0, null],
            [ids.a0, ids.u0],
            [ids.u1Original, ids.a0],
            [ids.a1Original, ids.u1Original],
            [ids.a1Refreshed, ids.u1Original],
            [ids.u1Edited, ids.a0],
            [ids.a1Edited, ids.u1Edited]
        ]);
        expect(new Set(Object.values(texts)).size).toBe(7);
        for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
            expect(ids[key]).toMatch(/^branches:/);
            expect(
                repository.messages.find(({message}) => message.id === ids[key]).message.content
            ).toEqual([{type: "text", text: texts[key]}]);
        }
        // Follow the selected path, as the runtime does, and rule out off-branch sentinels.
        const path: string[] = [];
        let current = repository.headId;
        while (current !== null) {
            const node = repository.messages.find(({message}) => message.id === current);
            path.unshift(node.message.id);
            current = node.parentId;
        }
        expect(path).toEqual([
            ids.u0,
            ids.a0,
            head === "edited" ? ids.u1Edited : ids.u1Original,
            heads[head]
        ]);
        expect(
            repository.messages.every(({message}) =>
                message.content.every((part) => part.type === "text")
            )
        ).toBe(true);
    });

    it("uses deterministic defaults and thread-specific IDs and text sentinels", () => {
        expect(buildBranchedThread()).toEqual(buildBranchedThread());
        const first = buildBranchedThread({id: "first"});
        const second = buildBranchedThread({id: "second"});
        expect(first.thread.exportedMessageRepository.headId).toBe(first.ids.a1Edited);
        expect(Object.values(first.ids).some((id) => Object.values(second.ids).includes(id))).toBe(
            false
        );
        expect(
            Object.values(first.texts).some((text) => Object.values(second.texts).includes(text))
        ).toBe(false);
    });

    it("uses repository timestamps and package version in persistence metadata", () => {
        const repository = buildRepository(
            [
                {
                    message: userMessage({id: "u", text: "q", createdAt: new Date("2026-02-02Z")}),
                    parentId: null
                },
                {
                    message: assistantMessage({
                        id: "a",
                        text: "a",
                        createdAt: new Date("2026-02-01Z")
                    }),
                    parentId: "u"
                }
            ],
            {headId: "a"}
        );
        const thread = buildThread({id: "thread", title: "Title", repository});
        expect(thread).toMatchObject({
            remoteId: "thread",
            title: "Title",
            status: "regular",
            custom: {
                createdAt: new Date("2026-02-01Z"),
                updatedAt: new Date("2026-02-02Z"),
                createdByPluginVersion: pkg.version
            }
        });
        expect(thread.exportedMessageRepository).toBe(repository);
        const updatedAt = new Date("2026-04-01Z");
        expect(
            buildThread({id: "thread", title: "Title", repository, updatedAt}).custom.updatedAt
        ).toEqual(updatedAt);
        expect(() => buildThread({id: " ", title: "Title", repository})).toThrow(/nonempty ID/);
        const persisted = JSON.parse(JSON.stringify(thread));
        expect(persisted.exportedMessageRepository.headId).toBe("a");
        expect(persisted.custom.updatedAt).toBe("2026-02-02T00:00:00.000Z");
    });

    it("builds distinct history rows with sortable timestamps and one optional long title", () => {
        const baseTime = new Date("2026-05-01Z");
        const threads = buildThreadList({count: 4, idPrefix: "rows", baseTime, longTitleIndex: 2});
        expect(threads.map((thread) => thread.remoteId)).toEqual([
            "rows-0",
            "rows-1",
            "rows-2",
            "rows-3"
        ]);
        expect(threads.map((thread) => new Date(thread.custom.updatedAt).getTime())).toEqual([
            baseTime.getTime(),
            baseTime.getTime() + 1000,
            baseTime.getTime() + 2000,
            baseTime.getTime() + 3000
        ]);
        expect(
            threads.filter((thread) => thread.title.length > 100).map((thread) => thread.remoteId)
        ).toEqual(["rows-2"]);
        expect(
            new Set(
                threads.flatMap((thread) =>
                    thread.exportedMessageRepository.messages.map(({message}) => message.id)
                )
            ).size
        ).toBe(8);
        expect(buildThreadList()).toEqual(buildThreadList());
        expect(buildThreadList({count: 0})).toEqual([]);
        expect(() => buildThreadList({count: -1})).toThrow(/nonnegative integer/);
        expect(() => buildThreadList({count: 1.5})).toThrow(/nonnegative integer/);
        expect(() => buildThreadList({count: 2, longTitleIndex: 2})).toThrow(/Long title index/);
    });
});
