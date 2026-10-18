import type {ExportedMessageRepository} from "@assistant-ui/react";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect} from "vitest";
import {page} from "vitest/browser";
import {JustBashWrapper} from "../../../src/core/just-bash-wrapper/JustBashWrapper";
import {BashCommand} from "../../../src/core/logseq-reversible-transaction-tracker/commands/BashCommand";
import {isPageSoftDeleted} from "../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {CommandFileStore} from "../../../src/core/stores/command-file-store/CommandFileStore";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {
    expectBranchCounter,
    expectCommand,
    expectOriginalNodesRetained,
    expectTracker,
    nodeWithText,
    trackerAt
} from "../../helpers/chat-scenario/assertions";
import {expectCommitResult} from "../../helpers/chat-scenario/assertions/expectCommit";
import {expectToolResultInPrompt} from "../../helpers/chat-scenario/assertions/expectToolResultInPrompt";
import {findToolPart} from "../../helpers/chat-scenario/assertions/findToolPart";
import {normalizeRepository} from "../../helpers/chat-scenario/assertions/normalizeRepository";
import {waitForSavedConversation} from "../../helpers/chat-scenario/assertions/waitForSavedConversation";
import {test} from "../../helpers/chat-scenario/fixtures";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";
import {toolCallsSegment} from "../../helpers/mock-language-model/builders/toolCallsSegment";

const WORKER_TIMEOUT = 180_000;
const OUTPUT_PREFIX = "SCENARIO_RESULT=";
const FIRST_PAGE = "test-ai-chat-vir-bash-refresh-first";
const SECOND_PAGE = "test-ai-chat-vir-bash-refresh-second";
const REVIEW_PAGE = "test-ai-chat-vir-bash-review";
const GUARD =
    "The current branch has applied uncommitted changes. Do you want to revert them and switch branches?";
const markdown = (name: string, body: string) =>
    `---\nname: ${name}\ninvoke-location:\n  - Logseq Command Center\n---\n${body}`;

async function loadRepository(id: string) {
    return (await ThreadStore.loadThread(id))!.exportedMessageRepository!;
}

async function currentThreadId() {
    await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
    return (await ThreadStore.listThreads())[0].remoteId;
}

function bashOutput(repository: ExportedMessageRepository, callId: string) {
    const part = findToolPart(repository, callId);
    expect(part.isError).not.toBe(true);
    expect(part.result).toMatchObject({success: true, stderr: "", exitCode: 0});
    const {stdout} = part.result as {stdout: string};
    expect(stdout.startsWith("Loading micropip\nLoaded micropip\n")).toBe(true);
    const resultLines = stdout.split("\n").filter((line) => line.startsWith(OUTPUT_PREFIX));
    expect(resultLines).toHaveLength(1);
    return JSON.parse(resultLines[0].slice(OUTPUT_PREFIX.length)) as {
        pageUuid: string;
        blockUuid?: string;
        seed?: string;
    };
}

