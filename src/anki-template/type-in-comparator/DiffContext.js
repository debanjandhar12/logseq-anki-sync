/**
 * Used to compare typed answers.
 * It is introduced because every anki client has its own way of comparing typed answers.
 * Also, anki-web doesn't even support typed answer. Inconvenient!
 * This function is based on the anki desktop's way of comparing typed answers.
 * Based on: https://github.com/ankitects/anki/blob/8fc4225b2965da81adcbd1687d0ff5a4d6ac2030/rslib/src/typeanswer.rs#L32
 */
import difflib from "difflib";
import {DiffOutput, escapeHtml, renderTokens} from "./DiffOutput.js";
import {DiffToken} from "./DiffToken.js";

function prepareExpected(expected) {
    if (expected == null) return "";
    const withoutNewlines = expected.replace(/\r?\n/g, " ");
    const withoutOuterWhitespace = withoutNewlines.trim();
    return normalizeToNFC(withoutOuterWhitespace);
}

function prepareProvided(provided) {
    if (provided == null) return "";
    const withoutOuterWhitespace = provided.trim();
    return normalizeToNFC(withoutOuterWhitespace);
}

export class DiffContext {
    constructor(expected, provided) {
        this.expected = prepareExpected(expected);
        this.provided = prepareProvided(provided);
    }

    toTokens() {
        const matcher = new difflib.SequenceMatcher(null, this.provided, this.expected);
        const opcodes = matcher.getOpcodes();
        const provided = [];
        const expected = [];

        for (const opcode of opcodes) {
            switch (opcode[0]) {
                case "equal": {
                    const equalText = this.provided.slice(opcode[1], opcode[2]);
                    provided.push(DiffToken.good(equalText));
                    expected.push(DiffToken.good(equalText));
                    break;
                }
                case "delete": {
                    const deleteText = this.provided.slice(opcode[1], opcode[2]);
                    provided.push(DiffToken.bad(deleteText));
                    break;
                }
                case "insert": {
                    const insertText = this.expected.slice(opcode[3], opcode[4]);
                    const missingText = "-".repeat(insertText.length);
                    provided.push(DiffToken.missing(missingText));
                    expected.push(DiffToken.missing(insertText));
                    break;
                }
                case "replace": {
                    const replaceProvidedText = this.provided.slice(opcode[1], opcode[2]);
                    const replaceExpectedText = this.expected.slice(opcode[3], opcode[4]);
                    provided.push(DiffToken.bad(replaceProvidedText));
                    expected.push(DiffToken.missing(replaceExpectedText));
                    break;
                }
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

function normalizeToNFC(text) {
    return text.normalize("NFC");
}
