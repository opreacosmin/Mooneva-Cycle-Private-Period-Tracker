import { describe, expect, it } from 'vitest';
import {
    blobIdFromKey,
    decryptPayload,
    deriveSharedKey,
    encryptPayload,
    exportPublicKey,
    generateKeyPair,
    importPublicKey,
} from '../crypto';

const tamper = (b64: string): string => {
    const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0x01;
    return btoa(String.fromCharCode(...bytes));
};

describe('partner crypto', () => {
    it('roundtrips a payload through both sides of an ECDH exchange', async () => {
        const alice = await generateKeyPair();
        const bob = await generateKeyPair();

        const alicePublic = await exportPublicKey(alice.publicKey);
        const bobPublic = await exportPublicKey(bob.publicKey);

        const aliceShared = await deriveSharedKey(
            alice.privateKey,
            await importPublicKey(bobPublic),
        );
        const bobShared = await deriveSharedKey(
            bob.privateKey,
            await importPublicKey(alicePublic),
        );

        const payload = {
            v: 1,
            message: 'hello',
            nested: { count: 2, flags: [true, false] },
        };

        const ciphertext = await encryptPayload(aliceShared, payload);
        const decrypted = await decryptPayload(bobShared, ciphertext);

        expect(decrypted).toEqual(payload);
    });

    it('throws when the ciphertext has been tampered with', async () => {
        const alice = await generateKeyPair();
        const bob = await generateKeyPair();

        const aliceShared = await deriveSharedKey(
            alice.privateKey,
            await importPublicKey(await exportPublicKey(bob.publicKey)),
        );
        const bobShared = await deriveSharedKey(
            bob.privateKey,
            await importPublicKey(await exportPublicKey(alice.publicKey)),
        );

        const ciphertext = await encryptPayload(aliceShared, { secret: 'value' });

        await expect(decryptPayload(bobShared, tamper(ciphertext))).rejects.toThrow();
    });

    it('derives the same relay id from the shared key on both sides', async () => {
        const alice = await generateKeyPair();
        const bob = await generateKeyPair();

        const aliceShared = await deriveSharedKey(
            alice.privateKey,
            await importPublicKey(await exportPublicKey(bob.publicKey)),
        );
        const bobShared = await deriveSharedKey(
            bob.privateKey,
            await importPublicKey(await exportPublicKey(alice.publicKey)),
        );

        const aliceId = await blobIdFromKey(aliceShared);
        const bobId = await blobIdFromKey(bobShared);

        expect(aliceId).toBe(bobId);
        expect(aliceId).toHaveLength(32);
        expect(aliceId).toMatch(/^[0-9a-f]{32}$/);
    });
});
