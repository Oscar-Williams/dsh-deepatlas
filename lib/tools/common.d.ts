/**
 * 工具定义共享辅助(对齐 @deepseek-ai/dsh-tools 真实契约,cli-capture/0003)
 *
 * 契约要点(与 dev.to 旧教程不同,以运行时实测为准):
 * - parameters 是普通 spec 对象:{ 名: { type, required?, description? } }
 *   (不是 schemastery 实例);
 * - output 必填:{ schema, render(args, value) => ContentBlock[] },
 *   缺失 render 会在 defineTool 内部崩溃(undefined.render);
 * - schemastery 是默认导出,不是命名导出 Schema。
 */
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
export interface ToolExecutionContext {
    signal?: AbortSignal;
}
export type LosslessJson = null | boolean | number | string | LosslessJson[] | {
    [key: string]: LosslessJson;
};
/**
 * DSH 0.1.1-rc.2 rejects tool results containing `undefined`, class instances,
 * sparse arrays, or non-finite numbers before `output.render` runs. Keep the
 * ergonomic optional fields used internally, but materialize a detached plain
 * JSON value at the tool boundary. Undefined object properties are omitted;
 * undefined array slots become null, matching JSON's data model.
 */
export declare function asLosslessJson<T>(value: T): T;
/** 宽松对象输出 schema(执行结果为 JSON 对象,键不限定;校验器要求显式 additionalProperties) */
export declare const looseObjectOutput: {
    type: "object";
    additionalProperties: true;
    properties: {};
};
/** 统一渲染:把工具返回值序列化为文本块 */
export declare function renderJson(_args: unknown, value: unknown): ContentBlock[];
