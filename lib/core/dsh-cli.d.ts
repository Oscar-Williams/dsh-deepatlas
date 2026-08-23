export interface DshInvocation {
    command: string;
    args: string[];
}
export declare const DSH_PROFILE_NAME: RegExp;
export declare function isDshProfileName(value: string): boolean;
/**
 * Reuse the exact DSH launcher that owns the current plugin process. This keeps
 * plugin management working when DSH was installed locally and is not on PATH.
 */
export declare function dshInvocation(args: string[], runtime?: {
    argv: string[];
    execPath: string;
    platform: NodeJS.Platform;
}): DshInvocation;
