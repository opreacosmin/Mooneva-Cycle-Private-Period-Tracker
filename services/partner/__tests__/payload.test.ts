import { describe, expect, it } from 'vitest';
import { buildPartnerPayload } from '../payload';

const emptySettings = {} as never;
const emptyLogs = {};
const emptyPeriods: never[] = [];

describe('buildPartnerPayload', () => {
    it('emits null phase and dayOfCycle 0 with no cycle history', () => {
        const p = buildPartnerPayload(emptyLogs, emptyPeriods, emptySettings);
        expect(p.phase).toBeNull();
        expect(p.dayOfCycle).toBe(0);
        expect(p.inEstimatedFertileWindow).toBe(false);
        expect(p.nextPeriodEta).toBeUndefined();
    });

    it('omits note when blank', () => {
        const p = buildPartnerPayload(emptyLogs, emptyPeriods, emptySettings, '   ');
        expect(p.note).toBeUndefined();
    });
});
