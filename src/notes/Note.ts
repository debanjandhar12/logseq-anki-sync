import '@logseq/libs'
import { LazyAnkiNoteManager } from '../anki-connect/LazyAnkiNoteManager';
import _, { replace } from 'lodash';
import { HTMLFile } from '../converter/Converter';
import { BlockUUID } from '@logseq/libs/dist/LSPlugin.user';
import getContentDirectDependencies, { PageEntityName, ReferenceDependency } from '../converter/getContentDirectDependencies';
import { LogseqProxy } from '../LogseqProxy';
import pkg from '../../package.json';
import hashSum from 'hash-sum';
import { MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP } from '../constants';

export abstract class Note {
    public uuid: string;
    public content: string;
    public format: string;
    public properties: any;
    public page: any;
    public type: string;
    public ankiId: number;
    static ankiNoteManager: LazyAnkiNoteManager;

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        this.uuid = uuid;
        this.content = content;
        this.format = format;
        this.properties = properties;
        this.page = page;
    }

    public static setAnkiNoteManager(ankiNoteManager: LazyAnkiNoteManager) {
        Note.ankiNoteManager = ankiNoteManager;
    }

    public abstract getClozedContentHTML(): Promise<HTMLFile>;

    public getContent(): string {
        return this.content;
    }

    public getAnkiId(): number {
        if (this.ankiId) return this.ankiId;
        let ankiNotesArr = Array.from(Note.ankiNoteManager.noteInfoMap.values());
        let filteredankiNotesArr = ankiNotesArr.filter((note) => note.fields["uuid-type"].value == `${this.uuid}-${this.type}`);
        if(filteredankiNotesArr.length == 0) this.ankiId = null;
        else this.ankiId = parseInt(filteredankiNotesArr[0].noteId);
        return this.ankiId;
    }

    public getDirectDeendencies(): ReferenceDependency[] {
        return [this.uuid].map(block => ({ type: "Embedded_Block_ref", value: block } as ReferenceDependency));
    }

    public async getAllDependenciesHash(additionalDependencies = []): Promise<string> {
        let toHash = [...additionalDependencies];
        let blockRefDependencies : Set<BlockUUID> = new Set<BlockUUID>();
        let blockEmbededDependencies : Set<BlockUUID> = new Set<BlockUUID>();
        let pageEmbededDependencies : Set<PageEntityName> = new Set<PageEntityName>();

        // DFS to get all dependencies
        let stack : ReferenceDependency[] = this.getDirectDeendencies();
        let parentID = (await LogseqProxy.Editor.getBlock(this.uuid)).parent.id;
        let parent;
        while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            stack.push(parent.uuid["$uuid$"] || parent.uuid.Wd || parent.uuid);
            parentID = parent.parent.id;
        }
        while (stack.length > 0) {
            let dependency = stack.pop();
            if(dependency.type == "Embedded_Block_ref") {
                if(blockEmbededDependencies.has(dependency.value as BlockUUID)) continue;
                blockEmbededDependencies.add(dependency.value as BlockUUID);
                let block = await LogseqProxy.Editor.getBlock(dependency.value as BlockUUID);
                stack.push(...getContentDirectDependencies(_.get(block, 'content',''), _.get(block, 'format','')));
            }
            else if(dependency.type == "Block_ref") {
                if(blockEmbededDependencies.has(dependency.value as BlockUUID) || blockRefDependencies.has(dependency.value as BlockUUID)) continue;
                blockRefDependencies.add(dependency.value as BlockUUID);
                let block = await LogseqProxy.Editor.getBlock(dependency.value as BlockUUID);
                let block_content = _.get(block, 'content','');
                block_content = replace(block_content, MD_PROPERTIES_REGEXP, "");
                block_content = replace(block_content, ORG_PROPERTIES_REGEXP, "");
                let block_content_first_line = block_content.split("\n").find(line => line.trim() != "");
                stack.push(...getContentDirectDependencies(block_content_first_line, _.get(block, 'format','')));
            }
            else if(dependency.type == "Embedded_Page_ref") {
                pageEmbededDependencies.add(dependency.value as PageEntityName);
            }
        }
        for (let uuid of blockEmbededDependencies) {
            let block = await LogseqProxy.Editor.getBlock(uuid);
            toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
        }
        for (let uuid of blockRefDependencies) {
            if(blockEmbededDependencies.has(uuid)) continue;
            let block = await LogseqProxy.Editor.getBlock(uuid);
            let block_content = _.get(block, 'content','');
            block_content = replace(block_content, MD_PROPERTIES_REGEXP, "");
            block_content = replace(block_content, ORG_PROPERTIES_REGEXP, "");
            let block_content_first_line = block_content.split("\n").find(line => line.trim() != "");
            toHash.push({content:block_content_first_line, format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
        }
        for (let PageEntityName of pageEmbededDependencies) {
            let page = await LogseqProxy.Editor.getPage(PageEntityName.name);
            toHash.push({content:_.get(page, 'updatedAt','')});
        }
        toHash.push({page:encodeURIComponent(_.get(this, 'page.originalName', '')), deck:encodeURIComponent(_.get(this, 'page.properties.deck', ''))});
        toHash.push({defaultDeck:logseq.settings.defaultDeck, includeParentContent: logseq.settings.includeParentContent, breadcrumbDisplay: logseq.settings.breadcrumbDisplay});
        toHash.push({v:pkg.version});
        return hashSum(toHash); // hashSum is faster than objectHash but collisions rate is high (here, it suits our case of detecting changes)
    }

    // public static async abstract getBlocksFromLogseq(): Block[];
}
