import type {page as browserPage} from "vitest/browser";

export interface ViewportSize {
    width: number;
    height: number;
}

export const COMMON_VIEWPORTS: ViewportSize[] = [
    {width: 1280, height: 720},
    {width: 640, height: 720},
    {width: 640, height: 600}
];

export const DEFAULT_VIEWPORT: ViewportSize = {width: 1280, height: 720};

/**
 * Iterate through multiple viewports and execute a callback for each.
 * Automatically resets to the default viewport (1280x720) after completion.
 */
export async function withViewports(
    page: typeof browserPage,
    viewports: ViewportSize[],
    callback: (size: ViewportSize) => Promise<void>
): Promise<void> {
    try {
        for (const size of viewports) {
            await page.viewport(size.width, size.height);
            await callback(size);
        }
    } finally {
        await page.viewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
    }
}

/**
 * Resize viewport and optionally execute a callback.
 */
export async function withViewport(
    page: typeof browserPage,
    size: ViewportSize,
    callback?: (size: ViewportSize) => Promise<void>
): Promise<void> {
    await page.viewport(size.width, size.height);
    if (callback) {
        await callback(size);
    }
}
