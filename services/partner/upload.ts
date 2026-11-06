import { blobId } from './crypto';

const RELAY_BASE_URL = 'https://partner-relay.mooneva-relay.workers.dev';


export const uploadPayload = async (key: CryptoKey, ciphertext: string): Promise<void> => {
    const id = await blobId(key);
    const res = await fetch(`${RELAY_BASE_URL}/blob/${id}`, {
        method: 'PUT',
        body: ciphertext,
        headers: { 'content-type': 'text/plain' },
    });
    if (!res.ok) throw new Error(`Relay rejected the upload (${res.status})`);
};
