import {z} from "zod";
import type {BaseReversibleCommand} from "./BaseReversibleCommand";

type ReversibleCommandConstructor<ArgsInput, CommandState, Command> = new (
    args: ArgsInput,
    commandState?: CommandState
) => Command;

type ReversibleCommandCodecOptions<
    Type extends string,
    ArgsSchema extends z.ZodType,
    CommandStateSchema extends z.ZodType<{status: "new" | "executed"}>,
    Command extends BaseReversibleCommand<z.output<CommandStateSchema>> & {
        readonly args: z.output<ArgsSchema>;
    }
> = {
    type: Type;
    argsSchema: ArgsSchema;
    commandStateSchema: CommandStateSchema;
    commandClass: ReversibleCommandConstructor<
        z.input<ArgsSchema>,
        z.input<CommandStateSchema>,
        Command
    >;
};

export function createReversibleCommandCodec<
    Type extends string,
    ArgsSchema extends z.ZodType,
    CommandStateSchema extends z.ZodType<{status: "new" | "executed"}>,
    Command extends BaseReversibleCommand<z.output<CommandStateSchema>> & {
        readonly args: z.output<ArgsSchema>;
    }
>(options: ReversibleCommandCodecOptions<Type, ArgsSchema, CommandStateSchema, Command>) {
    const serializedSchema = z.object({
        type: z.literal(options.type),
        args: options.argsSchema,
        commandState: options.commandStateSchema
    });

    return z.codec(serializedSchema, z.instanceof(options.commandClass), {
        decode: (data) => {
            const {args, commandState} = data as {
                args: z.input<ArgsSchema>;
                commandState: z.input<CommandStateSchema>;
            };
            return new options.commandClass(args, commandState);
        },
        encode: (command) => ({
            type: options.type,
            args: command.args,
            commandState: command.getCommandState()
        })
    });
}
