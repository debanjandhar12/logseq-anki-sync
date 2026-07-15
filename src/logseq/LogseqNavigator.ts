export class LogseqNavigator {
    static goToBlock(uuid: string): void {
        logseq.App.pushState("page", {name: uuid});
    }
}
