const ECDH_CURVE = 'P-256';
const AES_KEY_LENGTH = 256;
const IV_BYTES = 12;

const derivedRawKeys = new WeakMap<CryptoKey, Uint8Array>();

const bytesToBase64 = (bytes: Uint8Array): string => {
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 0x8000) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
    }
    return btoa(chunks.join(''));
};

const base64ToBytes = (value: string): Uint8Array =>
    Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

export const generateKeyPair = async (): Promise<CryptoKeyPair> => {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        ['deriveKey', 'deriveBits'],
    );

    return keyPair as CryptoKeyPair;
};

export const exportPublicKey = async (key: CryptoKey): Promise<string> => {
    const spki = await crypto.subtle.exportKey('spki', key);
    return bytesToBase64(new Uint8Array(spki));
};

export const importPublicKey = async (b64: string): Promise<CryptoKey> =>
    crypto.subtle.importKey(
        'spki',
        base64ToBytes(b64),
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        [],
    );

export const deriveSharedKey = async (
    privateKey: CryptoKey,
    publicKey: CryptoKey,
): Promise<CryptoKey> => {
    const bits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: publicKey },
        privateKey,
        AES_KEY_LENGTH,
    );
    const raw = new Uint8Array(bits);

    const sharedKey = await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt'],
    );
    derivedRawKeys.set(sharedKey, raw);
    return sharedKey;
};

export const encryptPayload = async (sharedKey: CryptoKey, obj: unknown): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const encoded = new TextEncoder().encode(JSON.stringify(obj));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        encoded,
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return bytesToBase64(combined);
};

export const decryptPayload = async (sharedKey: CryptoKey, b64: string): Promise<unknown> => {
    const combined = base64ToBytes(b64);
    const iv = combined.slice(0, IV_BYTES);
    const data = combined.slice(IV_BYTES);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        data,
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
};

export const blobIdFromKey = async (sharedKey: CryptoKey): Promise<string> => {
    let raw = derivedRawKeys.get(sharedKey);

    if (!raw) {
        try {
            raw = new Uint8Array(await crypto.subtle.exportKey('raw', sharedKey));
        } catch {
            throw new Error('Cannot derive a relay id from a non-extractable shared key');
        }
    }

    const digest = await crypto.subtle.digest('SHA-256', raw);
    return bytesToHex(new Uint8Array(digest)).slice(0, 32);
};
