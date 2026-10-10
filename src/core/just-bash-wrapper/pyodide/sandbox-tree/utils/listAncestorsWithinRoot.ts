export function listAncestorsWithinRoot(path: string, root: string): string[] {
    const ancestors: string[] = [];
    let ancestor = path.slice(0, path.lastIndexOf("/")) || "/";
    while (ancestor === root || ancestor.startsWith(root === "/" ? "/" : `${root}/`)) {
        ancestors.push(ancestor);
        if (ancestor === root || ancestor === "/") break;
        ancestor = ancestor.slice(0, ancestor.lastIndexOf("/")) || "/";
    }
    return ancestors;
}
