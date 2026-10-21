import {handleOpenBlockInLogseq} from "./both-side-handlers/handleOpenBlockInLogseq.js";
import {handleScrollToClozeElement} from "./both-side-handlers/handleScrollToClozeElement.js";
import {handleTagRendering} from "./both-side-handlers/handleTagRendering.js";
import {handleTypeInTagVisibility} from "./both-side-handlers/handleTypeInTagVisibility.js";
import {registerCardHandlers} from "./registerCardHandlers.js";

registerCardHandlers("shared", [
    handleScrollToClozeElement,
    handleOpenBlockInLogseq,
    handleTagRendering,
    handleTypeInTagVisibility
]);
