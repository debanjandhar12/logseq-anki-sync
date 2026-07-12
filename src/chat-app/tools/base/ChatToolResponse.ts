import {ToolResponse, type ToolResponseLike} from "assistant-stream";
import type {ReadonlyJSONValue} from "assistant-stream/utils";

export type ChatToolSuccessResult<TData extends Record<string, unknown> = Record<string, unknown>> =
    {
        success: true;
    } & TData;

export type ChatToolErrorResult = {success: false; error: string};

export type ChatToolResult = ChatToolSuccessResult | ChatToolErrorResult;

type SuccessData<TData extends Record<string, unknown>> = TData & {
    success?: never;
    error?: never;
};

export class ChatToolResponse<TResult extends ChatToolResult> extends ToolResponse<TResult> {
    private constructor(options: ToolResponseLike<TResult>) {
        super(options);
    }

    static success(): ChatToolResponse<ChatToolSuccessResult>;
    static success<TData extends Record<string, unknown>>(
        data: SuccessData<TData>,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ChatToolSuccessResult<TData>>;
    static success<TData extends Record<string, unknown>>(
        data?: SuccessData<TData>,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ChatToolSuccessResult<TData>> {
        const result = {...data, success: true as const} as ChatToolSuccessResult<TData>;
        return new ChatToolResponse<ChatToolSuccessResult<TData>>({result, artifact});
    }

    static error(
        error: string,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ChatToolErrorResult> {
        return new ChatToolResponse<ChatToolErrorResult>({
            result: {success: false, error},
            artifact,
            isError: true
        });
    }
}
