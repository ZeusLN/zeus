import * as React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { LnurlPayTransaction } from './../../stores/LnurlPayStore';
import LnurlPayMetadata from './Metadata';
import LnurlPaySuccess from './Success';

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
    constructor(props: any) {
        super(props);

        this.state = {
            showLnurlSuccess: false
        };
    }

    render() {
        const { navigation, lnurlpaytx, preimage } = this.props;
        const { showLnurlSuccess } = this.state;

        return (
            <View>
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('Send', {
                            destination: lnurlpaytx.lnurl
                        })
                    }
                >
                    <Text style={{ fontWeight: 'bold' }}>
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
                        />
                    )}
                </TouchableOpacity>
            </View>
        );
    }
}
