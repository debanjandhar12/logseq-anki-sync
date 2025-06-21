import {PageEntity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";

export default function getNameFromPage(page: PageEntity): string {
    return (
        _.get(page, "originalName", null) ||
        _.get(page, "name", null) ||
        null
    );
}
