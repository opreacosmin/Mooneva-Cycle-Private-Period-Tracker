import type { AppSettings, DailyLog, PeriodRecord } from '../../types';
import { buildCycleModel } from '../logic/cycleModel';
import { getTimestamp, getTodayStr } from '../../utils/dateUtils';

export interface PartnerPayload {
    v: 1;
    generatedAt: number;
    phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
    dayOfCycle: number;
    nextPeriodEta?: number;
    pmsWindow?: [number, number];
    inEstimatedFertileWindow: boolean;
    fertileWindowEstimate?: [number, number];
    mood?: string;
    symptoms?: string[];
    note?: string;
}

export interface PartnerCycleData {
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
    settings: AppSettings;
}

export interface PartnerPayloadOptions {
    includeFertileWindow: boolean;
    note?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const fuzzOffset = (seed: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 3 - 1;
};

const fuzzTimestamp = (date: string, seed: string): number =>
    getTimestamp(date) + fuzzOffset(`${date}:${seed}`) * DAY_MS;

const fuzzWindow = (
    window: { start: string; end: string },
    seed: string,
): [number, number] => {
    const start = fuzzTimestamp(window.start, `${seed}:start`);
    const end = fuzzTimestamp(window.end, `${seed}:end`);
    return start <= end ? [start, end] : [end, start];
};

const partnerPhase = (
    phase: string | null,
    cycleDay: number | null,
): PartnerPayload['phase'] => {
    if (phase === 'menstrual' || phase === 'ovulation') return phase;
    if (phase === 'luteal' || phase === 'pms') return 'luteal';
    if (phase === 'follicular') return 'follicular';
    return cycleDay && cycleDay > 0 ? 'follicular' : 'menstrual';
};

export const buildPartnerPayload = (
    cycleData: PartnerCycleData,
    opts: PartnerPayloadOptions,
): PartnerPayload => {
    const { logs, periods, settings } = cycleData;
    const today = getTodayStr();
    const model = buildCycleModel(periods, settings, today);
    const day = model.at(today);
    const todayLog = logs[today];

    const payload: PartnerPayload = {
        v: 1,
        generatedAt: Date.now(),
        phase: partnerPhase(day.phase, day.cycleDay),
        dayOfCycle: day.cycleDay && day.cycleDay > 0 ? day.cycleDay : 0,
        inEstimatedFertileWindow: opts.includeFertileWindow ? day.isFertile : false,
    };

    if (model.nextPeriod) {
        payload.nextPeriodEta = fuzzTimestamp(model.nextPeriod.start, 'next-period');
    }

    if (model.pmsNext) {
        payload.pmsWindow = fuzzWindow(model.pmsNext, 'pms');
    }

    if (opts.includeFertileWindow && model.fertileNext) {
        payload.fertileWindowEstimate = fuzzWindow(model.fertileNext, 'fertile');
    }

    const mood = todayLog?.mood?.[0];
    if (mood) payload.mood = mood;

    if (todayLog?.symptoms?.length) {
        payload.symptoms = [...todayLog.symptoms];
    }

    const note = opts.note?.trim();
    if (note) payload.note = note;

    return payload;
};
