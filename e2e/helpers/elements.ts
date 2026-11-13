import { by, element, expect, waitFor } from 'detox';

import { t } from './locale';

const DEFAULT_TIMEOUT_MS = 30000;

export type E2EElement = ReturnType<typeof element>;

export const byId = (id: string): E2EElement => element(by.id(id));

export const byText = (text: string): E2EElement => element(by.text(text));

// Text inside the element with the given testID, such as the value a
// dropdown shows, where the same text can appear elsewhere on the screen.
export const textWithin = (ancestorId: string, text: string): E2EElement =>
    element(by.text(text).withAncestor(by.id(ancestorId)));

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

// Opens a DropdownSetting (an action sheet on iOS, a dialog on Android) and
// picks the entry with the given label. The label must not also be on screen,
// so pick a value the dropdown doesn't show already.
export const chooseOption = async (
    dropdown: E2EElement,
    label: string
): Promise<void> => {
    await dropdown.tap();
    await waitForVisible(byText(label));
    await byText(label).tap();
};

// Asserts the element shows the English copy for a locale key.
export const expectLocalizedText = async (
    target: E2EElement,
    key: string
): Promise<void> => {
    await expect(target).toHaveText(t(key));
};
