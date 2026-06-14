import {v5 as uuidv5} from "uuid";

export class DeterministicUUIDGenerator {
    private invocationCount = 0;

    public constructor(private readonly seed: string) {}

    public getUUID(): string {
        this.invocationCount += 1;
        return uuidv5(String(this.invocationCount), this.seed);
    }
}
