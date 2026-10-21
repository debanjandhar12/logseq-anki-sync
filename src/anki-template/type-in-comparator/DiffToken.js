export class DiffToken {
    constructor(kind, text) {
        this.kind = kind;
        this.text = text;
    }
    static bad(text) {
        return new DiffToken("bad", text);
    }
    static good(text) {
        return new DiffToken("good", text);
    }
    static missing(text) {
        return new DiffToken("missing", text);
    }
}
