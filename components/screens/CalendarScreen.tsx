
import React, { useState } from 'react';
import { ScreenWrapper } from '../ScreenWrapper';
import Header from '../Header';
import Calendar from '../Calendar';
import DailyLogPanel from '../DailyLogPanel';
import { DayPreview } from '../DayPreview';
import TimelineView from '../TimelineView';
import BottomNav from '../BottomNav';

import { useMooneva } from '../../contexts/MoonevaContext';
import { useTranslation } from 'react-i18next';
import { useDiscreteMode } from '../../hooks/useDiscreteMode';
import { SubViewType, ViewType } from '../../hooks/useAppNavigation';
import { toLocalISOString } from '../../utils/dateUtils';
import { getCycleVisibility } from '../../services/logic/settingsInterlocks';
import { hasDailyLogContent } from '../../utils/dailyLogContent';
import { DailyLog, PeriodRecord } from '../../types';
import { findActivePeriod, findPregnancySpan, getPregnancySpans } from '../../services/logic/cycle';

interface CalendarScreenProps {
    setSubView: (view: SubViewType) => void;
    setView: (view: ViewType) => void;
    openSubViewFrom: (origin: ViewType, sub: SubViewType) => void;
    isCloaked: boolean;
    onRequestExitDiscreteMode: () => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
    setSubView,
    setView,
    openSubViewFrom,
    isCloaked,
    onRequestExitDiscreteMode
}) => {
    const { t } = useTranslation();
    const { logs, periods, settings, model, actions } = useMooneva();
    const { cycles: pastCycles, cycleModel, getDayMeta, getDayStatus } = model;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [previewDate, setPreviewDate] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string | null>(null);
    const [isCalendarEditMode, setIsCalendarEditMode] = useState(false);
    const [periodsSnapshot, setPeriodsSnapshot] = useState<PeriodRecord[] | null>(null);
    const [logsSnapshot, setLogsSnapshot] = useState<Record<string, DailyLog> | null>(null);

    // Capture periods snapshot when entering edit mode
    React.useEffect(() => {
        if (isCalendarEditMode && !periodsSnapshot) {
            setPeriodsSnapshot([...periods]);
            setLogsSnapshot(logs);
        } else if (!isCalendarEditMode) {
            setPeriodsSnapshot(null);
            setLogsSnapshot(null);
        }
    }, [isCalendarEditMode, periods, logs, periodsSnapshot]);

    // The day panel saves its pending text when it unmounts, which is the same render that
    // enters edit mode, so the snapshot above can miss that save. Take it again once the save
    // has landed (before any tap in edit mode), or Cancel would drop the just-typed edit.
    const latestRef = React.useRef({ periods, logs });
    latestRef.current = { periods, logs };
    React.useEffect(() => {
        if (!isCalendarEditMode) return;
        const id = setTimeout(() => {
            setPeriodsSnapshot([...latestRef.current.periods]);
            setLogsSnapshot(latestRef.current.logs);
        }, 0);
        return () => clearTimeout(id);
    }, [isCalendarEditMode]);

    // A tap that would start a period inside a pregnancy ends that pregnancy the day
    // before, so ask first. Removing a period day never asks.
    const handleToggleBleedingDay = (date: string) => {
        const span = findActivePeriod(periods, date) ? undefined : findPregnancySpan(getPregnancySpans(logs, periods), date);
        // A period on the start day itself does not end the pregnancy: pregnancies are dated from the last period.
        if (
            span && span.start !== date &&
            !confirm(t(
                'calendar.period_in_pregnancy_confirm',
                'This day is inside a pregnancy. A period starting here ends the pregnancy the day before. Continue?'
            ))
        ) return;
        actions.toggleBleedingDay(date, cycleModel.rules.periodLength);
    };

    const handleEditDone = () => {
        setIsCalendarEditMode(false);
        setPeriodsSnapshot(null);
        setLogsSnapshot(null);
    };

    const handleEditCancel = () => {
        if (periodsSnapshot) {
            actions.restorePeriods(periodsSnapshot, logsSnapshot ?? undefined);
        }
        setIsCalendarEditMode(false);
        setPeriodsSnapshot(null);
        setLogsSnapshot(null);
    };


    // --- Discrete Mode State ---
    const { dummyTasks, toggleDummyTask, updateDummyTaskText, addDummyTask } = useDiscreteMode();
    const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPress = React.useRef(false);

    const handleSettingsStart = () => {
        isLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
            onRequestExitDiscreteMode();
        }, 2000);
    };

    const handleSettingsEnd = (e: React.SyntheticEvent) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // --- Status for the selected day (today when nothing is selected) ---
    const todayStr = toLocalISOString(new Date());
    const shownDate = previewDate ?? editDate ?? todayStr;
    const cycleStatus = getDayStatus(shownDate);
    const clearSelection = () => {
        setPreviewDate(null);
        setEditDate(null);
    };

    // Handle date click - skip preview for empty days
    const handleDateClick = (dateStr: string) => {
        const log = logs[dateStr];
        const hasLogData = hasDailyLogContent(log);

        if (previewDate === dateStr) {
            // Second click on same day: always go to editor
            setPreviewDate(null);
            setEditDate(dateStr);
        } else if (!hasLogData) {
            // First click on day with no data: go straight to editor
            setPreviewDate(null);
            setEditDate(dateStr);
        } else {
            // First click on day with data: show preview first
            setEditDate(null);
            setPreviewDate(dateStr);
        }
    };

    // --- Swipe Navigation ---
    const nextMonth = () => setCurrentDate(curr => new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(curr => new Date(curr.getFullYear(), curr.getMonth() - 1, 1));


    const handleHeaderRemindBF = () => {
        openSubViewFrom('calendar', 'send_to_bf');
    };

    // --- Timeline Data ---

    return (
        <ScreenWrapper>
            {/* Background Removed */}

            <Header
                isCloaked={isCloaked}
                cycleStatus={cycleStatus}
                taskCount={dummyTasks.filter(t => !t.completed).length}
                onNotificationsClick={() => setView('notifications')}
                onRemindBFClick={isCloaked ? undefined : handleHeaderRemindBF}
            />

            <main
                className="flex-1 overflow-y-auto overflow-x-hidden px-[max(16px,calc((100%_-_32rem)/2))] pt-[20px] pb-32 relative z-10 no-scrollbar"
            >
                {!isCloaked && (
                    <Calendar
                        currentDate={currentDate}
                        logs={logs}
                        onDateClick={handleDateClick}
                        selectedDate={editDate || previewDate}
                        cycleStatus={cycleStatus}
                        statusDate={shownDate === todayStr ? null : shownDate}
                        onShowToday={clearSelection}
                        getDayMeta={getDayMeta}
                        settings={settings}
                        isCloaked={isCloaked}
                        onMonthChange={setCurrentDate}
                        onToggleBleedingDay={handleToggleBleedingDay}
                        onNextMonth={nextMonth}
                        onPrevMonth={prevMonth}
                        isEditMode={isCalendarEditMode}
                        onEditModeChange={setIsCalendarEditMode}
                        onEditDone={handleEditDone}
                        onEditCancel={handleEditCancel}
                        todayIsPeriod={getDayMeta(toLocalISOString(new Date())).isPeriod}
                    />
                )}

                {!isCloaked && (
                    <div className="-mt-10 relative z-0">
                        {editDate ? (
                            <div className="pt-6">
                                <DailyLogPanel
                                    date={editDate}
                                    onClose={clearSelection}
                                    onEditPeriod={() => {
                                        setIsCalendarEditMode(true);
                                        setEditDate(null);
                                    }}
                                />
                            </div>
                        ) : previewDate ? (
                            <div className="pt-6">
                                <DayPreview
                                    date={previewDate}
                                    onClose={() => setPreviewDate(null)}
                                    onEdit={(date) => {
                                        setPreviewDate(null);
                                        setEditDate(date);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="pt-14">
                                <TimelineView
                                    cycles={pastCycles}
                                    showFertile={getCycleVisibility(settings).fertile}
                                    pregnancySpans={model.pregnancySpans}
                                    archivedBefore={settings.historyArchivedDate}
                                />
                            </div>
                        )}
                    </div>
                )}

                {isCloaked && (
                    <div className="space-y-3 pb-8">
                        <div className="flex items-center justify-between px-1 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('discrete.backlog')}</span>
                            <span className="text-10px font-bold text-blue-500 uppercase tracking-wider">{t('discrete.subtitle', { count: dummyTasks.filter(t => !t.completed).length })}</span>
                        </div>
                        {dummyTasks.map((task) => (
                            <div
                                key={task.id}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${task.completed
                                    ? 'bg-gray-50/50 border-gray-100/50 opacity-60'
                                    : 'bg-white border-gray-100 shadow-sm'
                                    }`}
                            >
                                <button
                                    onClick={() => toggleDummyTask(task.id)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-200'
                                        }`}
                                >
                                    {task.completed && <span className="text-white text-xs px-0.5">✓</span>}
                                </button>
                                <input
                                    type="text"
                                    value={task.text}
                                    onChange={(e) => updateDummyTaskText(task.id, e.target.value)}
                                    className={`flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-medium p-0 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'
                                        }`}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isCloaked && (
                <div className="fixed bottom-8 right-6 flex items-center justify-end z-50 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {/* Add Task Button (Right) - Holds secret unlock */}
                    <button
                        className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-500 shadow-lg text-white pointer-events-auto active:scale-90 transition-transform hover:bg-blue-600"
                        onMouseDown={handleSettingsStart}
                        onMouseUp={handleSettingsEnd}
                        onMouseLeave={handleSettingsEnd}
                        onTouchStart={handleSettingsStart}
                        onTouchEnd={handleSettingsEnd}
                        onClick={() => {
                            // Only add task if not a long press
                            if (!isLongPress.current) {
                                addDummyTask();
                            }
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>
            )}

            {!isCloaked && <BottomNav
                currentView="calendar"
                onViewChange={(v) => {
                    setSubView('main');
                    setView(v);
                }}
                onSettingsClick={() => {
                    setSubView('main');
                    setView('settings');
                }}
                isCloaked={isCloaked}
            />}
        </ScreenWrapper>
    );
};
