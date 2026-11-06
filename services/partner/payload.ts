import type { AppSettings, DailyLog, PeriodRecord } from '../../types';
import { buildCycleModel } from '../logic/cycleModel';
import { getTimestamp, getTodayStr } from '../../utils/dateUtils';

export interface PartnerPayload {
    v: 1;
    generatedAt: number;
    phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | null;
    dayOfCycle: number;
    nextPeriodEta?: number;
    pmsWindow?: [number, number];
    inEstimatedFertileWindow: boolean;
    mood?: string;
    symptoms?: string[];
    note?: string;
}

export const buildPartnerPayload = (
    logs: Record<string, DailyLog>,
    periods: PeriodRecord[],
    settings: AppSettings,
    note?: string,
): PartnerPayload => {
    const today = getTodayStr();
    const model = buildCycleModel(periods, settings, today);
    const day = model.at(today);
    const todayLog = logs[today];
    const hasData = !!day.cycleDay && day.cycleDay > 0 && day.phase !== null;

    const payload: PartnerPayload = {
        v: 1,
        generatedAt: Date.now(),
        phase: hasData
            ? day.phase === 'pms'
                ? 'luteal'
                : (day.phase as PartnerPayload['phase'])
            : null,
        dayOfCycle: hasData ? day.cycleDay! : 0,
        inEstimatedFertileWindow: hasData ? !!day.isFertile : false,
    };

    if (model.nextPeriod) payload.nextPeriodEta = getTimestamp(model.nextPeriod.start);
    if (model.pmsNext) {
        payload.pmsWindow = [getTimestamp(model.pmsNext.start), getTimestamp(model.pmsNext.end)];
    }

    const mood = todayLog?.mood?.[0];
    if (mood) payload.mood = mood;
    if (todayLog?.symptoms?.length) payload.symptoms = [...todayLog.symptoms];

    const trimmed = note?.trim();
    if (trimmed) payload.note = trimmed;

    return payload;
};
