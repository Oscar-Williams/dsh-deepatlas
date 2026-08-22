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
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

/** 宽松对象输出 schema(执行结果为 JSON 对象,键不限定;校验器要求显式 additionalProperties) */
export const looseObjectOutput = {
  type: 'object' as const,
  additionalProperties: true as const,
  properties: {},
}

/** 统一渲染:把工具返回值序列化为文本块 */
export function renderJson(_args: unknown, value: unknown): ContentBlock[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }] as ContentBlock[]
}
