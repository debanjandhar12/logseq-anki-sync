export function handleScrollToTop() {
    const scrollToTop = (event) => {
        // Shift + L to scroll to top
        if (event.shiftKey && event.keyCode === 76) window.scroll(0, 0);
    };
    document.addEventListener("keydown", scrollToTop, true);
    return () => document.removeEventListener("keydown", scrollToTop, true);
}
