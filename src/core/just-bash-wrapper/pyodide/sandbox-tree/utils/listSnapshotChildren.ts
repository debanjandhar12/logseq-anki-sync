import type {SandboxSnapshot} from "../types";
import {joinSandboxPath} from "./joinSandboxPath";

export function listSnapshotChildren(snapshot: SandboxSnapshot, directory: string): string[] {
    const prefix = joinSandboxPath(directory, "");
    return [...snapshot.entries.keys()]
        .filter(
            (path) =>
                path.startsWith(prefix) &&
                path !== directory &&
                !path.slice(prefix.length).includes("/")
        )
        .map((path) => path.slice(prefix.length))
        .sort();
}
