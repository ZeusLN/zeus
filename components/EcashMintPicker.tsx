import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import Amount from './Amount';
import MintAvatar from './MintAvatar';
import { Row } from './layout/Row';

import CashuStore from '../stores/CashuStore';
import SettingsStore from '../stores/SettingsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import CaretRight from '../assets/images/SVG/Caret Right.svg';

interface EcashMintPickerProps {
    title?: string;
    CashuStore?: CashuStore;
    SettingsStore?: SettingsStore;
    navigation: StackNavigationProp<any, any>;
    hideAmount?: boolean;
    disabled?: boolean;
    isReceiveView?: boolean;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class EcashMintPicker extends React.Component<
    EcashMintPickerProps,
    {}
> {
    render() {
        const {
            CashuStore,
            SettingsStore,
            hideAmount,
            disabled,
            navigation,
            isReceiveView
        } = this.props;
        const {
            cashuWallets,
            mintUrls,
            selectedMintUrl,
            selectedMintUrls,
            mintInfos,
            mintBalances
        } = CashuStore!!;
        const multiMintEnabled =
            !!SettingsStore?.settings?.ecash?.enableMultiMint;

        const mints: any = {};
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

        const getRow = (mintUrl: string, key: string | number = mintUrl) => (
            <Row
                key={key}
                style={{
                    height: 42,
                    alignItems: 'center',
                    paddingRight: 34,
                    marginBottom: 0,
                    backgroundColor: 'transparent'
                }}
            >
                <MintAvatar
                    iconUrl={mints[mintUrl]?.icon_url}
                    name={mints[mintUrl]?.name}
                    size="small"
                    style={{
                        marginRight: 10,
                        flexShrink: 0
                    }}
                />
                <Text
                    style={{
                        ...styles.text,
                        color: mints[mintUrl]?.errorConnecting
                            ? themeColor('warning')
                            : themeColor('text'),
                        flex: 1,
                        flexShrink: 1,
                        minWidth: 0
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {mints[mintUrl]?.name
                        ? mints[mintUrl].name
                        : localeString('cashu.tapToConfigure.short')}
                </Text>
                {!hideAmount && (
                    <View
                        style={{
                            marginRight: 8,
                            flexShrink: 0
                        }}
                    >
                        <Amount sats={mints[mintUrl]?.mintBalance} sensitive />
                    </View>
                )}
            </Row>
        );

        const selectedMints = selectedMintUrls || [];

        if (multiMintEnabled && !isReceiveView) {
            if (selectedMints.length === 0) {
                return (
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Mints')}
                            style={{
                                opacity: disabled ? 0.25 : 1,
                                backgroundColor: themeColor('secondary'),
                                ...styles.field
                            }}
                        >
                            <Row
                                style={{
                                    height: 42,
                                    alignItems: 'center',
                                    paddingRight: 34,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('warning'),
                                        flex: 1
                                    }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {localeString(
                                        'views.Cashu.MultimintPayment.noMintsSelected'
                                    )}
                                </Text>
                                <CaretRight
                                    stroke={themeColor('text')}
                                    fill={themeColor('text')}
                                    width={20}
                                    height={20}
                                />
                            </Row>
                        </TouchableOpacity>
                    </View>
                );
            }

            if (selectedMints.length === 1) {
                return (
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Mints')}
                            style={{
                                opacity: disabled ? 0.25 : 1,
                                backgroundColor: themeColor('secondary'),
                                ...styles.field
                            }}
                        >
                            {getRow(selectedMints[0], 'single')}
                            <View style={styles.caretContainer}>
                                <CaretRight
                                    stroke={themeColor('text')}
                                    fill={themeColor('text')}
                                    width={20}
                                    height={20}
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            }

            const shown = selectedMints.slice(0, 2);
            const more = selectedMints.length - shown.length;
            const totalRows = shown.length + (more > 0 ? 1 : 0);

            return (
                <View style={{ flex: 1, flexDirection: 'row' }}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Mints')}
                        style={{
                            opacity: disabled ? 0.25 : 1,
                            backgroundColor: themeColor('secondary'),
                            ...styles.field,
                            height: 42 * totalRows,
                            marginBottom: 12
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            {shown.map((mintUrl) => getRow(mintUrl))}
                            {more > 0 && (
                                <Row
                                    style={{
                                        height: 42,
                                        alignItems: 'center',
                                        paddingRight: 34,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 15,
                                            flex: 1
                                        }}
                                    >{`+${more} more`}</Text>
                                </Row>
                            )}
                            <View style={styles.caretContainer}>
                                <CaretRight
                                    stroke={themeColor('text')}
                                    fill={themeColor('text')}
                                    width={20}
                                    height={20}
                                />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, flexDirection: 'row' }}>
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('Mints', {
                            forceSingleMint: multiMintEnabled && isReceiveView
                        })
                    }
                    style={{
                        opacity: disabled ? 0.25 : 1,
                        backgroundColor: themeColor('secondary'),
                        ...styles.field
                    }}
                >
                    {getRow(selectedMintUrl, 'single')}
                    <View style={styles.caretContainer}>
                        <CaretRight
                            stroke={themeColor('text')}
                            fill={themeColor('text')}
                            width={20}
                            height={20}
                        />
                    </View>
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
    field: {
        justifyContent: 'center',
        width: '100%',
        height: 42,
        borderRadius: 6,
        paddingLeft: 10,
        overflow: 'hidden'
    },
    caretContainer: {
        position: 'absolute',
        right: 5,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        width: 24,
        pointerEvents: 'none'
    }
});
