/** 宽松对象输出 schema(执行结果为 JSON 对象,键不限定;校验器要求显式 additionalProperties) */
export const looseObjectOutput = {
    type: 'object',
    additionalProperties: true,
    properties: {},
};
/** 统一渲染:把工具返回值序列化为文本块 */
export function renderJson(_args, value) {
    return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}
//# sourceMappingURL=common.js.map