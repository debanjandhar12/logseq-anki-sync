/**
 * Wait for a specified number of animation frames to complete.
 */
export function waitForAnimationFrames(count: number = 2): Promise<void> {
    return new Promise<void>((resolve) => {
        let frames = 0;
        const tick = () => {
            frames++;
            if (frames >= count) {
                resolve();
            } else {
                requestAnimationFrame(tick);
            }
        };
        requestAnimationFrame(tick);
    });
}

/**
 * Wait for a single animation frame.
 */
export function waitForAnimationFrame(): Promise<void> {
    return waitForAnimationFrames(1);
}

/**
 * Wait for two animation frames (commonly needed for CSS transitions).
 */
export function waitForAnimationFramesDouble(): Promise<void> {
    return waitForAnimationFrames(2);
}
