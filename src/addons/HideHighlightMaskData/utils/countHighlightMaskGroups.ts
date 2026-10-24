import {ObjectPropertyDataManager} from "../../../utils/ObjectPropertyDataManager";

export function countHighlightMaskGroups(value: unknown): number | null {
    // DB properties may be singleton collections of serialized block references.
    if (Array.isArray(value)) return value.length === 1 ? countHighlightMaskGroups(value[0]) : null;
    if (typeof value === "object" && value !== null && "title" in value) {
        return countHighlightMaskGroups(value.title);
    }
    // UUID-only references require a fresh block read, not a decode attempt.
    if (typeof value !== "string" || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value))
        return null;
    const data = ObjectPropertyDataManager.load(
        {properties: {highlight_mask: value}},
        "highlight_mask"
    );
    if (!data || Array.isArray(data) || !("elements" in data) || !Array.isArray(data.elements))
        return null;

    const ids = new Set<number>();
    for (const element of data.elements) {
        const id = element?.cId;
        if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.add(id);
    }
    return ids.size;
}
