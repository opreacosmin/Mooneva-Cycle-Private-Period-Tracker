import { registerPlugin } from '@capacitor/core';
/**
 * NativeSettings Capacitor plugin instance.
 */
const NativeSettings = registerPlugin('NativeSettings', {
    web: () => import('./web').then((m) => new m.NativeSettingsWeb()),
});
export * from './definitions';
export { NativeSettings };
//# sourceMappingURL=index.js.map