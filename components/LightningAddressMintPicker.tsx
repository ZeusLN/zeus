import * as React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import EcashMintPicker from './EcashMintPicker';
import Text from './Text';

import LightningAddressStore from '../stores/LightningAddressStore';
import SettingsStore from '../stores/SettingsStore';

import { getLightningAddressMintUrl } from '../utils/LightningAddressMintUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface LightningAddressMintPickerProps {
    navigation: NativeStackNavigationProp<any, any>;
    LightningAddressStore?: LightningAddressStore;
    SettingsStore?: SettingsStore;
    style?: StyleProp<ViewStyle>;
}

// Shows which mint a Cashu Lightning address pays into. This can differ
// from the wallet's selected mint, which only applies to invoices.
@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class LightningAddressMintPicker extends React.Component<
    LightningAddressMintPickerProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore, SettingsStore, style } =
            this.props;
        const mintUrl = getLightningAddressMintUrl(
            LightningAddressStore,
            SettingsStore
        );

        if (!mintUrl) return null;

        return (
            <View style={[styles.container, style]}>
                <Text
                    style={{
                        ...styles.label,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString('views.Cashu.LightningAddress.receivingMint')}
                </Text>
                <EcashMintPicker
                    hideAmount
                    disableRandom
                    overrideMintUrl={mintUrl}
                    navigation={navigation}
                    onPress={() =>
                        navigation.navigate('Mints', {
                            lightningAddressMint: true,
                            disableRandom: true
                        })
                    }
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        alignSelf: 'center',
        width: '85%'
    },
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginBottom: 6
    }
});
