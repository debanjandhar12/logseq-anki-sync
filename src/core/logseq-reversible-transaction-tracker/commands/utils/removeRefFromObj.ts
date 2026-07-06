export function removeRefFromObj<T extends object>(obj: T): T {
    const {refs: _refs, ...objWithoutRefs} = obj as T & {refs?: unknown};
    return objWithoutRefs as T;
}
