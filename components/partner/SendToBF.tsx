import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useMooneva } from '../../contexts/MoonevaContext';
import { buildPartnerPayload } from '../../services/partner/payload';
import { blobId, encrypt, importKey, newKey } from '../../services/partner/crypto';
import {
    clearAll,
    loadKey,
    loadLastSentAt,
    saveBlobId,
    saveKey,
    saveLastSentAt,
} from '../../services/partner/storage';
import { uploadPayload } from '../../services/partner/upload';

interface SendToBFProps {
    onBack: () => void;
}

const ago = (ts: number | null): string => {
    if (!ts) return 'never';
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    return m < 1 ? 'just now' : `${m} min ago`;
};

export const SendToBF: React.FC<SendToBFProps> = ({ onBack }) => {
    const { logs, periods, settings } = useMooneva();
    const [keyB64, setKeyB64] = useState<string | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [lastSentAt, setLastSentAt] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ensureKey = useCallback(async (): Promise<string> => {
        const stored = await loadKey();
        if (stored) return stored;
        const fresh = await newKey();
        await saveKey(fresh);
        await saveBlobId(await blobId(await importKey(fresh)));
        return fresh;
    }, []);

    useEffect(() => {
        (async () => {
            setKeyB64(await ensureKey());
            setLastSentAt(await loadLastSentAt());
        })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, [ensureKey]);

    useEffect(() => {
        if (!keyB64) return;
        QRCode.toDataURL(keyB64, { width: 220, margin: 1 })
            .then(setQr)
            .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, [keyB64]);

    const send = useCallback(async () => {
        if (!keyB64) return;
        setSending(true);
        setError(null);
        try {
            const key = await importKey(keyB64);
            const payload = buildPartnerPayload(logs, periods, settings, note);
            await uploadPayload(key, await encrypt(key, payload));
            const now = Date.now();
            await saveLastSentAt(now);
            setLastSentAt(now);
            setNote('');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSending(false);
        }
    }, [keyB64, logs, periods, settings, note]);

    const disconnect = useCallback(async () => {
        if (!confirm("Disconnect? He'll need your code again to reconnect.")) return;
        await clearAll();
        const fresh = await ensureKey();
        setKeyB64(fresh);
        setLastSentAt(null);
    }, [ensureKey]);

    return (
        <div className="h-full flex flex-col bg-[#F0F2F5] overflow-y-auto">
            <div className="flex items-center gap-4 p-6 pb-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500"
                >
                    <span className="text-xl rtl:rotate-180">←</span>
                </button>
                <h2 className="text-lg font-extrabold text-slate-700 tracking-tight">Send to BF</h2>
            </div>

            <div className="p-6 pt-0 space-y-6 max-w-lg mx-auto w-full">
                <section className="bg-white/60 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-700">Show this to him</h3>
                    <p className="text-xs text-slate-500">
                        Show this to him in person. Don't screenshot or text it. He'll paste it once.
                    </p>
                    <div className="flex justify-center">
                        {qr ? (
                            <img src={qr} alt="Your code" className="w-[220px] h-[220px]" />
                        ) : (
                            <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-slate-400">
                                Generating…
                            </div>
                        )}
                    </div>
                    {keyB64 && (
                        <p className="text-[10px] text-slate-400 break-all select-all text-center">{keyB64}</p>
                    )}
                </section>

                <section className="bg-white/60 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-700">Last sent: {ago(lastSentAt)}</h3>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Note to BF (optional)"
                        maxLength={200}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#7598a0]"
                    />
                    {error && <p className="text-xs text-rose-600">{error}</p>}
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={sending || !keyB64}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#7598a0] disabled:opacity-50"
                    >
                        {sending ? 'Sending…' : 'Send update'}
                    </button>
                    <button
                        type="button"
                        onClick={() => void disconnect()}
                        className="w-full py-2 text-xs text-slate-500"
                    >
                        Disconnect
                    </button>
                </section>
            </div>
        </div>
    );
};
