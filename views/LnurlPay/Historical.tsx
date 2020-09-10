import * as React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { LnurlPayTransaction } from './../../stores/LnurlPayStore';
import LnurlPayMetadata from './Metadata';
import LnurlPaySuccess from './Success';

import SettingsStore from './../../stores/SettingsStore';

interface LnurlPayHistoricalProps {
    navigation: any;
    lnurlpaytx: LnurlPayTransaction;
    preimage: string;
    SettingsStore: SettingsStore;
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
        const { navigation, lnurlpaytx, preimage, SettingsStore } = this.props;
        const { showLnurlSuccess } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;
        const { lnurl, domain, successAction } = lnurlpaytx;
        const metadata = lnurlpaytx.metadata && lnurlpaytx.metadata.metadata || 'No metadata available';
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
                            color: theme === 'dark' ? 'white' : 'black',
                            fontWeight: 'bold'
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
                            SettingsStore={SettingsStore}
                        />
                    ) : (
                        <LnurlPayMetadata
                            metadata={metadata}
                            SettingsStore={SettingsStore}
                        />
                    )}
                </TouchableOpacity>
            </View>
        );
    }
}
