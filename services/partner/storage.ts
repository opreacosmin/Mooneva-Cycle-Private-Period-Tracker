import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { deriveSharedKey, exportPublicKey, generateKeyPair, importPublicKey } from './crypto';

const PRIVATE_KEY = 'mooneva_partner_private_jwk';
const OWN_PUBLIC_KEY = 'mooneva_partner_public_key';
const PEER_PUBLIC_KEY = 'mooneva_partner_peer_public_key';
const BLOB_ID_KEY = 'mooneva_partner_blob_id';
const LAST_SENT_KEY = 'mooneva_partner_last_sent_at';
const INCLUDE_FERTILE_KEY = 'mooneva_partner_include_fertile';

const isKeyNotFoundError = (error: unknown): boolean => {
    const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
    return message.toLowerCase().includes('does not exist');
};

const readSecure = async (key: string): Promise<string | null> => {
    try {
        const result = await SecureStoragePlugin.get({ key });
        return result.value;
    } catch (error) {
        if (isKeyNotFoundError(error)) return null;
        throw error;
    }
};

const writeSecure = async (key: string, value: string): Promise<void> => {
    await SecureStoragePlugin.set({ key, value });
};

export interface PartnerKeyPair {
    privateKey: CryptoKey;
    publicKeyB64: string;
}

export const loadOrCreateOwnKeyPair = async (): Promise<PartnerKeyPair> => {
    const [privateJwk, publicKeyB64] = await Promise.all([
        readSecure(PRIVATE_KEY),
        readSecure(OWN_PUBLIC_KEY),
    ]);

    if (privateJwk && publicKeyB64) {
        const privateKey = await crypto.subtle.importKey(
            'jwk',
            JSON.parse(privateJwk) as JsonWebKey,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits'],
        );
        return { privateKey, publicKeyB64 };
    }

    const keyPair = await generateKeyPair();
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const ownPublicKeyB64 = await exportPublicKey(keyPair.publicKey);

    await writeSecure(PRIVATE_KEY, JSON.stringify(privateKeyJwk));
    await writeSecure(OWN_PUBLIC_KEY, ownPublicKeyB64);

    return { privateKey: keyPair.privateKey, publicKeyB64: ownPublicKeyB64 };
};

export const storePeerPublicKey = async (publicKeyB64: string): Promise<void> => {
    await writeSecure(PEER_PUBLIC_KEY, publicKeyB64);
};

export const loadPartnerBlobId = async (): Promise<string | null> =>
    readSecure(BLOB_ID_KEY);

export const savePartnerBlobId = async (blobId: string): Promise<void> => {
    await writeSecure(BLOB_ID_KEY, blobId);
};

export const loadSharedKey = async (): Promise<CryptoKey | null> => {
    const peerPublicKeyB64 = await readSecure(PEER_PUBLIC_KEY);
    if (!peerPublicKeyB64) return null;

    const ownKeys = await loadOrCreateOwnKeyPair();
    const peerPublicKey = await importPublicKey(peerPublicKeyB64);
    return deriveSharedKey(ownKeys.privateKey, peerPublicKey);
};

export interface PartnerPreferences {
    includeFertileWindow: boolean;
    lastSentAt: number | null;
}

export const loadPartnerPreferences = (): PartnerPreferences => {
    const include = localStorage.getItem(INCLUDE_FERTILE_KEY);
    const lastSent = Number(localStorage.getItem(LAST_SENT_KEY));

    return {
        includeFertileWindow: include === null ? true : include === 'true',
        lastSentAt: Number.isFinite(lastSent) && lastSent > 0 ? lastSent : null,
    };
};

export const saveIncludeFertileWindow = (include: boolean): void => {
    localStorage.setItem(INCLUDE_FERTILE_KEY, String(include));
};

export const saveLastSentAt = (timestamp: number): void => {
    localStorage.setItem(LAST_SENT_KEY, String(timestamp));
};
