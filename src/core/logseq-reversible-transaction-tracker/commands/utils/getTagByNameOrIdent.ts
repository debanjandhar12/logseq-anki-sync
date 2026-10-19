import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

export async function getTagByNameOrIdent(name: string, ident: string): Promise<PageEntity | null> {
    return (await logseq.Editor.getTag(name)) ?? (await logseq.Editor.getTag(ident));
}
