import { Alert } from 'react-native';

import { localeString } from './LocaleUtils';

// Shows why handleAnything could not handle an input. It rejects with an
// Error, but a rejection can be any value, such as a plain string.
const showHandleAnythingError = (err: any) =>
    Alert.alert(
        localeString('general.error'),
        err?.message ?? String(err),
        [{ text: localeString('general.ok'), onPress: () => void 0 }],
        { cancelable: false }
    );

export default showHandleAnythingError;
