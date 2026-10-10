import type {PyodideFsStat} from "./PyodideFsStat";

export interface PyodideFS {
    analyzePath(path: string): {exists: boolean};
    chmod(path: string, mode: number): void;
    isDir(mode: number): boolean;
    isFile(mode: number): boolean;
    isLink(mode: number): boolean;
    lstat(path: string): PyodideFsStat;
    mkdirTree(path: string, mode?: number): void;
    readFile(path: string): Uint8Array;
    readdir(path: string): string[];
    rmdir(path: string): void;
    unlink(path: string): void;
    utime(path: string, atime: number, mtime: number): void;
    writeFile(path: string, content: Uint8Array): void;
}
