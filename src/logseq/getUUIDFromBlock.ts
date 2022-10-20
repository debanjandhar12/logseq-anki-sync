import {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";

export default function getUUIDFromBlock(block: BlockEntity): string {
    return _.get(block, "uuid['$uuid$']", null) || _.get(block, "uuid.Wd", null) || _.get(block, "uuid", null) || null;
}