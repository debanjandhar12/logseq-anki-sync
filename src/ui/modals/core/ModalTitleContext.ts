import {createContext} from "react";

/** Links shared modal headers to the dialog's accessible name. */
export const ModalTitleContext = createContext<string | undefined>(undefined);
