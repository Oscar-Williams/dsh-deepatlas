/**
 * DSH 0.1.1-rc.2 rejects tool results containing `undefined`, class instances,
 * sparse arrays, or non-finite numbers before `output.render` runs. Keep the
 * ergonomic optional fields used internally, but materialize a detached plain
 * JSON value at the tool boundary. Undefined object properties are omitted;
 * undefined array slots become null, matching JSON's data model.
 */
export function asLosslessJson(value) {
    const visit = (input, path) => {
        if (input === undefined)
            return undefined;
        if (input === null || typeof input === 'string' || typeof input === 'boolean')
            return input;
        if (typeof input === 'number') {
            if (!Number.isFinite(input))
                throw new TypeError(`${path} contains a non-finite number`);
            return input;
        }
        if (Array.isArray(input)) {
            return input.map((item, index) => visit(item, `${path}[${index}]`) ?? null);
        }
        if (typeof input === 'object') {
            const proto = Object.getPrototypeOf(input);
            if (proto !== Object.prototype && proto !== null) {
                throw new TypeError(`${path} contains a non-plain object`);
            }
            const output = {};
            for (const [key, item] of Object.entries(input)) {
                const converted = visit(item, `${path}.${key}`);
                if (converted !== undefined)
                    output[key] = converted;
            }
            return output;
        }
        throw new TypeError(`${path} contains unsupported ${typeof input}`);
    };
    return visit(value, '$');
}
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