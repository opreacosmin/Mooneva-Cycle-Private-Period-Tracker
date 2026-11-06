import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, DailyLog } from '../../../types';
import { buildPartnerPayload } from '../payload';
import type { PartnerCycleData } from '../payload';

const settings: AppSettings = {
    discreteMode: false,
    userName: 'Test',
    onboardingCompleted: true,
    symptoms: [],
    predictionsPaused: false,
    isOnBirthControl: false,
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseLength: 14,
    pmsLength: 3,
    showFertileWindow: true,
    hideFertilityLevel: false,
    showPMS: true,
    adaptivePrediction: false,
};

const todayLog: DailyLog = {
    date: '2026-06-15',
    flow: null,
    symptoms: ['Bloating', 'Cramps'],
    notes: 'This must never leave the device',
    mood: ['calm', 'tired'],
    discharge: 'egg_white',
    sexDrive: 'high',
    sexType: 'unprotected',
    meds: ['vitamin'],
};

const cycleData: PartnerCycleData = {
    logs: {
        '2026-06-15': todayLog,
    },
    periods: [
        { id: 'p1', startDate: '2026-05-19', days: 5, activeDays: [0, 1, 2, 3, 4] },
    ],
    settings,
};

const collectKeys = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(collectKeys);
    if (typeof value !== 'object' || value === null) return [];

    return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
};

describe('buildPartnerPayload', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('matches the golden snapshot for a fixture cycle', () => {
        const payload = buildPartnerPayload(cycleData, {
            includeFertileWindow: true,
            note: 'Thinking of you',
        });

        expect(payload.generatedAt).toBe(Date.now());
        expect({ ...payload, generatedAt: 'fixed-for-snapshot' }).toMatchSnapshot();
    });

    it('serializes no forbidden health-status keys', () => {
        const payload = buildPartnerPayload(cycleData, { includeFertileWindow: true });
        const keys = collectKeys(JSON.parse(JSON.stringify(payload)));

        expect(keys.filter((key) => /safe|risk|green|all.?clear/i.test(key))).toEqual([]);
    });

    it('contains only whitelisted keys', () => {
        const payload = buildPartnerPayload(cycleData, {
            includeFertileWindow: true,
            note: 'Hello',
        });
        const keys = collectKeys(JSON.parse(JSON.stringify(payload)));
        const allowed = new Set([
            'v',
            'generatedAt',
            'phase',
            'dayOfCycle',
            'nextPeriodEta',
            'pmsWindow',
            'inEstimatedFertileWindow',
            'fertileWindowEstimate',
            'mood',
            'symptoms',
            'note',
        ]);

        expect(keys.every((key) => allowed.has(key))).toBe(true);
    });

    it('keeps inEstimatedFertileWindow boolean and false when the fertile window is excluded', () => {
        const payload = buildPartnerPayload(cycleData, { includeFertileWindow: false });

        expect(typeof payload.inEstimatedFertileWindow).toBe('boolean');
        expect(payload.inEstimatedFertileWindow).toBe(false);
        expect(payload).not.toHaveProperty('fertileWindowEstimate');
    });

    it('does not invent a cycle day when there is no cycle history', () => {
        const payload = buildPartnerPayload(
            { logs: {}, periods: [], settings },
            { includeFertileWindow: true },
        );

        expect(payload.dayOfCycle).toBe(0);
        expect(payload.phase).toBe('menstrual');
        expect(payload.inEstimatedFertileWindow).toBe(false);
        expect(payload).not.toHaveProperty('nextPeriodEta');
    });

    it('reports the fertile window from the existing prediction model when included', () => {
        vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));
        const payload = buildPartnerPayload(
            { ...cycleData, logs: {} },
            { includeFertileWindow: true },
        );

        expect(payload.inEstimatedFertileWindow).toBe(true);
        expect(payload.fertileWindowEstimate).toBeDefined();
    });
});
