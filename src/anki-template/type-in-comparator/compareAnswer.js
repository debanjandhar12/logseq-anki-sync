/** Compare typed answers consistently across Anki clients. */
import {DiffContext} from "./DiffContext.js";

export function compareAnswer(expected, provided) {
    return new DiffContext(expected, provided).toHtml();
}
