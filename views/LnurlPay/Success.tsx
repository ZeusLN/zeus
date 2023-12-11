import * as React from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { LNURLPaySuccessAction, decipherAES } from 'js-lnurl';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LnurlPaySuccessProps {
    color?: string;
    domain: any;
    successAction: LNURLPaySuccessAction;
    preimage: string;
    scrollable: boolean;
    maxHeight?: number;
}

export default class LnurlPaySuccess extends React.Component<LnurlPaySuccessProps> {
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
        const {
            color,
            domain,
            successAction,
            preimage,
            scrollable,
            maxHeight
        } = this.props;

        let body;
        if (successAction) {
            const { tag, description, url, message } = successAction;
            let plaintext;
            switch (tag) {
                case 'message':
                    body = (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text')
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
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: color || themeColor('text')
                                }}
                            >
                                {description}
                            </Text>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: color || themeColor('text')
                                }}
                            >
                                {url}
                            </Text>
                        </TouchableOpacity>
                    );
                    break;
                case 'aes':
                    try {
                        plaintext = decipherAES(successAction, preimage);
                    } catch (err) {
                        plaintext = `<error decrypting message: ${err.message}>`;
                    }
                    body = (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text')
                            }}
                        >
                            {description}
                            {'\n'}
                            {plaintext}
                        </Text>
                    );
                    break;
            }
        }

        const servicedBy = (
            <Text style={{ color: themeColor('text') }}>
                {localeString('views.LnurlPay.Success.servicedBy')}: {domain}
            </Text>
        );

        if (!body && !domain) return;

        return scrollable ? (
            <ScrollView
                style={{
                    ...styles.container,
                    borderColor: themeColor('text'),
                    backgroundColor: themeColor('secondary'),
                    maxHeight
                }}
                contentContainerStyle={{ gap: 5, padding: 15 }}
            >
                {body}
                {domain && servicedBy}
            </ScrollView>
        ) : (
            <View
                style={{
                    ...styles.container,
                    borderColor: themeColor('text'),
                    backgroundColor: themeColor('secondary'),
                    maxHeight,
                    padding: 15
                }}
            >
                {body}
                {domain && servicedBy}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 5,
        gap: 5
    }
});
