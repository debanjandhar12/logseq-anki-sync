export function handleOpenBlockInLogseq() {
    const action = document.querySelector('[data-card-action="open-block-in-logseq"]');
    const openBlockInLogseq = () => {
        const uuid = action?.getAttribute("data-block-uuid");
        const pageLink = document.querySelector(".breadcrumb2 a");
        const graphPrefix = pageLink?.href.match(/logseq:\/\/graph\/.*\?/);
        if (!uuid || !graphPrefix) return;
        const blockLink = document.createElement("a");
        blockLink.href = `${graphPrefix[0]}block-id=${uuid}`;
        blockLink.click();
    };
    const onKeydown = (event) => {
        // Shift + K to open the current block in Logseq.
        if (event.shiftKey && event.keyCode === 75) openBlockInLogseq();
    };
    action?.addEventListener("click", openBlockInLogseq);
    document.addEventListener("keydown", onKeydown, true);
    return () => {
        action?.removeEventListener("click", openBlockInLogseq);
        document.removeEventListener("keydown", onKeydown, true);
    };
}
