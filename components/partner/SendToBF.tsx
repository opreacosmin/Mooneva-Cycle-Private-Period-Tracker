import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useMooneva } from '../../contexts/MoonevaContext';
import { blobIdFromKey, importPublicKey } from '../../services/partner/crypto';
import { buildPartnerPayload } from '../../services/partner/payload';
import {
    loadOrCreateOwnKeyPair,
    loadPartnerBlobId,
    loadPartnerPreferences,
    loadSharedKey,
    saveIncludeFertileWindow,
    saveLastSentAt,
    savePartnerBlobId,
    storePeerPublicKey,
} from '../../services/partner/storage';
import { uploadPayload } from '../../services/partner/upload';

interface SendToBFProps {
    onBack: () => void;
}

const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const formatAgo = (timestamp: number): string => {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} d ago`;
};

export const SendToBF: React.FC<SendToBFProps> = ({ onBack }) => {
    const { logs, periods, settings } = useMooneva();

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [ownPublicKey, setOwnPublicKey] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
    const [blobId, setBlobId] = useState<string | null>(null);

    const [peerKeyInput, setPeerKeyInput] = useState('');
    const [pairing, setPairing] = useState(false);
    const [pairError, setPairError] = useState<string | null>(null);

    const [includeFertileWindow, setIncludeFertileWindow] = useState(true);
    const [note, setNote] = useState('');
    const [lastSentAt, setLastSentAt] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const preferences = loadPartnerPreferences();
                if (!cancelled) {
                    setIncludeFertileWindow(preferences.includeFertileWindow);
                    setLastSentAt(preferences.lastSentAt);
                }

                const ownKeys = await loadOrCreateOwnKeyPair();
                if (cancelled) return;
                setOwnPublicKey(ownKeys.publicKeyB64);

                const existingSharedKey = await loadSharedKey();
                if (cancelled || !existingSharedKey) return;
                setSharedKey(existingSharedKey);

                const storedBlobId = await loadPartnerBlobId();
                if (cancelled) return;
                if (storedBlobId) {
                    setBlobId(storedBlobId);
                    return;
                }

                const derivedBlobId = await blobIdFromKey(existingSharedKey);
                await savePartnerBlobId(derivedBlobId);
                if (!cancelled) setBlobId(derivedBlobId);
            } catch (error) {
                if (!cancelled) setLoadError(errorMessage(error));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!ownPublicKey) return;

        let cancelled = false;
        QRCode.toDataURL(ownPublicKey, { width: 220, margin: 1 })
            .then((url) => {
                if (!cancelled) setQrDataUrl(url);
            })
            .catch((error: unknown) => {
                if (!cancelled) setLoadError(errorMessage(error));
            });

        return () => { cancelled = true; };
    }, [ownPublicKey]);

    const handlePair = useCallback(async () => {
        const trimmed = peerKeyInput.trim();
        if (!trimmed) {
            setPairError('Paste your partner’s public key first.');
            return;
        }

        setPairing(true);
        setPairError(null);
        try {
            await importPublicKey(trimmed);
            await storePeerPublicKey(trimmed);
            const derived = await loadSharedKey();
            if (!derived) throw new Error('Unable to derive the shared key.');
            const derivedBlobId = await blobIdFromKey(derived);
            await savePartnerBlobId(derivedBlobId);
            setSharedKey(derived);
            setBlobId(derivedBlobId);
            setPeerKeyInput('');
        } catch (error) {
            setPairError(errorMessage(error));
        } finally {
            setPairing(false);
        }
    }, [peerKeyInput]);

    const handleIncludeFertileWindow = useCallback((next: boolean) => {
        setIncludeFertileWindow(next);
        saveIncludeFertileWindow(next);
    }, []);

    const handleSend = useCallback(async () => {
        if (!sharedKey) return;

        setSending(true);
        setSendError(null);
        try {
            const payload = buildPartnerPayload(
                { logs, periods, settings },
                { includeFertileWindow, note },
            );
            await uploadPayload(sharedKey, payload);
            const now = Date.now();
            saveLastSentAt(now);
            setLastSentAt(now);
            setNote('');
        } catch (error) {
            setSendError(errorMessage(error));
        } finally {
            setSending(false);
        }
    }, [sharedKey, logs, periods, settings, includeFertileWindow, note]);

    const header = (
        <div className="flex items-center gap-4 p-6 pb-3">
            <button
                type="button"
                onClick={onBack}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500"
                style={{ boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)' }}
            >
                <span className="text-xl rtl:rotate-180">←</span>
            </button>
            <h2 className="text-lg font-extrabold text-slate-700 tracking-tight">Send to BF</h2>
        </div>
    );

    if (loading) {
        return (
            <div className="h-full flex flex-col bg-[#F0F2F5]">
                {header}
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Loading…</div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="h-full flex flex-col bg-[#F0F2F5]">
                {header}
                <div className="flex-1 p-6">
                    <p className="text-sm text-rose-600">{loadError}</p>
                </div>
            </div>
        );
    }

    if (!sharedKey) {
        return (
            <div className="h-full flex flex-col bg-[#F0F2F5] overflow-y-auto">
                {header}
                <div className="p-6 pt-0 space-y-6 max-w-lg mx-auto w-full">
                    <section className="bg-white/60 rounded-2xl p-5 space-y-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700">Your public key</h3>
                            <p className="text-xs text-slate-500 mt-1">Show this to your partner so they can pair.</p>
                        </div>
                        <div className="flex justify-center">
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="Your partner public key QR code" className="w-[220px] h-[220px]" />
                            ) : (
                                <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-slate-400">Generating QR code…</div>
                            )}
                        </div>
                        {ownPublicKey && (
                            <p className="text-[10px] text-slate-400 break-all select-all text-center">{ownPublicKey}</p>
                        )}
                    </section>

                    <section className="bg-white/60 rounded-2xl p-5 space-y-3">
                        <label htmlFor="partner-public-key" className="block text-sm font-bold text-slate-700">
                            Paste partner’s public key
                        </label>
                        <input
                            id="partner-public-key"
                            type="text"
                            value={peerKeyInput}
                            onChange={(event) => setPeerKeyInput(event.target.value)}
                            placeholder="Paste the key here"
                            autoComplete="off"
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-[#7598a0] focus:ring-1 focus:ring-[#7598a0] outline-none"
                        />
                        {pairError && <p className="text-xs text-rose-600">{pairError}</p>}
                        <button
                            type="button"
                            onClick={() => { void handlePair(); }}
                            disabled={pairing}
                            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#7598a0] disabled:opacity-50"
                        >
                            {pairing ? 'Pairing…' : 'Pair'}
                        </button>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#F0F2F5] overflow-y-auto">
            {header}
            <div className="p-6 pt-0 space-y-6 max-w-lg mx-auto w-full">
                <section className="bg-white/60 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700">
                                {lastSentAt ? `Last sent: ${formatAgo(lastSentAt)}` : 'Last sent: never'}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleIncludeFertileWindow(!includeFertileWindow)}
                            role="switch"
                            aria-checked={includeFertileWindow}
                            className={`relative w-12 h-7 rounded-full transition-colors ${includeFertileWindow ? 'bg-[#7598a0]' : 'bg-slate-300'}`}
                        >
                            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${includeFertileWindow ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">Include fertile window</p>

                    <div className="space-y-2">
                        <label htmlFor="partner-note" className="block text-xs font-semibold text-slate-600">
                            Note to BF
                        </label>
                        <input
                            id="partner-note"
                            type="text"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Optional one-line note"
                            maxLength={200}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-[#7598a0] focus:ring-1 focus:ring-[#7598a0] outline-none"
                        />
                    </div>

                    {sendError && <p className="text-xs text-rose-600">{sendError}</p>}

                    <button
                        type="button"
                        onClick={() => { void handleSend(); }}
                        disabled={sending}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#7598a0] disabled:opacity-50"
                    >
                        {sending ? 'Sending…' : 'Send update'}
                    </button>
                </section>

                {blobId && (
                    <section className="bg-white/40 rounded-2xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Relay id</p>
                        <p className="text-xs text-slate-600 break-all select-all mt-1">{blobId}</p>
                    </section>
                )}
            </div>
        </div>
    );
};
