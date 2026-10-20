import type {OcclusionElement} from "../../launchers/showOcclusionEditor";

export function serializeOcclusionElements(objects: any[]): OcclusionElement[] {
    return objects.map((obj) => {
        // Transform coordinates also account for active selections/groups.
        const matrix = obj.calcTransformMatrix();
        const element: OcclusionElement = {
            left: matrix[4],
            top: matrix[5],
            width: obj.getScaledWidth(),
            height: obj.getScaledHeight(),
            angle: obj.angle,
            cId: obj._objects?.[1]?.text ? parseInt(obj._objects[1].text, 10) : 1
        };
        if (obj.hint) element.hint = obj.hint;
        return element;
    });
}
