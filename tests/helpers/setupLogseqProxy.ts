import "@logseq/libs";
import proxyLogseq from "logseq-proxy";
import {beforeEach} from "vitest";
import type {PluginSettings} from "../../src/settings";
import {MOCK_LOGSEQ_SETTINGS} from "../../src/tests/constants";

const LOGSEQ_REQUEST_INTERVAL_MS = 100;
const LOGSEQ_REQUEST_LOCK_NAME = "logseq-test-api-request";
const LOGSEQ_SETTINGS_STORAGE_KEY = "logseq-ai-chat-test-settings";

interface LogseqRequestQueue {
    tail: Promise<void>;
    nextStartAt: number;
}

const queueByFetch = new WeakMap<typeof globalThis.fetch, LogseqRequestQueue>();

interface LogseqProxyWrapperOptions {
    settings?: Partial<PluginSettings>;
    apiServer?: string;
    apiToken?: string;
}

let defaultSettings: PluginSettings = MOCK_LOGSEQ_SETTINGS;

export function setupLogseqProxy({
    settings = {},
    apiServer = process.env.LOGSEQ_API_SERVER || "http://127.0.0.1:12315",
    apiToken = process.env.LOGSEQ_API_TOKEN || ""
}: LogseqProxyWrapperOptions = {}): void {
    defaultSettings = {...MOCK_LOGSEQ_SETTINGS, ...settings};
    installLogseqRequestQueue(`${apiServer}/api`);
    beforeEach(() => resetLogseqSettings());

    installLogseqProxy({apiServer, apiToken});

    if (typeof logseq === "undefined") return;

    logseq.baseInfo ??= {id: "browser-test"} as typeof logseq.baseInfo;
    logseq.showMainUI = () => undefined;
    logseq.hideMainUI = () => undefined;
    logseq.App = new Proxy(logseq.App, {
        get(target, property, receiver) {
            if (property === "onThemeChanged" || property === "onThemeModeChanged") {
                return () => () => undefined;
            }
            return Reflect.get(target, property, receiver);
        }
    });
}

function installLogseqProxy({apiServer, apiToken}: {apiServer: string; apiToken: string}): void {
    proxyLogseq({
        settings: readPersistedSettings() as unknown as Record<string, unknown>,
        config: {apiServer, apiToken}
    });

    if (typeof logseq === "undefined") return;

    const testLogseq = logseq as typeof logseq & {
        settings: PluginSettings;
        updateSettings: (partialSettings: Partial<PluginSettings>) => Promise<void>;
        onSettingsChanged: (
            listener: (newSettings: PluginSettings, oldSettings: PluginSettings) => void
        ) => () => void;
    };
    const settingsListeners: Array<
        (newSettings: PluginSettings, oldSettings: PluginSettings) => void
    > = [];
    testLogseq.updateSettings = async (partialSettings: Partial<PluginSettings>) => {
        const oldSettings = testLogseq.settings;
        const newSettings = {...oldSettings, ...partialSettings};
        testLogseq.settings = newSettings;
        persistSettings(newSettings);
        for (const listener of settingsListeners) listener(newSettings, oldSettings);
    };
    testLogseq.onSettingsChanged = (listener) => {
        settingsListeners.push(listener);
        return () => {
            const index = settingsListeners.indexOf(listener);
            if (index >= 0) settingsListeners.splice(index, 1);
        };
    };
}

function resetLogseqSettings(): void {
    persistSettings({...defaultSettings});
    if (typeof logseq !== "undefined") {
        (logseq as unknown as {settings: PluginSettings}).settings = {
            ...defaultSettings
        };
    }
}

function readPersistedSettings(): PluginSettings {
    if (typeof localStorage !== "undefined") {
        const persistedSettings = localStorage.getItem(LOGSEQ_SETTINGS_STORAGE_KEY);
        if (persistedSettings) {
            try {
                return JSON.parse(persistedSettings) as PluginSettings;
            } catch {
                localStorage.removeItem(LOGSEQ_SETTINGS_STORAGE_KEY);
            }
        }
    }
    return {...defaultSettings};
}

function persistSettings(settings: PluginSettings): void {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(LOGSEQ_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
}

function installLogseqRequestQueue(logseqApiUrl: string): void {
    const originalFetch = globalThis.fetch;
    if (queueByFetch.has(originalFetch)) return;

    const queue: LogseqRequestQueue = {
        tail: Promise.resolve(),
        nextStartAt: 0
    };

    const queuedFetch: typeof fetch = (input, init) => {
        const requestUrl =
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (requestUrl !== logseqApiUrl) return originalFetch(input, init);

        const request = queue.tail.then(() => {
            if (
                typeof navigator !== "undefined" &&
                typeof navigator.locks !== "undefined" &&
                typeof navigator.locks.request === "function"
            ) {
                return navigator.locks.request(LOGSEQ_REQUEST_LOCK_NAME, () =>
                    runThrottledRequest()
                );
            }
            return runThrottledRequest();
        });

        async function runThrottledRequest(): Promise<Response> {
            const delay = Math.max(0, queue.nextStartAt - Date.now());
            if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
            const requestStartedAt = Date.now();
            queue.nextStartAt = requestStartedAt + LOGSEQ_REQUEST_INTERVAL_MS;
            const response = await originalFetch(input, init);
            const remainingInterval = Math.max(
                0,
                requestStartedAt + LOGSEQ_REQUEST_INTERVAL_MS - Date.now()
            );
            if (remainingInterval > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingInterval));
            }
            return response;
        }

        queue.tail = request.then(
            () => undefined,
            () => undefined
        );
        return request;
    };

    queueByFetch.set(originalFetch, queue);
    globalThis.fetch = queuedFetch;
}
