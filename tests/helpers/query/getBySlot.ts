import {type Locator, locators} from "vitest/browser";

declare module "vitest/browser" {
    interface LocatorSelectors {
        getBySlot(slot: string): Locator;
    }
}

locators.extend({
    getBySlot(slot: string) {
        return `css=[data-slot="${CSS.escape(slot)}"]`;
    }
});
