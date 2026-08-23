export interface ProfileSnapshot {
    profileDir: string;
    files: string[];
    at: string;
}
export declare function snapshotProfile(profileDir: string): Promise<ProfileSnapshot>;
export declare function restoreProfile(snap: ProfileSnapshot): Promise<{
    restored: string[];
}>;
/** 丢弃快照(安装成功后调用,不留垃圾) */
export declare function discardSnapshot(profileDir: string): Promise<void>;
