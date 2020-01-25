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
        const urlString: string = url || '';

        Linking.canOpenURL(urlString).then((supported: boolean) => {
            if (supported) {
                Linking.openURL(urlString);
            } else {
                Alert.alert(`Don't know how to open URI: ${urlString}`);
            }
        });
    };

    render() {
        const { domain, successAction } = this.props;
        const { tag, url, message } = successAction;

        if (tag !== 'message' && tag !== 'url') {
            return null;
        }

        return (
            <View
                style={{
                    padding: 20
                }}
            >
                <Text
                    style={{
                        padding: 20,
                        fontWeight: 'bold',
                        fontSize: 22,
                        color: 'white'
                    }}
                >
                    {domain}
                </Text>
                {tag === 'message' && <Text>{message}</Text>}
                {tag === 'url' && (
                    <Text style={{ fontSize: 40, color: 'white' }}>
                        {message}:{' '}
                        <TouchableOpacity onPress={this.URLClicked}>
                            {url}
                        </TouchableOpacity>
                    </Text>
                )}
            </View>
        );
    }
}
