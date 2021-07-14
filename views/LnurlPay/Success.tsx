import * as React from 'react';
import { Alert, View, Text, TouchableOpacity, Linking } from 'react-native';
import { LNURLPaySuccessAction, decipherAES } from 'js-lnurl';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface LnurlPaySuccessProps {
    color?: string;
    domain: any;
    successAction: LNURLPaySuccessAction;
    preimage: string;
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
                Alert.alert(
                    `${localeString(
                        'views.LnurlPay.Success.uriAlert'
                    )}: ${urlString}`
                );
            }
        });
    };

    render() {
        const { color, domain, successAction, preimage } = this.props;

        let body;
        if (successAction) {
            const { tag, description, url, message } = successAction;
            switch (tag) {
                case 'message':
                    body = (
                        <Text
                            style={{
                                color: color || themeColor('text'),
                                fontSize: 40
                            }}
                        >
                            {message}
                        </Text>
                    );
                    break;
                case 'url':
                    body = (
                        <TouchableOpacity onPress={() => this.URLClicked()}>
                            <Text
                                style={{
                                    color: color || themeColor('text'),
                                    fontSize: 18
                                }}
                            >
                                {description}: {url}
                            </Text>
                        </TouchableOpacity>
                    );
                    break;
                case 'aes':
                    let plaintext;
                    try {
                        plaintext = decipherAES(successAction, preimage);
                    } catch (err) {
                        plaintext = `<error decrypting message: ${err.message}>`;
                    }
                    body = (
                        <React.Fragment>
                            <Text
                                style={{
                                    color: color || themeColor('text'),
                                    fontSize: 18
                                }}
                            >
                                {description}:{' '}
                            </Text>
                            <Text
                                style={{
                                    color: color || themeColor('text'),
                                    fontSize: 18
                                }}
                            >
                                {plaintext}
                            </Text>
                        </React.Fragment>
                    );
                    break;
            }
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
                        color: color || themeColor('text')
                    }}
                >
                    {domain}
                </Text>
                {body}
            </View>
        );
    }
}
