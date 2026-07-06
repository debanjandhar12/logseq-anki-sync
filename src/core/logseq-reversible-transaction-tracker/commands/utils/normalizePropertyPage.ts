import {removeRefFromObj} from "./removeRefFromObj";

export function normalizePropertyPage<T extends object>(obj: T): T {
    return removeRefFromObj(obj);
}
