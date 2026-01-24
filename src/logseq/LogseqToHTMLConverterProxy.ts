// Re-export from the main converter file
export { LogseqToHtmlConverterProxy as LogseqToHtmlConverter } from "./LogseqToHtmlConverter";
export type { HTMLFile } from "./LogseqToHtmlConverter";

// Export cached convertToHTMLFile
import { LogseqToHtmlConverterProxy } from "./LogseqToHtmlConverter";
export const convertToHTMLFile = LogseqToHtmlConverterProxy.convertToHTMLFile;

