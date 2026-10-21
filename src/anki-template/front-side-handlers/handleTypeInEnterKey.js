export function handleTypeInEnterKey(input) {
    const onKeydown = (event) => {
        if (event.key !== "Enter" && event.keyCode !== 13) return;
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        localStorage.setItem("logseq-prev-typeans", input.value);
        revealAnswer();
    };
    input.addEventListener("keydown", onKeydown);
    return () => input.removeEventListener("keydown", onKeydown);
}

function revealAnswer() {
    try {
        // Anki Desktop (Qt / WebEngine)
        if (typeof pycmd === "function" || typeof pycmd !== "undefined") {
            pycmd("ans");
            return;
        }
        // AnkiDroid (Android WebView)
        if (typeof showAnswer === "function") {
            showAnswer();
            return;
        }
        if (typeof window.showAnswer === "function") {
            window.showAnswer();
            return;
        }
        // AnkiMobile (iOS WKWebView tap simulation)
        if (window.webkit?.messageHandlers?.cb) {
            window.webkit.messageHandlers.cb.postMessage(
                JSON.stringify({scheme: "ankitap", msg: "midCenter"})
            );
            return;
        }
        // AnkiWeb
        document.querySelector("#ansbut, .btn.btn-primary.btn-lg")?.click();
    } catch (_e) {}
}
