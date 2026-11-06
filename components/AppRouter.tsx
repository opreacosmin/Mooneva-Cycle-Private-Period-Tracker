import React, { useEffect, useState } from 'react';
import { useMooneva } from '../contexts/MoonevaContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppReview } from '../hooks/useAppReview';
import { useAutoLock } from '../hooks/useAutoLock';

import PinLock from './PinLock';
import LoadErrorScreen from './LoadErrorScreen';
import { LabRoute, useLabVisible } from './lab';

import { CalendarScreen } from './screens/CalendarScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NotificationManagerScreen } from './screens/NotificationManagerScreen';

type PendingPinAction = 'exitDiscreteMode' | null;

export const AppRouter = () => {
    const {
        settings,
        isLoading: loading,
        loadError,
        actions
    } = useMooneva();

    // --- Navigation & Theme Hooks ---
    const { view, setView, subView, setSubView, openSubViewFrom, closeSubView, previousView } = useAppNavigation();
    useAppTheme({
        view,
        discreteMode: !!settings.discreteMode,
        darkNeumorphism: !!settings.darkNeumorphism,
        vampireTheme: settings.vampireTheme !== false,
    });
    useAppReview();
    const labVisible = useLabVisible();

    // --- Auto Lock Hook ---
    const { isLocked, setIsLocked, isPinConfigured } = useAutoLock({ settings, loading });

    // --- Modal State ---
    const [pendingPinAction, setPendingPinAction] = useState<PendingPinAction>(null);

    // Lab turned off, discrete mode on or a pregnancy started while Lab was open: leave it.
    useEffect(() => {
        if (view === 'lab' && !labVisible) setView('calendar');
    }, [view, labVisible]);

    const requestExitDiscreteMode = () => {
        if (!isPinConfigured) {
            actions.updateSettings({ ...settings, discreteMode: false });
            return;
        }
        setPendingPinAction('exitDiscreteMode');
    };

    const confirmExitDiscreteMode = () => {
        actions.updateSettings({ ...settings, discreteMode: false });
        setPendingPinAction(null);
    };

    if (loading) return <div className="fixed inset-0 bg-[#fcfaf6]" />;

    if (isLocked && isPinConfigured) {
        return (
            <PinLock
                pinHash={settings.pinHash}
                pinSalt={settings.pinSalt}
                correctPin={settings.pin}
                onUnlock={() => setIsLocked(false)}
            />
        );
    }

    if (pendingPinAction === 'exitDiscreteMode' && isPinConfigured) {
        return (
            <PinLock
                purpose="exitDiscreteMode"
                pinHash={settings.pinHash}
                pinSalt={settings.pinSalt}
                correctPin={settings.pin}
                onUnlock={confirmExitDiscreteMode}
                onCancel={() => setPendingPinAction(null)}
            />
        );
    }

    if (loadError) return <LoadErrorScreen />;

    const content = (() => {
        if (view === 'settings') {
            return <SettingsScreen subView={subView} setSubView={setSubView} closeSubView={closeSubView} setView={setView} isCloaked={settings.discreteMode} />;
        }

        if (view === 'notifications') {
            return <NotificationManagerScreen setView={setView} returnTo={previousView ?? 'calendar'} isCloaked={settings.discreteMode} />;
        }

        if (view === 'lab' && labVisible) {
            return <LabRoute setSubView={setSubView} setView={setView} isCloaked={settings.discreteMode} />;
        }

        if (view === 'trends') {
            return <TrendsScreen setSubView={setSubView} setView={setView} isCloaked={settings.discreteMode} />;
        }

        return (
            <CalendarScreen
                setSubView={setSubView}
                setView={setView}
                openSubViewFrom={openSubViewFrom}
                isCloaked={settings.discreteMode}
                onRequestExitDiscreteMode={requestExitDiscreteMode}
            />
        );
    })();

    return <>{content}</>;
};
