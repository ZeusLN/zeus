// Manual mock, used by tests that call jest.mock('../utils/LocaleUtils')
// without a factory. Returns the locale key so assertions can match on it.
// Plain functions rather than jest.fn() so jest.resetAllMocks() leaves them
// working.
export const localeString = (key: string) => key;
export const formatInlineNoun = (text: string) => text;
