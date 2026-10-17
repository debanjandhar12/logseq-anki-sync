import path from "path-browserify";

export interface ResolvedGraphAssetPath {
    graphRoot: string;
    fullPath: string;
    graphRelativePath: string;
    assetsRelativePath: string;
}

/** Filesystem paths only. This checks lexical containment, not symlink targets. */
export function resolveGraphAssetPath(
    assetPath: string,
    graphRoot: string
): ResolvedGraphAssetPath {
    const clean = (value: string) => value.replace(/\\/g, "/");
    if (clean(graphRoot).startsWith("//")) throw new Error("UNC graph roots are not supported");
    const root = path.normalize(clean(graphRoot)).replace(/\/$/, "");
    const windows = /^[a-z]:\//i.test(root);
    if (!root || (!root.startsWith("/") && !windows) || root.startsWith("//"))
        throw new Error("A local absolute graph root is required");
    let input = clean(assetPath);
    if (
        !input.trim() ||
        Array.from(input).some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        ) ||
        input.endsWith("/")
    )
        throw new Error("Asset path must identify a file");
    if (input.startsWith("../assets/")) input = input.slice(3);
    if (input.startsWith("./assets/")) input = input.slice(2);
    const absolute = input.startsWith("/") || /^[a-z]:\//i.test(input);
    if (!absolute && !input.startsWith("assets/"))
        throw new Error("Relative asset paths must start with assets/");
    if (input.includes(":") && !/^[a-z]:\/[^:]*$/i.test(input))
        throw new Error("Asset URLs and unsupported path schemes are not allowed");
    const fullPath = path.normalize(absolute ? input : `${root}/${input}`);
    const assetsRoot = `${root}/assets`;
    const compare = (value: string) => (windows ? value.toLowerCase() : value);
    if (!compare(fullPath).startsWith(`${compare(assetsRoot)}/`))
        throw new Error("Asset path must remain inside the current graph's assets directory");
    const assetsRelativePath = fullPath.slice(assetsRoot.length + 1);
    if (windows && assetsRelativePath.split("/").some((segment) => /[. ]$|[<>"|?*]/.test(segment)))
        throw new Error("Invalid Windows asset path");
    if (!assetsRelativePath || /[. ]$/.test(assetsRelativePath))
        throw new Error("Asset path must identify a file");
    return {
        graphRoot: root,
        fullPath,
        graphRelativePath: `assets/${assetsRelativePath}`,
        assetsRelativePath
    };
}
