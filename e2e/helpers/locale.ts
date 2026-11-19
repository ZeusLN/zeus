import en from '../../locales/en.json';

// The suite runs with the default (English) locale; resolving copy from the
// same strings file as the app keeps assertions in step with copy changes.
export const t = (key: string): string => {
    const value = (en as Record<string, string>)[key];
    if (value === undefined) {
        throw new Error(`Missing locale key in locales/en.json: ${key}`);
    }
    return value;
};
