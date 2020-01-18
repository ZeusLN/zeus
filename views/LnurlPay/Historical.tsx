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
    constructor(props: any) {
        super(props);

        this.state = {
            showLnurlSuccess: false
        };
    }

    render() {
        const { navigation, lnurlpaytx, preimage, SettingsStore } = this.props;
        const { showLnurlSuccess } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;

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
                        {lnurlpaytx.lnurl}
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
                            domain={lnurlpaytx.domain}
                            successAction={lnurlpaytx.successAction}
                            preimage={preimage}
                        />
                    ) : (
                        <LnurlPayMetadata
                            metadata={lnurlpaytx.metadata.metadata}
                            SettingsStore={SettingsStore}
                        />
                    )}
                </TouchableOpacity>
            </View>
        );
    }
}
