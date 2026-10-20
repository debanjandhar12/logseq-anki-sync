import {afterEach, describe, expect, test, vi} from "vitest";
import {LogseqAppInfoFetcher} from "../../src/logseq/LogseqAppInfoFetcher";
import {getHostReact} from "../../vite-plugins/logseqReactBridgePlugin/hostReact";

describe("Logseq host React selection", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    function mockHost(reactVersion = "19.2.6", domVersion = reactVersion) {
        vi.stubEnv("NODE_ENV", "production");
        vi.spyOn(LogseqAppInfoFetcher, "checkHostAccess").mockReturnValue(true);
        const React = {version: reactVersion};
        const ReactDOM = {version: domVersion, createRoot: vi.fn()};
        vi.stubGlobal("logseq", {Experiments: {React, ReactDOM}});
        return {React, ReactDOM};
    }

    test("selects a compatible host pair without requiring a DB graph", () => {
        const host = mockHost();
        expect(getHostReact()).toEqual(host);
    });

    test("uses the bundled pair for older file-graph hosts", () => {
        mockHost("18.3.1");
        expect(getHostReact()).toBeNull();
    });

    test("rejects mismatched React and ReactDOM versions", () => {
        mockHost("19.2.6", "19.2.3");
        expect(getHostReact()).toBeNull();
    });

    test("uses bundled React in development even when the host is compatible", () => {
        mockHost();
        vi.stubEnv("NODE_ENV", "development");
        expect(getHostReact()).toBeNull();
    });

    test("uses bundled React without accessible host experiments", () => {
        mockHost();
        vi.mocked(LogseqAppInfoFetcher.checkHostAccess).mockReturnValue(false);
        expect(getHostReact()).toBeNull();
    });

    test("accepts other React 19 minor and patch versions when the host pair matches", () => {
        const host = mockHost("19.1.0");
        expect(getHostReact()).toEqual(host);
    });
});
