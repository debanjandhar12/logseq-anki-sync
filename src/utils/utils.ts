import ohm from "ohm-js";
import _, {isArray} from "lodash";
import replaceAsync from "string-replace-async";
import "@logseq/libs";
import {
    ANKI_CLOZE_REGEXP,
    MD_MATH_BLOCK_REGEXP,
    OhmStrToListGrammar,
    specialChars,
    WARNING_ICON,
} from "../constants";
import {ActionNotification} from "../ui/general/ActionNotification";

export function regexPraser(input: string): RegExp {
    if (typeof input !== "string") {
        throw new Error("Invalid input. Input must be a string");
    }
    // Parse input
    const m = input.match(/(\/)(.+)\1([a-z]*)/i);
    // Invalid input (input not in format /regex/i)
    if (m == null) throw "Input string is not in required format for conversion to regex.";
    // Invalid flags
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
        return RegExp(input);
    }
    // Create the regular expression
    return new RegExp(m[2], m[3]);
}

export function escapeClozeAndSecoundBrace(input: string): string {
    return input
        .replace(ANKI_CLOZE_REGEXP, "$3")
        .replace(/(?<= )(.*)::/g, (match, g1) => `${g1}:\u{2063}:`)
        .replace(/(?<= )(.*)::/g, (match, g1) => `${g1}:\u{2063}:`)
        .replace(/}}/g, "}\u{2063}}")
        .replace(/}}/g, "}\u{2063}}");
}

export function string_to_arr(str: string): any {
    const r = [];

    // Define and match the grammer
    const matchResult = OhmStrToListGrammar.match(str);
    if (matchResult.failed()) {
        throw "Cannot parse array list from string";
        return r;
    }

    // Define and assciate semantic actions with grammar
    const actions = {
        Exp(a, b) {
            a.semanticOperation();
            b.semanticOperation();
        },
        nonemptyListOf(a, b, c) {
            a.semanticOperation();
            c.semanticOperation();
        },
        emptyListOf() {},
        _iter(...a) {
            for (const b of a) b.semanticOperation();
        },
        separator(a, b, c) {},
        StrOrRegex(a) {
            a.semanticOperation();
        },
        _terminal() {},
        Regex(a, b, c, d) {
            r.push(regexPraser(this.sourceString));
        },
        Str(a, b, c) {
            r.push(this.children[1].sourceString);
        },
    };
    const s = OhmStrToListGrammar.createSemantics();
    s.addOperation("semanticOperation", actions);
    s(matchResult).semanticOperation();
    return r;
}

export function decodeHTMLEntities(text, exclude = ["gt", "lt"]) {
    let entities = [
        ["amp", "&"],
        ["apos", "'"],
        ["#x27", "'"],
        ["#x2F", "/"],
        ["#39", "'"],
        ["#47", "/"],
        ["lt", "<"],
        ["gt", ">"],
        ["nbsp", " "],
        ["quot", '"'],
    ];
    entities = entities.filter((e) => !exclude.includes(e[0]));

    for (let i = 0, max = entities.length; i < max; ++i)
        text = text.replace(new RegExp("&" + entities[i][0] + ";", "g"), entities[i][1]);

    return text;
}

export function get_math_inside_md(content: string): Array<string> {
    let res = content;
    const arr = [];
    res = res.replace(MD_MATH_BLOCK_REGEXP, (match) => {
        arr.push(match);
        return "\\( $1 \\)";
    });
    res = res.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\S \t\r]*?)\$/g, (match) => {
        arr.push(match);
        return "\\( $1 \\)";
    });
    return arr;
}

