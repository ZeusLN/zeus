jest.mock('./LocaleUtils');

import { Alert } from 'react-native';

import showHandleAnythingError from './showHandleAnythingError';

describe('showHandleAnythingError', () => {
    let alert: jest.SpyInstance;

    beforeEach(() => {
        alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        alert.mockRestore();
    });

    it.each([
        ['an Error', new Error('not valid'), 'not valid'],
        ['a plain string', 'boom', 'boom']
    ])('shows the message of %s', (_label, err, message) => {
        showHandleAnythingError(err);

        expect(alert).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalledWith(
            'general.error',
            message,
            [{ text: 'general.ok', onPress: expect.any(Function) }],
            { cancelable: false }
        );
    });
});
