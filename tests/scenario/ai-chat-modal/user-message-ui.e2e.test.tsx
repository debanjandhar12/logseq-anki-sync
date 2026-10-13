import type {CompleteAttachment} from "@assistant-ui/react";
import {describe, expect} from "vitest";
import {page} from "vitest/browser";
import {
    createLogseqAttachmentFromUuid,
    LOGSEQ_ATTACHMENT_TYPES
} from "../../../src/chat-app/runtime/LogseqAttachmentAdapter";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {
    normalizeRepository,
    waitForSavedConversation
} from "../../helpers/chat-scenario/assertions";
import {test} from "../../helpers/chat-scenario/fixtures/aiChatScenarioFixture";
import {buildLinearThread} from "../../helpers/chat-scenario/threadBuilders";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";

describe("User message UI", () => {
    test("real block, page, tag and property attachments render compact sent-message pills", async ({
        chat,
        storage,
        cleanup,
        model
    }) => {
        const pageName = `p-${crypto.randomUUID()}`;
        const tagName = `t-${crypto.randomUUID()}`;
        const propertyName = `r-${crypto.randomUUID()}`;
        const blockName = "Short block";
        cleanup.pageNames.add(pageName);
        cleanup.add(async () => {
            const tag = await logseq.Editor.getTag(tagName);
            if (tag) await logseq.Editor.deletePage(tag.uuid);
        });
        cleanup.add(async () => {
            if (await logseq.Editor.getProperty(propertyName)) {
                await logseq.Editor.removeProperty(propertyName);
            }
        });

        const livePage =
            (await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: false}
            )) ?? (await logseq.Editor.getPage(pageName))!;
        const block = (await logseq.Editor.appendBlockInPage(livePage.uuid, blockName))!;
        const tag =
            (await logseq.Editor.createTag(tagName)) ?? (await logseq.Editor.getTag(tagName))!;
        await logseq.Editor.upsertProperty(propertyName, {type: "default"});
        const property = (await logseq.Editor.getProperty(propertyName))!;
        const entities = [
            {
                uuid: block.uuid,
                name: blockName,
                label: "Logseq block attachment",
                type: LOGSEQ_ATTACHMENT_TYPES.block,
                text: `Block UUID: ${block.uuid}`
            },
            {
                uuid: livePage.uuid,
                name: pageName,
                label: "Logseq page attachment",
                type: LOGSEQ_ATTACHMENT_TYPES.page,
                text: `Page UUID: ${livePage.uuid}\nPage Name: ${pageName}`
            },
            {
                uuid: tag.uuid,
                name: tagName,
                label: "Logseq tag page attachment",
                type: LOGSEQ_ATTACHMENT_TYPES.tagPage,
                text: `Tag Page UUID: ${tag.uuid}\nTag Page Name: ${tagName}`
            },
            {
                uuid: property.uuid,
                name: propertyName,
                label: "Logseq property page attachment",
                type: LOGSEQ_ATTACHMENT_TYPES.propertyPage,
                text: `Property Page UUID: ${property.uuid}\nProperty Page Name: ${propertyName}`
            }
        ];
        const attachments: CompleteAttachment[] = await Promise.all(
            entities.map(async ({uuid}) => {
                const attachment = await createLogseqAttachmentFromUuid(uuid);
                const {id, type, contentType} = attachment;
                if (!id || !type || !contentType) {
                    throw new Error(`Logseq attachment ${uuid} is missing required fields`);
                }
                return {...attachment, id, type, contentType, status: {type: "complete" as const}};
            })
        );
        const question = "Inspect these four Logseq entities.";
        const answer = "The seeded answer for four entities.";
        const thread = buildLinearThread({
            id: crypto.randomUUID(),
            turns: [{user: question, assistant: answer, attachments}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, answer);
        const message = driver.userMessage(0);
        await expect.element(message.getByText(question, {exact: true})).toBeVisible();
        await expect
            .element(message.getByRole("button", {name: "Remove file", exact: true}))
            .not.toBeInTheDocument();
        const saved = (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository!;
        const savedUser = saved.messages.find(({message}) => message.role === "user")!.message;
        expect(savedUser.attachments).toHaveLength(4);
        for (const entity of entities) {
            expect(savedUser.attachments).toContainEqual(
                expect.objectContaining({
                    id: entity.uuid,
                    name: entity.name,
                    type: entity.type,
                    status: {type: "complete"},
                    content: [{type: "text", text: entity.text}]
                })
            );
            const pill = message
                .getByRole("button", {name: entity.label, exact: true})
                .filter({hasText: entity.name});
            await expect.element(pill).toBeVisible();
            await expect
                .poll(
                    () => {
                        const button = pill.element();
                        const rect = button.getBoundingClientRect();
                        const style = getComputedStyle(button);
                        return (
                            rect.height >= 20 &&
                            rect.height <= 36 &&
                            rect.width > rect.height &&
                            rect.width <= 161 &&
                            Number.parseFloat(style.borderRadius) >= rect.height / 2 - 1 &&
                            Number.parseFloat(style.borderTopWidth) > 0
                        );
                    },
                    {message: `${entity.label} should be a compact, rounded, bordered pill`}
                )
                .toBe(true);
            // The name's painted span is structural: attachment names have no semantic role.
            await expect
                .poll(
                    () =>
                        getComputedStyle(pill.getByText(entity.name, {exact: true}).element())
                            .textOverflow
                )
                .toBe("ellipsis");
        }
        await expect
            .poll(
                () => {
                    const buttons = entities.map(({label, name}) =>
                        message
                            .getByRole("button", {name: label, exact: true})
                            .filter({hasText: name})
                            .element()
                    );
                    const row = buttons[0].parentElement!.parentElement!;
                    const rowRect = row.getBoundingClientRect();
                    const messageRect = message.element().getBoundingClientRect();
                    return (
                        buttons.every((button) => {
                            expect(button.parentElement!.parentElement).toBe(row);
                            const rect = button.getBoundingClientRect();
                            return (
                                rect.left >= rowRect.left - 1 &&
                                rect.right <= rowRect.right + 1 &&
                                rect.top >= rowRect.top - 1 &&
                                rect.bottom <= rowRect.bottom + 1 &&
                                rect.left >= messageRect.left - 1 &&
                                rect.right <= messageRect.right + 1
                            );
                        }) && row.scrollWidth <= row.clientWidth + 1
                    );
                },
                {message: "All four sent pills should fit or wrap within the attachment row"}
            )
            .toBe(true);
        expect(model.runs).toHaveLength(0);
    }, 60_000);

    test("the public attachment command transfers live page and block attachments into a sent message", async ({
        chat,
        cleanup,
        model
    }) => {
        const pageName = `p-${crypto.randomUUID()}`;
        const blockName = "Attached live block";
        cleanup.pageNames.add(pageName);
        const livePage =
            (await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: false}
            )) ?? (await logseq.Editor.getPage(pageName))!;
        const block = (await logseq.Editor.appendBlockInPage(livePage.uuid, blockName))!;
        const question = "Use the attached page and block.";
        const answer = "The attachment command response.";
        const languageModel = model.respondWith([{segments: [textSegment(answer)]}]);
        const driver = await chat.mount();
        await driver.addAttachment(livePage.uuid, "Logseq page attachment", pageName);
        await driver.addAttachment(block.uuid, "Logseq block attachment", blockName);
        const composer = driver.root.getBySlot("aui_composer-shell");
        expect(
            composer.getByRole("button", {name: "Remove file", exact: true}).elements()
        ).toHaveLength(2);
        await driver.sendMessage(question);
        await expect
            .element(driver.assistantMessage(0).getByText(answer, {exact: true}))
            .toBeVisible();
        for (const [label, name] of [
            ["Logseq page attachment", pageName],
            ["Logseq block attachment", blockName]
        ]) {
            await expect
                .element(composer.getByRole("button", {name: label, exact: true}))
                .not.toBeInTheDocument();
            await expect
                .element(
                    driver
                        .userMessage(0)
                        .getByRole("button", {name: label, exact: true})
                        .filter({hasText: name})
                )
                .toBeVisible();
        }
        await expect
            .element(composer.getByRole("button", {name: "Remove file", exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(0).getByRole("button", {name: "Remove file", exact: true}))
            .not.toBeInTheDocument();
        await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
        const [thread] = await ThreadStore.listThreads();
        const repository = await waitForSavedConversation(thread.remoteId, answer);
        expect(repository.messages).toHaveLength(2);
        const user = repository.messages.find(({message}) => message.role === "user")!.message;
        expect(user.content).toEqual([{type: "text", text: question}]);
        const pageText = `Page UUID: ${livePage.uuid}\nPage Name: ${pageName}`;
        const blockText = `Block UUID: ${block.uuid}`;
        expect(user.attachments).toEqual([
            expect.objectContaining({
                id: livePage.uuid,
                name: pageName,
                type: LOGSEQ_ATTACHMENT_TYPES.page,
                status: {type: "complete"},
                content: [{type: "text", text: pageText}]
            }),
            expect.objectContaining({
                id: block.uuid,
                name: blockName,
                type: LOGSEQ_ATTACHMENT_TYPES.block,
                status: {type: "complete"},
                content: [{type: "text", text: blockText}]
            })
        ]);
        expect(languageModel.doStreamCalls).toHaveLength(1);
        expect(languageModel.doStreamCalls[0].prompt.filter(({role}) => role !== "system")).toEqual(
            [
                {
                    role: "user",
                    content: [
                        {type: "text", text: question},
                        {type: "text", text: pageText},
                        {type: "text", text: blockText}
                    ]
                }
            ]
        );
        expect(model.runs).toHaveLength(1);
    }, 60_000);

    test("Cancel edit restores the seeded conversation without branching or generating", async ({
        chat,
        storage,
        model
    }) => {
        const question = "Keep the original question.";
        const answer = "Keep the original answer.";
        const draft = "This draft must be discarded.";
        const thread = buildLinearThread({
            id: crypto.randomUUID(),
            turns: [{user: question, assistant: answer}]
        });
        await storage.seedThread(thread);
        const before = normalizeRepository(
            (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
        );
        const driver = await chat.mount();
        await driver.openThread(thread.title!, answer);
        const editor = await driver.beginEdit(0);
        await editor.getByRole("textbox").fill(draft);
        await editor.getByRole("button", {name: "Cancel", exact: true}).click();
        await expect.element(editor).not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(0).getByText(question, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(answer, {exact: true}))
            .toBeVisible();
        await expect.element(driver.root.getByText(draft, {exact: true})).not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(0).getByRole("button", {name: /^(Previous|Next)$/}))
            .not.toBeInTheDocument();
        await chat.unmount();
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(before);
        expect((await ThreadStore.listThreads()).map(({remoteId}) => remoteId)).toEqual([
            thread.remoteId
        ]);
        expect(model.runs).toHaveLength(0);
    });

    test("unchanged Update joins multiple text parts and exits without a new branch", async ({
        chat,
        storage,
        model
    }) => {
        const parts = ["The first original text part.", "The second original text part."];
        const answer = "The original multipart answer.";
        const thread = buildLinearThread({
            id: crypto.randomUUID(),
            turns: [{user: parts, assistant: answer}]
        });
        await storage.seedThread(thread);
        const before = normalizeRepository(
            (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
        );
        const driver = await chat.mount();
        await driver.openThread(thread.title!, answer);
        const editor = await driver.beginEdit(0);
        await expect.element(editor.getByRole("textbox")).toHaveValue(parts.join("\n\n"));
        await editor.getByRole("button", {name: "Update", exact: true}).click();
        await expect.element(editor).not.toBeInTheDocument();
        for (const part of parts)
            await expect
                .element(driver.userMessage(0).getByText(part, {exact: true}))
                .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(answer, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.userMessage(0).getByRole("button", {name: /^(Previous|Next)$/}))
            .not.toBeInTheDocument();
        await expect
            .element(page.getByRole("button", {name: /^Revert & Switch/}))
            .not.toBeInTheDocument();
        await chat.unmount();
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(before);
        expect((await ThreadStore.listThreads()).map(({remoteId}) => remoteId)).toEqual([
            thread.remoteId
        ]);
        expect(model.runs).toHaveLength(0);
    });

    test("the unfocused edit form and main composer share visible background and all borders", async ({
        chat,
        storage,
        model
    }) => {
        const answer = "The answer for composer styling.";
        const thread = buildLinearThread({
            id: crypto.randomUUID(),
            turns: [{user: "Compare composer styling.", assistant: answer}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, answer);
        const editor = await driver.beginEdit(0);
        (editor.getByRole("textbox").element() as HTMLTextAreaElement).blur();
        (driver.messageInput.element() as HTMLTextAreaElement).blur();
        const shell = driver.root.getBySlot("aui_composer-shell");
        await expect
            .poll(
                () => {
                    const form = editor.getByRole("textbox").element().parentElement!;
                    expect(form.tagName).toBe("FORM");
                    expect(form.matches(":focus-within")).toBe(false);
                    expect(shell.element().matches(":focus-within")).toBe(false);
                    const editStyle = getComputedStyle(form);
                    const mainStyle = getComputedStyle(shell.element());
                    expect(editStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
                    expect(editStyle.backgroundColor).not.toBe("transparent");
                    expect(editStyle.backgroundColor).toBe(mainStyle.backgroundColor);
                    for (const side of ["top", "right", "bottom", "left"]) {
                        for (const property of ["color", "style", "width"]) {
                            const cssProperty = `border-${side}-${property}`;
                            expect(editStyle.getPropertyValue(cssProperty)).toBe(
                                mainStyle.getPropertyValue(cssProperty)
                            );
                        }
                        expect(
                            Number.parseFloat(editStyle.getPropertyValue(`border-${side}-width`))
                        ).toBeGreaterThan(0);
                        expect(editStyle.getPropertyValue(`border-${side}-style`)).toBe("solid");
                        expect(editStyle.getPropertyValue(`border-${side}-color`)).not.toBe(
                            "rgba(0, 0, 0, 0)"
                        );
                        expect(editStyle.getPropertyValue(`border-${side}-color`)).not.toBe(
                            "transparent"
                        );
                    }
                    return true;
                },
                {message: "Await themed, unfocused composer backgrounds and borders"}
            )
            .toBe(true);
        expect(model.runs).toHaveLength(0);
    });

    test("hovered seeded user messages expose Edit and no More menu", async ({
        chat,
        storage,
        model
    }) => {
        const answer = "The answer for user action visibility.";
        const thread = buildLinearThread({
            id: crypto.randomUUID(),
            turns: [{user: "Inspect user actions.", assistant: answer}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, answer);
        const message = driver.userMessage(0);
        await message.hover();
        await expect
            .element(message.getByRole("button", {name: "Edit", exact: true}))
            .toBeVisible();
        await expect
            .element(message.getByRole("button", {name: "Edit", exact: true}))
            .toBeEnabled();
        await expect
            .element(message.getByRole("button", {name: /^(More|More options)$/i}))
            .not.toBeInTheDocument();
        expect(model.runs).toHaveLength(0);
    });
});