export function handleAnkiError(msg: string): void {
    switch (msg) {
        case "failed to issue request":
            ActionNotification(
                [
                    {
                        name: "Installation Guide",
                        func: () =>
                            window.parent.open(
                                "https://github.com/debanjandhar12/logseq-anki-sync#%EF%B8%8F-installation-video",
                            ),
                    },
                ],
                "Please ensure Anki is open in background with AnkiConnect installed properly. Read installation guide for details.",
                5000,
                WARNING_ICON,
            );
            break;
        case "Permission to access anki was denied":
            logseq.UI.showMsg(
                "Please give permission to access anki by clicking yes when prompted.",
                "warning",
                {
                    timeout: 5000,
                },
            );
            break;
        case "collection is not available":
            logseq.UI.showMsg("Please select an anki profile before syncing.", "warning", {
                timeout: 5000,
            });
            break;
    }
}
export function splitNamespace(str: string) {
    const original = str;
    // Find all matches of \[\[.*\]\]
    const matches = str.match(/\[\[.*?\]\]/g);
    // Replace all matches with a random string
    const randomStrings = [];
    if (matches && isArray(matches)) {
        for (const match of matches) {
            randomStrings.push(getRandomUnicodeString());
            str = str.replace(match, randomStrings[randomStrings.length - 1]);
        }
    }
    // Split the string
    const parts = str.split("/");
    // Replace the random strings with the original matches
    for (let i = 0; i < parts.length; i++) {
        for (let j = 0; j < randomStrings.length; j++) {
            parts[i] = parts[i].replace(randomStrings[j], matches[j]);
        }
    }
    console.log(parts);
    return parts;
}

export function getRandomUnicodeString(length?: number): string {
    return _.sampleSize(specialChars, length || 12).join("");
}

export function getFirstNonEmptyLine(str: string): string {
    let start = 0,
        end;
    let current_line_empty = true;
    for (end = 0; end < str.length; end++) {
        if (str[end] != " " && str[end] != "\t" && str[end] != "\n") current_line_empty = false;
        if (str[end] == "\n") {
            if (!current_line_empty) return str.substring(start, end);
            else {
                start = end + 1;
                current_line_empty = true;
            }
        }
    }
    return str.substring(start);
}

// Replace function that avoids replacing inside math and code blocks
export function safeReplace(content: string, regex: RegExp | string, replaceArg: any): string {
    let result = content;
    const hashmap = {};
    result = result.replace(MD_MATH_BLOCK_REGEXP, (match) => {
        // Escape block math
        const str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\S \t\r]*?)\$/g, (match: string) => {
        // Escape inline math
        const str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/(```|~~~)(.*)\n(.|\n)*?\n\1/g, (match) => {
        // Escape code
        const str = getRandomUnicodeString();
        hashmap[str] = match;
        return str;
    });
    result = result.replace(regex, replaceArg);
    for (const key in hashmap) {
        result = result.replace(key, hashmap[key]);
    }
    return result;
}

export async function safeReplaceAsync(
    content: string,
    regex: RegExp | string,
    replaceArg: any,
): Promise<string> {
    let result = content;
    const hashmap = {};
    result = result.replace(MD_MATH_BLOCK_REGEXP, (match) => {
        // Escape block math
        const str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\S \t\r]*?)\$/g, (match: string) => {
        // Escape inline math
        const str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/(```|~~~)(.*)\n(.|\n)*?\n\1/g, (match) => {
        // Escape code
        const str = getRandomUnicodeString();
        hashmap[str] = match;
        return str;
    });
    result = await replaceAsync(result, regex, replaceArg);
    for (const key in hashmap) {
        result = result.replace(key, hashmap[key]);
    }
    return result;
}

export async function sortAsync<T>(arr: T[], score: (a: T) => Promise<number>): Promise<T[]> {
    const toSortPromises = arr.map(async (item) => {
        return {
            item: item,
            score: await score(item),
        };
    });
    return await Promise.all(toSortPromises).then((toSort) => {
        console.log(toSort);
        return toSort
            .sort((a, b) => {
                return a.score - b.score;
            })
            .map((x) => x.item);
    });
}

export function getCaseInsensitive(obj, path, defaultValue) {
    if (!obj) {
        return defaultValue;
    }
    const pathParts = Array.isArray(path) ? path : path.split(".");
    let target = obj;
    for (const part of pathParts) {
        const key = Object.keys(target).find((k) => k.toLowerCase() === part.toLowerCase());
        if (!key) {
            return defaultValue;
        }
        target = target[key];
    }
    return target;
}
