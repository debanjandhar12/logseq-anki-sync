import {v5 as uuidv5} from "uuid";

export class DeterminesticUUIDGenerator {
    private invocationCount = 0;

    constructor(private readonly seed: string) {}

    public getUUID(): string {
        this.invocationCount += 1;
        return uuidv5(String(this.invocationCount), this.seed);
    }
}
