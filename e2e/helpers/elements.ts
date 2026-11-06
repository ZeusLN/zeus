import { by, element, expect, waitFor } from 'detox';

import { t } from './locale';

const DEFAULT_TIMEOUT_MS = 30000;

export type E2EElement = ReturnType<typeof element>;

export const byId = (id: string): E2EElement => element(by.id(id));

export const byText = (text: string): E2EElement => element(by.text(text));

export const waitForVisible = async (
    target: E2EElement,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    await waitFor(target).toBeVisible().withTimeout(timeoutMs);
};

export const waitForHidden = async (
    target: E2EElement,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    await waitFor(target).not.toBeVisible().withTimeout(timeoutMs);
};

// Asserts the element shows the English copy for a locale key.
export const expectLocalizedText = async (
    target: E2EElement,
    key: string
): Promise<void> => {
    await expect(target).toHaveText(t(key));
};
