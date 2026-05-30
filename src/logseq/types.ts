import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";

/**
 * Utility types.
 */

// Utility type for some places where we store the page tree inside the children prop.
export type PageEntityWithBlockChildren = Omit<PageEntity, "children"> & {
    children?: Array<PageEntity | BlockEntity>;
};
