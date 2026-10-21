import {handleHideAllTestOneTag} from "./front-side-handlers/handleHideAllTestOneTag.js";
import {handleImageOcclusionCanvasRendering} from "./front-side-handlers/handleImageOcclusionCanvasRendering.js";
import {handleTypeInTagTextarea} from "./front-side-handlers/handleTypeInTagTextarea.js";
import {registerCardHandlers} from "./registerCardHandlers.js";

registerCardHandlers(
    "side",
    [handleImageOcclusionCanvasRendering, handleHideAllTestOneTag, handleTypeInTagTextarea],
    "front"
);
