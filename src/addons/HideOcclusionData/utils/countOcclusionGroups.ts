import {ObjectPropertyDataManager} from "../../../utils/ObjectPropertyDataManager";

export function countOcclusionGroups(value: unknown): number | null {
    // DB properties may be singleton collections of serialized block references.
    if (Array.isArray(value)) return value.length === 1 ? countOcclusionGroups(value[0]) : null;
    if (typeof value === "object" && value !== null && "title" in value) {
        return countOcclusionGroups(value.title);
    }
    // UUID-only references require a fresh block read, not a decode attempt.
    if (typeof value !== "string" || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value))
        return null;
    const data = ObjectPropertyDataManager.load({properties: {occlusion: value}}, "occlusion");
    if (!data || Array.isArray(data)) return null;

    const ids = new Set<number>();
    for (const imageData of Object.values(data)) {
        const elements = Array.isArray(imageData) ? imageData : imageData?.elements;
        if (!Array.isArray(elements)) return null;
        for (const element of elements) {
            const id = element?.cId;
            if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.add(id);
        }
    }
    return ids.size;
}
