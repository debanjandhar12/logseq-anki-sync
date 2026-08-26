export interface SkillFileFrontmatterSplit {
    prefix: string;
    body: string;
    matterRange: {from: number; to: number} | null;
}

export function splitSkillFileFrontmatter(source: string): SkillFileFrontmatterSplit {
    const delimiter = "---";
    if (!source.startsWith(delimiter) || source[delimiter.length] === "-") {
        return {prefix: "", body: source, matterRange: null};
    }

    let remaining = source.slice(delimiter.length);
    const initialRemainingLength = remaining.length;
    const languageRaw = remaining.slice(0, remaining.search(/\r?\n/));
    let matterFrom = delimiter.length;

    if (languageRaw.trim()) {
        remaining = remaining.slice(languageRaw.length);
        matterFrom += languageRaw.length;
    }

    const closingToken = "\n---";
    let closingIndex = remaining.indexOf(closingToken);
    if (closingIndex < 0) closingIndex = initialRemainingLength;

    if (closingIndex === initialRemainingLength) {
        return {
            prefix: source,
            body: "",
            matterRange: {from: matterFrom, to: matterFrom + remaining.length}
        };
    }

    const matterTo = matterFrom + closingIndex;
    let bodyFrom = matterTo + closingToken.length;
    if (source[bodyFrom] === "\r") bodyFrom += 1;
    if (source[bodyFrom] === "\n") bodyFrom += 1;

    return {
        prefix: source.slice(0, bodyFrom),
        body: source.slice(bodyFrom),
        matterRange: {from: matterFrom, to: matterTo}
    };
}
