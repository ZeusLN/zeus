// Version stamped into the zeus-settings-v2 blob as settingsVersion.
// A blob at the current version skips all one-shot settings migrations
// (see MigrationUtils.runSettingsMigrations); older or unstamped blobs
// get a single consolidation pass. Lives in its own dependency-free
// module so tests that must mock stores/SettingsStore (for its React
// Native imports) still exercise the real constant instead of a
// hardcoded copy that would keep old gating tests green after a bump.
export const SETTINGS_VERSION = 1;
