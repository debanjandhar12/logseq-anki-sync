import {hash} from "hash-it";

export default function objectHashOptimized(obj: any) {
    return hash(obj);
}
