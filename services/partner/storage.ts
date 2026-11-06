import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'partner.keyB64';
const BLOB = 'partner.blobId';
const LAST = 'partner.lastSentAt';

const native = Capacitor.isNativePlatform();

const get = async (key: string): Promise<string | null> => {
    if (native) return (await Preferences.get({ key })).value;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const set = async (key: string, value: string): Promise<void> => {
    if (native) {
        await Preferences.set({ key, value });
        return;
    }
    try {
        localStorage.setItem(key, value);
    } catch {
        // localStorage can throw in private mode or when full — ignore
    }
};

const remove = async (key: string): Promise<void> => {
    if (native) {
        await Preferences.remove({ key });
        return;
    }
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
};

export const loadKey = async (): Promise<string | null> => get(KEY);

export const saveKey = async (b64: string): Promise<void> => {
    await set(KEY, b64);
};

export const loadBlobId = async (): Promise<string | null> => get(BLOB);

export const saveBlobId = async (id: string): Promise<void> => {
    await set(BLOB, id);
};

export const loadLastSentAt = async (): Promise<number | null> => {
    const v = await get(LAST);
    return v ? Number(v) : null;
};

export const saveLastSentAt = async (ts: number): Promise<void> => {
    await set(LAST, String(ts));
};

export const clearAll = async (): Promise<void> => {
    await remove(KEY);
    await remove(BLOB);
    await remove(LAST);
};