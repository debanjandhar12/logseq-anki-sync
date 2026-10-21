const cleanupEventPrefix = "logseq-anki-sync:cleanup:";

/**
 * Install handlers once per card DOM, even when Anki reuses the window.
 * Channels keep shared handlers independent from front/back handlers.
 * Each handler may return a cleanup function for its listeners or resources.
 */
export function registerCardHandlers(channel, handlers, side) {
    let initializedCard;
    let handlerCleanups = [];
    let isDisposed = false;
    const cleanupEvent = cleanupEventPrefix + channel;

    // Re-evaluating a card script replaces the previous runtime in this channel.
    document.dispatchEvent(new Event(cleanupEvent));

    // Subscribe before attempting immediate initialization: a script may run
    // before the card DOM is ready, and subsequent events must retry it.
    const updateHooks = Array.isArray(window.onUpdateHook) ? window.onUpdateHook : undefined;
    document.addEventListener(cleanupEvent, disposeRuntime);
    if (updateHooks) {
        updateHooks.push(initializeCurrentCard);
    } else {
        window.addEventListener("load", initializeCurrentCard);
        if (document.readyState === "complete") initializeCurrentCard();
    }

    return disposeRuntime;

    function initializeCurrentCard() {
        if (isDisposed) return;
        const card = document.getElementById("main-content");
        if (!card) return;
        if (side && !document.querySelector(`.anki-card-${side}-side`)) return;

        // Native load, synthetic load, and Desktop hooks may all fire for one card.
        if (card === initializedCard) return;
        cleanUpCurrentCard();
        initializedCard = card;
        for (const handler of handlers) {
            const cleanup = handler();
            if (typeof cleanup === "function") handlerCleanups.push(cleanup);
        }
    }

    function cleanUpCurrentCard() {
        // Dispose in reverse initialization order, like unwinding a resource stack.
        for (const cleanup of handlerCleanups.reverse()) cleanup();
        handlerCleanups = [];
        initializedCard = undefined;
    }

    function disposeRuntime() {
        if (isDisposed) return;
        isDisposed = true;
        window.removeEventListener("load", initializeCurrentCard);
        document.removeEventListener(cleanupEvent, disposeRuntime);

        // Remove only our callback; Anki or other templates may own the others.
        if (updateHooks) {
            const index = updateHooks.indexOf(initializeCurrentCard);
            if (index !== -1) updateHooks.splice(index, 1);
        }
        cleanUpCurrentCard();
    }
}