describe("Advanced virtual Bash environment", () => {
    const cleanup = async () => {
        for (const name of [FIRST_PAGE, SECOND_PAGE, REVIEW_PAGE])
            await deletePagePermanently(name);
    };
    beforeAll(cleanup, 60_000);
    afterAll(cleanup, 60_000);
    // Reset without touching storage; fixture teardown owns restoring the backing store.
    beforeEach(() => JustBashWrapper.resetInstanceForTesting());
    afterEach(() => JustBashWrapper.resetInstanceForTesting());

    test("later-turn refresh cancels without changes, then rolls back both real Bash calls and retains their history", {
        timeout: 480_000
    }, async ({chat, model}) => {
        const commandName = "vir-bash-refresh-command";
        const baseline = markdown(commandName, "Refresh baseline");
        const firstContent = markdown(commandName, "First Bash mutation");
        const secondContent = markdown(commandName, "Second Bash mutation");
        await CommandFileStore.saveCommandFile(baseline);
        const firstRequest = `Use Python to create ${FIRST_PAGE} and update the command.`;
        const secondRequest = `Use Python to create ${SECOND_PAGE} and update the command again.`;
        const firstAnswer = "First real Bash completed.";
        const secondAnswer = "Second real Bash completed.";
        const replacement = "Refreshed later answer after whole-branch rollback.";
        const languageModel = model.respondWith([
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "bash-first",
                            toolName: "bash",
                            input: {
                                command: `python - <<'PY'
import json, logseq_lib
created = await logseq_lib.create_page({"pageName": "${FIRST_PAGE}"})
await logseq_lib.save_command_file({"commandName": "${commandName}", "content": ${JSON.stringify(firstContent)}})
print("${OUTPUT_PREFIX}" + json.dumps({"pageUuid": created["uuid"]}))
PY`
                            }
                        }
                    ])
                ]
            },
            {segments: [textSegment(firstAnswer)]},
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "bash-second",
                            toolName: "bash",
                            input: {
                                command: `python - <<'PY'
import json, logseq_lib
created = await logseq_lib.create_page({"pageName": "${SECOND_PAGE}"})
await logseq_lib.save_command_file({"commandName": "${commandName}", "content": ${JSON.stringify(secondContent)}})
print("${OUTPUT_PREFIX}" + json.dumps({"pageUuid": created["uuid"]}))
PY`
                            }
                        }
                    ])
                ]
            },
            {segments: [textSegment(secondAnswer)]},
            {segments: [textSegment(replacement)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage(firstRequest);
        await expect
            .poll(() => languageModel.doStreamCalls.length, {timeout: WORKER_TIMEOUT})
            .toBe(2);
        const id = await currentThreadId();
        const first = await waitForSavedConversation(id, firstAnswer);
        const firstOutput = bashOutput(first, "bash-first");
        expectTracker(first, 1, 1);
        expect(await logseq.Editor.getPage(FIRST_PAGE)).toMatchObject({uuid: firstOutput.pageUuid});
        expect(isPageSoftDeleted((await logseq.Editor.getPage(firstOutput.pageUuid))!)).toBe(false);
        await expectCommand(commandName, firstContent);
        await driver.sendMessage(secondRequest);
        await expect
            .poll(() => languageModel.doStreamCalls.length, {timeout: WORKER_TIMEOUT})
            .toBe(4);
        const repository = await waitForSavedConversation(id, secondAnswer);
        const secondOutput = bashOutput(repository, "bash-second");
        expect(secondOutput.pageUuid).not.toBe(firstOutput.pageUuid);
        const {location, tracker} = expectTracker(repository, 2, 2);
        expect(location.toolCallId).toBe("bash-second");
        for (const command of tracker.getCommands()) {
            expect(command).toBeInstanceOf(BashCommand);
            expect((command as BashCommand).getCommands()).toHaveLength(2);
        }
        const expectAppliedState = async () => {
            for (const [name, uuid] of [
                [FIRST_PAGE, firstOutput.pageUuid],
                [SECOND_PAGE, secondOutput.pageUuid]
            ]) {
                expect(await logseq.Editor.getPage(name)).toMatchObject({uuid});
                expect(isPageSoftDeleted((await logseq.Editor.getPage(uuid))!)).toBe(false);
            }
            await expectCommand(commandName, secondContent);
        };
        await expectAppliedState();
        for (const [index, callId] of [
            [1, "bash-first"],
            [3, "bash-second"]
        ] as const)
            expectToolResultInPrompt(
                languageModel.doStreamCalls[index].prompt,
                callId,
                findToolPart(repository, callId).result
            );
        const snapshot = normalizeRepository(repository);
        const runs = model.runs.length;
        await driver.clickRefresh(1);
        await expect.element(page.getByText(GUARD, {exact: true})).toBeVisible();
        await driver.confirmModal("cancel");
        expect(normalizeRepository(await loadRepository(id))).toEqual(snapshot);
        expectTracker(await loadRepository(id), 2, 2, location);
        await expectAppliedState();
        await expect
            .element(driver.assistantMessage(1).getByText(secondAnswer, {exact: true}))
            .toBeVisible();
        expect(languageModel.doStreamCalls).toHaveLength(4);
        expect(model.runs).toHaveLength(runs);
        await driver.clickRefresh(1);
        await driver.confirmModal("revert-and-switch");
        await expect
            .poll(() => languageModel.doStreamCalls.length, {timeout: WORKER_TIMEOUT})
            .toBe(5);
        const saved = await waitForSavedConversation(id, replacement);
        expectTracker(saved, 2, 0, location);
        expectOriginalNodesRetained(saved, repository, location);
        expect(saved.messages).toHaveLength(repository.messages.length + 1);
        const regenerated = nodeWithText(saved, replacement);
        expect(regenerated.message.id).not.toBe(nodeWithText(repository, secondAnswer).message.id);
        expect(regenerated.parentId).toBe(nodeWithText(repository, secondAnswer).parentId);
        expect(saved.headId).toBe(regenerated.message.id);
        for (const uuid of [firstOutput.pageUuid, secondOutput.pageUuid])
            expect(isPageSoftDeleted((await logseq.Editor.getPage(uuid))!)).toBe(true);
        await expectCommand(commandName, baseline);
        await expect
            .element(driver.assistantMessage(0).getByText(firstAnswer, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(1).getByText(replacement, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(secondAnswer, {exact: true}))
            .not.toBeInTheDocument();
        await expectBranchCounter(driver.assistantMessage(1), 2);
        const prompt = languageModel.doStreamCalls[4].prompt;
        expectToolResultInPrompt(prompt, "bash-first", findToolPart(saved, "bash-first").result);
        for (const included of [firstRequest, firstAnswer, secondRequest])
            expect(JSON.stringify(prompt)).toContain(included);
        for (const excluded of [secondAnswer, "bash-second"])
            expect(JSON.stringify(prompt)).not.toContain(excluded);
    });

    test("closing and reopening review replays recorded mutations with stable identities, not Python against a changed seed", {
        timeout: 480_000
    }, async ({chat, model}) => {
        const seedName = "vir-bash-review-independent-seed";
        const commandName = "vir-bash-review-mutated-command";
        const baseline = markdown(commandName, "Review baseline");
        const changed = markdown(commandName, "Mutation recorded from seed A");
        await CommandFileStore.saveCommandFile(markdown(seedName, "A"));
        await CommandFileStore.saveCommandFile(baseline);
        const finalAnswer = "Recorded Bash changes committed without rerunning Python.";
        const languageModel = model.respondWith([
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "bash-review",
                            toolName: "bash",
                            input: {
                                command: `python - <<'PY'
import json, logseq_lib
seed = await logseq_lib.read_command_file({"commandName": "${seedName}"})
assert seed["exists"] and seed["content"] == ${JSON.stringify(markdown(seedName, "A"))}, "Python was rerun with a different seed"
created = await logseq_lib.create_page({"pageName": "${REVIEW_PAGE}"})
block = await logseq_lib.insert_block({"parentUuid": created["uuid"], "content": "Created from independent seed A", "sibling": False})
await logseq_lib.save_command_file({"commandName": "${commandName}", "content": ${JSON.stringify(changed)}})
print("${OUTPUT_PREFIX}" + json.dumps({"pageUuid": created["uuid"], "blockUuid": block["uuid"], "seed": "A"}))
PY`
                            }
                        }
                    ])
                ]
            },
            {
                segments: [
                    toolCallsSegment([
                        {toolCallId: "commit", toolName: "logseq_commit_changes", input: {}}
                    ])
                ]
            },
            {segments: [textSegment(finalAnswer)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage(
            "Read the independent seed with Python, create a page and block, update the other command and request commit."
        );
        await expect
            .poll(() => languageModel.doStreamCalls.length, {timeout: WORKER_TIMEOUT})
            .toBe(2);
        await expect
            .element(driver.root.getByRole("button", {name: "Review & Commit", exact: true}))
            .toBeVisible();
        const id = await currentThreadId();
        await expect
            .poll(async () => (await loadRepository(id)).messages.at(-1)?.message.status.type, {
                timeout: WORKER_TIMEOUT
            })
            .toBe("requires-action");
        const repository = await loadRepository(id);
        const output = bashOutput(repository, "bash-review");
        expect(output.seed).toBe("A");
        expect(output.blockUuid).toEqual(expect.any(String));
        const {tracker: appliedTracker, location} = expectTracker(repository, 1, 1);
        expect((appliedTracker.getCommands()[0] as BashCommand).getCommands()).toHaveLength(4);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[1].prompt,
            "bash-review",
            findToolPart(repository, "bash-review").result
        );
        const expectRecordedState = async () => {
            expect(await logseq.Editor.getPage(REVIEW_PAGE)).toMatchObject({uuid: output.pageUuid});
            expect(isPageSoftDeleted((await logseq.Editor.getPage(output.pageUuid))!)).toBe(false);
            expect(await logseq.Editor.getBlock(output.blockUuid!)).toMatchObject({
                uuid: output.blockUuid,
                content: "Created from independent seed A"
            });
            const blocks = await logseq.Editor.getPageBlocksTree(output.pageUuid);
            expect(blocks.map(({uuid}) => uuid)).toContain(output.blockUuid);
            await expectCommand(commandName, changed);
        };
        await expectRecordedState();
        expect(findToolPart(repository, "commit").result).toBeUndefined();
        await driver.reviewAndCommit("close");
        await expect
            .poll(
                async () => trackerAt(await loadRepository(id)).tracker.getAppliedCommandCount(),
                {timeout: WORKER_TIMEOUT}
            )
            .toBe(0);
        const pending = await loadRepository(id);
        expectTracker(pending, 1, 0, location);
        expectOriginalNodesRetained(pending, repository, location);
        expect(pending.messages.at(-1)?.message.status.type).toBe("requires-action");
        expect(findToolPart(pending, "commit").result).toBeUndefined();
        expect(findToolPart(pending, "bash-review").result).toEqual(
            findToolPart(repository, "bash-review").result
        );
        expect(isPageSoftDeleted((await logseq.Editor.getPage(output.pageUuid))!)).toBe(true);
        expect(await logseq.Editor.getBlock(output.blockUuid!)).toBeNull();
        await expectCommand(commandName, baseline);
        expect(languageModel.doStreamCalls).toHaveLength(2);
        await CommandFileStore.saveCommandFile(markdown(seedName, "B"));
        await expectCommand(seedName, markdown(seedName, "B"));
        await driver.reviewAndCommit("commit");
        await expect
            .poll(() => languageModel.doStreamCalls.length, {timeout: WORKER_TIMEOUT})
            .toBe(3);
        const saved = await waitForSavedConversation(id, finalAnswer);
        expectCommitResult(saved, "committed");
        expectTracker(saved, 0, 0);
        expect(saved.messages).toHaveLength(2);
        expect(saved.headId).toBe(saved.messages[1].message.id);
        expect(findToolPart(saved, "bash-review").result).toEqual(
            findToolPart(repository, "bash-review").result
        );
        expect(bashOutput(saved, "bash-review")).toEqual(output);
        await expectRecordedState();
        await expectCommand(seedName, markdown(seedName, "B"));
        expectToolResultInPrompt(
            languageModel.doStreamCalls[2].prompt,
            "bash-review",
            findToolPart(repository, "bash-review").result
        );
        expectToolResultInPrompt(
            languageModel.doStreamCalls[2].prompt,
            "commit",
            findToolPart(saved, "commit").result
        );
        await expect
            .element(driver.assistantMessage(0).getByText(finalAnswer, {exact: true}))
            .toBeVisible();
        expect(languageModel.doStreamCalls).toHaveLength(3);
    });
});
