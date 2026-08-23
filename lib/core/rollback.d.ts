export interface ProfileSnapshot {
    profileDir: string;
    snapshotDir: string;
    files: string[];
    absent: string[];
    at: string;
}
export declare function snapshotProfile(profileDir: string): Promise<ProfileSnapshot>;
export declare function restoreProfile(snap: ProfileSnapshot): Promise<{
    restored: string[];
}>;
/** 丢弃快照(安装成功后调用,不留垃圾) */
export declare function discardSnapshot(snap: ProfileSnapshot): Promise<void>;
