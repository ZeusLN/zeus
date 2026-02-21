import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import Amount from './Amount';
import MintAvatar from './MintAvatar';
import { Row } from './layout/Row';

import CashuStore from '../stores/CashuStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import CaretRight from '../assets/images/SVG/Caret Right.svg';
import Dice from '../assets/images/SVG/Dice.svg';

interface EcashMintPickerProps {
    title?: string;
    CashuStore?: CashuStore;
    navigation: StackNavigationProp<any, any>;
    hideAmount?: boolean;
    disabled?: boolean;
    disableRandom?: boolean;
    overrideMintUrl?: string;
}

@inject('CashuStore')
@observer
export default class EcashMintPicker extends React.Component<
    EcashMintPickerProps,
    {}
> {
    render() {
        const {
            CashuStore,
            hideAmount,
            disabled,
            disableRandom,
            navigation,
            overrideMintUrl
        } = this.props;
        const {
            cashuWallets,
            mintUrls,
            selectedMintUrl,
            mintInfos,
            mintBalances,
            randomizeMintSelection
        } = CashuStore!!;

        const displayMintUrl = overrideMintUrl || selectedMintUrl;
        const showRandom =
            randomizeMintSelection &&
            !disableRandom &&
            !overrideMintUrl &&
            mintUrls.length > 1;

        let mints: any = {};
        mintUrls.forEach((mintUrl) => {
            const wallet = cashuWallets[mintUrl];
            const mintInfo = mintInfos[mintUrl];
            mints[mintUrl] = {
                ...mintInfo,
                mintUrl,
                mintBalance: mintBalances[mintUrl] || 0,
                errorConnecting: wallet?.errorConnecting
            };
        });

        return (
            <View style={{ flex: 1, flexDirection: 'row' }}>
                <TouchableOpacity
                    onPress={() => {
                        navigation.navigate('Mints', { disableRandom });
                    }}
                    style={{
                        opacity: disabled ? 0.25 : 1,
                        backgroundColor: themeColor('secondary'),
                        ...styles.field
                    }}
                >
                    <Row style={{ flex: 1 }}>
                        {showRandom ? (
                            <Dice
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                                style={{
                                    marginRight: 10,
                                    flexShrink: 0
                                }}
                            />
                        ) : (
                            <MintAvatar
                                iconUrl={mints[displayMintUrl]?.icon_url}
                                name={mints[displayMintUrl]?.name}
                                mintUrl={displayMintUrl}
                                size="small"
                                style={{
                                    marginRight: 10,
                                    flexShrink: 0
                                }}
                            />
                        )}
                        <Text
                            style={{
                                ...styles.text,
                                color:
                                    !showRandom &&
                                    mints[displayMintUrl]?.errorConnecting
                                        ? themeColor('warning')
                                        : themeColor('text'),
                                flex: 1,
                                flexShrink: 1,
                                minWidth: 0
                            }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {showRandom
                                ? localeString('cashu.randomMint')
                                : mints[displayMintUrl]?.name
                                ? mints[displayMintUrl].name
                                : displayMintUrl
                                ? displayMintUrl
                                : localeString('cashu.tapToConfigure.short')}
                        </Text>
                        {!hideAmount && !showRandom && (
                            <View
                                style={{
                                    marginRight: 8,
                                    flexShrink: 0
                                }}
                            >
                                <Amount
                                    sats={mints[displayMintUrl]?.mintBalance}
                                    sensitive
                                />
                            </View>
                        )}
                        <View style={{ marginRight: 8, flexShrink: 0 }}>
                            <CaretRight
                                stroke={themeColor('text')}
                                fill={themeColor('text')}
                                width={20}
                                height={20}
                            />
                        </View>
                    </Row>
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    field: {
        justifyContent: 'center', // Centered vertically
        width: '100%',
        height: 42,
        borderRadius: 6,
        paddingLeft: 10,
        overflow: 'hidden'
    }
});
