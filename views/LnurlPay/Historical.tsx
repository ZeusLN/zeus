import * as React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { LnurlPayTransaction } from './../../stores/LnurlPayStore';
import LnurlPayMetadata from './Metadata';
import LnurlPaySuccess from './Success';
import { themeColor } from './../../utils/ThemeUtils';

interface LnurlPayHistoricalProps {
    navigation: any;
    lnurlpaytx: LnurlPayTransaction;
    preimage: string;
}

interface LnurlPayHistoricalState {
    showLnurlSuccess: boolean;
}

export default class LnurlPayHistorical extends React.Component<
    LnurlPayHistoricalProps,
    LnurlPayHistoricalState
> {
    state = {
        showLnurlSuccess: false
    };

    render() {
        const { navigation, lnurlpaytx, preimage } = this.props;
        const { showLnurlSuccess } = this.state;
        const { lnurl, domain, successAction } = lnurlpaytx;
        const metadata =
            (lnurlpaytx.metadata && lnurlpaytx.metadata.metadata) ||
            'No metadata available';
        return (
            <View>
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('Send', {
                            destination: lnurlpaytx.lnurl
                        })
                    }
                >
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Bold',
                            marginBottom: 20
                        }}
                    >
                        {lnurl}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        this.setState({
                            showLnurlSuccess: !showLnurlSuccess
                        });
                    }}
                >
                    {showLnurlSuccess ? (
                        <LnurlPaySuccess
                            domain={domain}
                            successAction={successAction}
                            preimage={preimage}
                        />
                    ) : (
                        <LnurlPayMetadata metadata={metadata} />
                    )}
                </TouchableOpacity>
            </View>
        );
    }
}
