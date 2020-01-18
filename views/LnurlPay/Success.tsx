import * as React from 'react';
import { Alert, View, Text, TouchableOpacity, Linking } from 'react-native';
import { LNURLPaySuccessAction, decipherAES } from 'js-lnurl';

interface LnurlPaySuccessProps {
    color: string;
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
        const { color, domain, successAction } = this.props;

        let body;
        if (successAction) {
            const { tag, description, url, message } = successAction;
            switch (tag) {
                case 'message':
                    body = <Text style={{ color }}>{message}</Text>;
                    break;
                case 'url':
                    body = (
                        <TouchableOpacity
                            style={{ textDecoration: 'underline' }}
                            onPress={() => this.URLClicked()}
                        >
                            <Text style={{ color: this.props.color }}>
                                {description}: {url}
                            </Text>
                        </TouchableOpacity>
                    );
                    break;
                case 'aes':
                    var plaintext;
                    try {
                        plaintext = decipherAES(
                            successAction,
                            this.props.preimage
                        );
                    } catch (err) {
                        plaintext = `<error decrypting message: ${err.message}>`;
                    }
                    body = (
                        <React.Fragment>
                            <Text style={{ color }}>{description}: </Text>
                            <Text style={{ color }}>{plaintext}</Text>
                        </React.Fragment>
                    );
                    break;
            }
        }

        return (
            <View
                style={{
                    color,
                    padding: 20,
                    fontSize: 40
                }}
            >
                <Text
                    style={{
                        padding: 20,
                        fontWeight: 'bold',
                        fontSize: 22,
                        color
                    }}
                >
                    {domain}
                </Text>
                {body}
            </View>
        );
    }
}
