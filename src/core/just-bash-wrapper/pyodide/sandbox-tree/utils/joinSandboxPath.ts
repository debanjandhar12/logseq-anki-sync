export function joinSandboxPath(parent: string, name: string): string {
    return parent === "/" ? `/${name}` : `${parent}/${name}`;
}
