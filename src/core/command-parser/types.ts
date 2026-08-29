import type {CommandFileData} from "../stores/command-file-store/types";

export type {CommandInvokeCondition} from "../stores/command-file-store/types";

export type CommandFrontmatterDataKey = Exclude<keyof CommandFileData, "content">;

export type CommandFrontmatterFieldDefinition = {
    [K in CommandFrontmatterDataKey]: {
        key: string;
        dataKey: K;
        valueType: NonNullable<CommandFileData[K]> extends readonly string[]
            ? "string-array"
            : NonNullable<CommandFileData[K]> extends boolean
              ? "boolean"
              : "string";
        required?: boolean;
    };
}[CommandFrontmatterDataKey];

export type CommandFrontmatterValues = Partial<Pick<CommandFileData, CommandFrontmatterDataKey>>;
