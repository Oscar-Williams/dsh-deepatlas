export interface ProbeResult {
    valid: boolean;
    /** 无效原因(供 INSTALL_ENVIRONMENT_INVALID 展示) */
    reason?: string;
    /** 命中的祖先 workspace 根 */
    workspaceRoot?: string;
}
/** 从 dir 向上(不含 dir 自身可另议:含自身)查找 pnpm workspace 边界 */
export declare function detectWorkspaceAbsorption(dir: string, stopAt?: string): ProbeResult;
