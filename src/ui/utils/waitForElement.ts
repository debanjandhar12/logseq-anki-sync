/**
 * Copied from https://stackoverflow.com/a/74271142
 */
export async function waitForElement(xpathSelector, timeout = null, document: HTMLDocument) {
    return new Promise((resolve) => {
        let result = document.evaluate(
            xpathSelector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
        );
        if (result !== null && result.singleNodeValue !== null) {
            return resolve(result.singleNodeValue);
        }

        let timeoutId;
        const observer = new MutationObserver(async () => {
            let result = document.evaluate(
                xpathSelector,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null,
            );
            if (result !== null && result.singleNodeValue !== null) {
                clearTimeout(timeoutId);
                resolve(result.singleNodeValue);
                observer.disconnect();
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true,
        });

        if (timeout) {
            timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, timeout);
        }
    });
}
