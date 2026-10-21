export class DiffOutput {
    constructor(provided, expected) {
        this.provided = provided;
        this.expected = expected;
    }
}

export function renderTokens(tokens) {
    return tokens
        .map((token) => {
            const encoded = escapeHtml(withIsolatedLeadingMark(token.text));
            const className =
                token.kind === "good"
                    ? "typeGood"
                    : token.kind === "bad"
                      ? "typeBad"
                      : "typeMissed";
            return `<span class="${className}">${encoded}</span>`;
        })
        .join("");
}

export function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function withIsolatedLeadingMark(text) {
    const category = getUnicodeCategory(text.charAt(0));
    if (category.startsWith("M")) return "\u00A0" + text;
    return text;
}

function getUnicodeCategory(char) {
    const code = char.codePointAt(0);
    return String.fromCodePoint(code).normalize("NFD").charAt(0);
}
