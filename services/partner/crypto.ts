const IV_BYTES = 12;

const toB64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newKey = async (): Promise<string> => {
    const k = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
    return toB64(new Uint8Array(await crypto.subtle.exportKey('raw', k)));
};

export const importKey = (b64: string): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
    ]);

export const encrypt = async (key: CryptoKey, obj: unknown): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(JSON.stringify(obj)),
        ),
    );
    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv);
    out.set(ct, iv.length);
    return toB64(out);
};

export const blobId = async (key: CryptoKey): Promise<string> => {
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
    return Array.from(digest)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
};
