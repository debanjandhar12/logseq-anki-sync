/**
 * Used to compare typed answers.
 * It is introduced because every anki client has its own way of comparing typed answers.
 * Also, anki-web doesn't even support typed answer. Inconvenient!
 * This function is based on the anki desktop's way of comparing typed answers.
 * Based on: https://github.com/ankitects/anki/blob/8fc4225b2965da81adcbd1687d0ff5a4d6ac2030/rslib/src/typeanswer.rs#L32
 */
import difflib from "difflib";

export function compareAnswer(expected, provided) {
    const diffContext = new DiffContext(expected, provided);
    return diffContext.toHtml();
}

function prepareExpected(expected) {
    let withoutNewlines = expected.replace(/\r?\n/g, " ");
    let withoutOuterWhitespace = withoutNewlines.trim();
    return normalizeToNFC(withoutOuterWhitespace);
}

function prepareProvided(provided) {
    let withoutOuterWhitespace = provided.trim();
    return normalizeToNFC(withoutOuterWhitespace);
}

class DiffContext {
    constructor(expected, provided) {
        this.expected = prepareExpected(expected);
        this.provided = prepareProvided(provided);
    }

    toTokens() {
        const matcher = new difflib.SequenceMatcher(
            null,
            this.provided,
            this.expected,
        );
        const opcodes = matcher.getOpcodes();
        const provided = [];
        const expected = [];

        for (const opcode of opcodes) {
            switch (opcode[0]) {
                case "equal":
                    const equalText = this.provided.slice(opcode[1], opcode[2]);
                    provided.push(DiffToken.good(equalText));
                    expected.push(DiffToken.good(equalText));
                    break;
                case "delete":
                    const deleteText = this.provided.slice(opcode[1], opcode[2]);
                    provided.push(DiffToken.bad(deleteText));
                    break;
                case "insert":
                    const insertText = this.expected.slice(opcode[3], opcode[4]);
                    const missingText = "-".repeat(insertText.length);
                    provided.push(DiffToken.missing(missingText));
                    expected.push(DiffToken.missing(insertText));
                    break;
                case "replace":
                    const replaceProvidedText = this.provided.slice(opcode[1], opcode[2]);
                    const replaceExpectedText = this.expected.slice(opcode[3], opcode[4]);
                    provided.push(DiffToken.bad(replaceProvidedText));
                    expected.push(DiffToken.missing(replaceExpectedText));
                    break;
                default:
                    throw new Error(`Unexpected opcode: ${opcode[0]}`);
            }
        }

        return new DiffOutput(provided, expected);
    }

    toHtml() {
        const output = this.toTokens();
        const provided = renderTokens(output.provided);
        const expected = renderTokens(output.expected);

        if (this.provided.length === 0) {
            return `<code id="typeans">${escapeHtml(this.expected)}</code>`;
        } else if (this.provided === this.expected) {
            return `<code id="typeans">${provided}</code>`;
        } else {
            return `<code id="typeans">${provided}<br><span id="typearrow">&darr;</span><br>${expected}</code>`;
        }
    }
}

class DiffToken {
    constructor(kind, text) {
        this.kind = kind;
        this.text = text;
    }

    static bad(text) {
        return new DiffToken("bad", text);
    }

    static good(text) {
        return new DiffToken("good", text);
    }

    static missing(text) {
        return new DiffToken("missing", text);
    }
}

class DiffOutput {
    constructor(provided, expected) {
        this.provided = provided;
        this.expected = expected;
    }
}

function renderTokens(tokens) {
    return tokens
        .map((token) => {
            const text = withIsolatedLeadingMark(token.text);
            const encoded = escapeHtml(text);
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

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function withIsolatedLeadingMark(text) {
    const firstChar = text.charAt(0);

    const category = getUnicodeCategory(firstChar);
    if (category.startsWith("M")) {
        // If the first character is a mark, prepend a non-breaking space (U+00A0)
        return "\u00A0" + text;
    }

    return text;
}

function getUnicodeCategory(char) {
    const code = char.codePointAt(0);
    const category = String.fromCodePoint(code).normalize('NFD').charAt(0);
    return category;
}

function normalizeToNFC(text) {
    return text.normalize('NFC');
}