import {handleImageOcclusionVisibility} from "./back-side-handlers/handleImageOcclusionVisibility.js";
import {handleTypeInTagResult} from "./back-side-handlers/handleTypeInTagResult.js";
import {registerCardHandlers} from "./registerCardHandlers.js";

registerCardHandlers("side", [handleImageOcclusionVisibility, handleTypeInTagResult], "back");
