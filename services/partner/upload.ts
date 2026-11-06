import { blobIdFromKey, encryptPayload } from './crypto';

const RELAY_BASE_URL = 'https://REPLACE_ME.workers.dev';
// TODO: set RELAY_BASE_URL to the deployed Cloudflare Worker relay URL.

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

export const uploadPayload = async (
    sharedKey: CryptoKey,
    payload: unknown,
    relayBaseUrl: string = RELAY_BASE_URL,
): Promise<void> => {
    const ciphertext = await encryptPayload(sharedKey, payload);
    const blobId = await blobIdFromKey(sharedKey);

    const response = await fetch(`${normalizeBaseUrl(relayBaseUrl)}/blob/${blobId}`, {
        method: 'PUT',
        body: ciphertext,
        headers: { 'content-type': 'text/plain' },
    });

    if (!response.ok) {
        throw new Error(`Relay upload failed: ${response.status} ${response.statusText}`.trim());
    }
};
