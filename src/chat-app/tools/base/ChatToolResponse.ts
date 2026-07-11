import {ToolResponse, type ToolResponseLike} from "assistant-stream";
import type {ReadonlyJSONValue} from "assistant-stream/utils";

export type ToolSuccessResult<TData extends Record<string, unknown> = Record<string, unknown>> = {
    success: true;
} & TData;

export type ToolErrorResult = {success: false; error: string};

export type ToolResult = ToolSuccessResult | ToolErrorResult;

type SuccessData<TData extends Record<string, unknown>> = TData & {
    success?: never;
    error?: never;
};

export class ChatToolResponse<TResult extends ToolResult> extends ToolResponse<TResult> {
    private constructor(options: ToolResponseLike<TResult>) {
        super(options);
    }

    static success(): ChatToolResponse<ToolSuccessResult>;
    static success<TData extends Record<string, unknown>>(
        data: SuccessData<TData>,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ToolSuccessResult<TData>>;
    static success<TData extends Record<string, unknown>>(
        data?: SuccessData<TData>,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ToolSuccessResult<TData>> {
        const result = {...data, success: true as const} as ToolSuccessResult<TData>;
        return new ChatToolResponse<ToolSuccessResult<TData>>({result, artifact});
    }

    static error(error: string, artifact?: ReadonlyJSONValue): ChatToolResponse<ToolErrorResult> {
        return new ChatToolResponse<ToolErrorResult>({
            result: {success: false, error},
            artifact,
            isError: true
        });
    }
}
