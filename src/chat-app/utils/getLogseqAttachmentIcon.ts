import {
    CircleParkingIcon,
    FileIcon,
    FileTextIcon,
    HashIcon,
    ImageIcon,
    type LucideIcon,
    TextSelectIcon
} from "lucide-react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../runtime/LogseqAttachmentAdapter";

export function getLogseqAttachmentIcon(type: string | null | undefined): LucideIcon | null {
    switch (type) {
        case "image":
            return ImageIcon;
        case LOGSEQ_ATTACHMENT_TYPES.block:
            return TextSelectIcon;
        case LOGSEQ_ATTACHMENT_TYPES.page:
            return FileIcon;
        case LOGSEQ_ATTACHMENT_TYPES.propertyPage:
            return CircleParkingIcon;
        case LOGSEQ_ATTACHMENT_TYPES.tagPage:
            return HashIcon;
        case LOGSEQ_ATTACHMENT_TYPES.pdf:
            return FileTextIcon;
        default:
            return null;
    }
}
