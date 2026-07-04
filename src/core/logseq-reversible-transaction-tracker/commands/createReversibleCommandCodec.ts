import {z} from "zod";

type ReversibleCommandCodecOptions<Serialized extends {type: string}, Command> = {
    type: Serialized["type"];
    serializedSchema: z.ZodType<Serialized>;
    commandSchema: z.ZodType<Command>;
    decode: (data: Omit<Serialized, "type">) => Command;
    encodeData: (command: Command) => Omit<Serialized, "type">;
};

export function createReversibleCommandCodec<Serialized extends {type: string}, Command>(
    options: ReversibleCommandCodecOptions<Serialized, Command>
) {
    return z.codec(options.serializedSchema, options.commandSchema, {
        decode: ({type: _type, ...data}) => options.decode(data),
        encode: (command) =>
            ({
                type: options.type,
                ...options.encodeData(command as Command)
            }) as Serialized
    });
}
