// Manual mock, used by tests that call jest.mock('../utils/LocaleUtils')
// without a factory. Returns the locale key so assertions can match on it.
// A plain function rather than jest.fn() so jest.resetAllMocks() leaves it
// working.
export const localeString = (key: string) => key;
