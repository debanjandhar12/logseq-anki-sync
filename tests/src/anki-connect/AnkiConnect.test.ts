import "@logseq/libs";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {upsertModel} from "../../../src/anki-connect/AnkiConnect";

type AnkiRequest = {
    action: string;
    version: number;
    params: any;
};

describe("AnkiConnect.upsertModel", () => {
    const modelName = "GraphModel";
    const requiredFields = ["Text", "Extra"];
    const templateFiles = {
        "_logseq_anki_sync.css": "body { color: black; }"
    };

    let requests: AnkiRequest[];
    let handlers: Record<string, (params: any) => any>;

    beforeEach(() => {
        requests = [];
        handlers = {
            createModel: () => null,
            deckNames: () => [],
            modelFieldAdd: () => null,
            modelFieldNames: () => requiredFields,
            modelNames: () => [],
            multi: (params) => params.actions.map(() => ""),
            updateModelTemplates: () => null
        };

        class MockXMLHttpRequest {
            responseText = "";
            private listeners: Record<string, () => void> = {};

            addEventListener(event: string, listener: () => void) {
                this.listeners[event] = listener;
            }

            open() {}

            setRequestHeader() {}

            send(body: string) {
                const request = JSON.parse(body) as AnkiRequest;
                requests.push(request);

                const handler = handlers[request.action];
                if (!handler) {
                    throw new Error(`Unhandled AnkiConnect action: ${request.action}`);
                }

                this.responseText = JSON.stringify({
                    result: handler(request.params),
                    error: null
                });
                this.listeners.load();
            }
        }

        vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("creates and initializes templates for a missing model", async () => {
        handlers.modelNames = () => [];

        await upsertModel(
            modelName,
            requiredFields,
            "front template",
            "back template",
            templateFiles
        );

        expect(requests.map((request) => request.action)).toEqual([
            "modelNames",
            "createModel",
            "updateModelTemplates",
            "multi",
            "multi"
        ]);
        expect(requests[1].params).toMatchObject({
            modelName,
            inOrderFields: requiredFields,
            cardTemplates: [
                {
                    Name: "Card",
                    Front: "front template",
                    Back: "back template"
                }
            ]
        });
    });

    test("preserves templates and media files for an existing model", async () => {
        handlers.modelNames = () => [modelName];
        handlers.modelFieldNames = () => requiredFields;

        await upsertModel(
            modelName,
            requiredFields,
            "front template",
            "back template",
            templateFiles
        );

        expect(requests.map((request) => request.action)).toEqual([
            "modelNames",
            "modelFieldNames"
        ]);
    });

    test("only adds missing required fields on an existing model", async () => {
        handlers.modelNames = () => [modelName];
        handlers.modelFieldNames = () => ["Text", "User Custom Field"];

        await upsertModel(
            modelName,
            requiredFields,
            "front template",
            "back template",
            templateFiles
        );

        expect(requests.map((request) => request.action)).toEqual([
            "modelNames",
            "modelFieldNames",
            "deckNames",
            "modelFieldAdd"
        ]);
        expect(requests[3].params).toEqual({
            modelName,
            fieldName: "Extra"
        });
        expect(requests.map((request) => request.action)).not.toContain("modelFieldRemove");
        expect(requests.map((request) => request.action)).not.toContain("modelFieldReposition");
        expect(requests.map((request) => request.action)).not.toContain("updateModelTemplates");
    });
});
