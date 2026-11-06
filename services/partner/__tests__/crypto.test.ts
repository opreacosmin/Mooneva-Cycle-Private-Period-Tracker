import { describe, expect, it } from 'vitest';
import { blobId, encrypt, importKey, newKey } from '../crypto';

const decrypt = async (b64: string, ct: string): Promise<unknown> => {
    const key = await crypto.subtle.importKey(
        'raw',
        Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
        { name: 'AES-GCM', length: 256 },
        true,
        ['decrypt'],
    );
    const buf = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: buf.slice(0, 12) },
        key,
        buf.slice(12),
    );
    return JSON.parse(new TextDecoder().decode(pt));
};

describe('partner crypto', () => {
    it('roundtrips', async () => {
        const b64 = await newKey();
        const key = await importKey(b64);
        const obj = { phase: 'luteal', dayOfCycle: 22, inEstimatedFertileWindow: false };
        expect(await decrypt(b64, await encrypt(key, obj))).toEqual(obj);
    });

    it('produces different keys and blob ids', async () => {
        const a = await newKey();
        const b = await newKey();
        expect(a).not.toBe(b);
        expect(await blobId(await importKey(a))).not.toBe(await blobId(await importKey(b)));
    });
});
