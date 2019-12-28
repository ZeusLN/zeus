import * as React from 'react';
import { Alert, View, Text, TouchableOpacity, Linking } from 'react-native';
import { LNURLPaySuccessAction } from 'js-lnurl';

interface LnurlPaySuccessProps {
    domain: string;
    successAction: LNURLPaySuccessAction;
}

export default class LnurlPaySuccess extends React.Component<
    LnurlPaySuccessProps
> {
    URLClicked = () => {
        const { successAction } = this.props;
        const { url } = successAction;

        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert("Don't know how to open URI: " + url);
            }
        });
    };

    render() {
        const { domain, successAction } = this.props;
        const { tag, description, url, message } = successAction;

        if (tag !== 'message' && tag !== 'url') {
            return null;
        }

        return (
            <View
                style={{
                    color: 'white',
                    padding: 20,
                    fontSize: 40
                }}
            >
                <Text style={{ padding: 20, fontWeight: 'bold', fontSize: 22 }}>
                    {domain}
                </Text>
                {tag === 'message' && <Text>{message}</Text>}
                {tag === 'url' && (
                    <Text>
                        {message}:{' '}
                        <TouchableOpacity
                            style={{ textDecoration: 'underline' }}
                            onPress={URLClicked}
                        >
                            {url}
                        </TouchableOpacity>
                    </Text>
                )}
            </View>
        );
    }
}
