import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { inject, observer } from 'mobx-react';

import Amount from './Amount';
import MintAvatar from './MintAvatar';
import { Row } from './layout/Row';

import CashuStore from '../stores/CashuStore';
import SettingsStore from '../stores/SettingsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import CaretRight from '../assets/images/SVG/Caret Right.svg';
import Dice from '../assets/images/SVG/Dice.svg';

interface EcashMintPickerProps {
    CashuStore?: CashuStore;
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore?: SettingsStore;
    hideAmount?: boolean;
    disabled?: boolean;
    disableRandom?: boolean;
    overrideMintUrl?: string;
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
            disableRandom,
            navigation,
            overrideMintUrl,
            isReceiveView
        } = this.props;
        const {
            cashuWallets,
            mintUrls,
            selectedMintUrl,
            selectedMintUrls,
            mintInfos,
            mintBalances,
            randomizeMintSelection
        } = CashuStore!!;
        const multiMintEnabled =
            !!SettingsStore?.settings?.ecash?.enableMultiMint;
        const openMints = () => navigation.navigate('Mints');
        const pickerTouchableStyle = {
            opacity: disabled ? 0.25 : 1,
            backgroundColor: themeColor('secondary'),
            ...styles.field
        };

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

        const getRow = (mintUrl: string, key: string | number = mintUrl) => (
            <Row key={key} style={styles.pickerRow}>
                <MintAvatar
                    iconUrl={mints[mintUrl]?.icon_url}
                    name={mints[mintUrl]?.name}
                    size="small"
                    style={styles.leadingIcon}
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
                    <View style={styles.amountContainer}>
                        <Amount sats={mints[mintUrl]?.mintBalance} sensitive />
                    </View>
                )}
            </Row>
        );

        const selectedMints = selectedMintUrls || [];
        const selectedMintBalance = selectedMints.reduce(
            (total: number, mintUrl: string) =>
                total + Number(mints[mintUrl]?.mintBalance || 0),
            0
        );
        const multiMintLabel =
            selectedMints.length >= 3
                ? '...'
                : `${selectedMints.length} ${localeString('cashu.mints')}`;

        const getMintIcons = (mintList: string[]) => {
            const displayMints = mintList.slice(0, 3);
            const remainingCount = mintList.length - displayMints.length;

            return (
                <View style={styles.mintIconsContainer}>
                    {displayMints.map((mintUrl, index) => (
                        <View
                            key={mintUrl}
                            style={[
                                styles.mintIconWrapper,
                                {
                                    marginLeft: index > 0 ? -8 : 0,
                                    zIndex: 3 - index
                                }
                            ]}
                        >
                            <MintAvatar
                                iconUrl={mints[mintUrl]?.icon_url}
                                name={mints[mintUrl]?.name}
                                size="small"
                            />
                        </View>
                    ))}
                    {remainingCount > 0 && (
                        <Text
                            style={{
                                ...styles.moreMintsText,
                                color: themeColor('secondaryText')
                            }}
                        >
                            +{remainingCount}
                        </Text>
                    )}
                </View>
            );
        };

        if (multiMintEnabled && !isReceiveView) {
            if (selectedMints.length === 0) {
                return (
                    <View style={styles.wrapperRow}>
                        <TouchableOpacity
                            onPress={openMints}
                            style={pickerTouchableStyle}
                        >
                            <Row style={styles.pickerRow}>
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
                    <View style={styles.wrapperRow}>
                        <TouchableOpacity
                            onPress={openMints}
                            style={pickerTouchableStyle}
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

            return (
                <View style={styles.wrapperRow}>
                    <TouchableOpacity
                        onPress={openMints}
                        style={pickerTouchableStyle}
                    >
                        <Row style={[styles.pickerRow, styles.multiMintRow]}>
                            {getMintIcons(selectedMints)}
                            <Text
                                style={{
                                    ...styles.multiMintText,
                                    color: themeColor('text'),
                                    flex: 1,
                                    flexShrink: 1,
                                    minWidth: 0,
                                    marginLeft: 10,
                                    marginRight: 8
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {multiMintLabel}
                            </Text>
                            {!hideAmount && (
                                <View style={styles.amountContainer}>
                                    <Amount
                                        sats={selectedMintBalance}
                                        sensitive
                                    />
                                </View>
                            )}
                            <View style={styles.inlineCaretContainer}>
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

        return (
            <View style={styles.wrapperRow}>
                <TouchableOpacity
                    onPress={() => {
                        navigation.navigate('Mints', {
                            disableRandom,
                            forceSingleMint: multiMintEnabled && isReceiveView
                        });
                    }}
                    style={pickerTouchableStyle}
                >
                    <Row style={{ flex: 1 }}>
                        {showRandom ? (
                            <Dice
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                                style={styles.leadingIcon}
                            />
                        ) : (
                            <MintAvatar
                                iconUrl={mints[displayMintUrl]?.icon_url}
                                name={mints[displayMintUrl]?.name}
                                mintUrl={displayMintUrl}
                                size="small"
                                style={styles.leadingIcon}
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
                            <View style={styles.amountContainer}>
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
    wrapperRow: {
        flex: 1,
        flexDirection: 'row'
    },
    pickerRow: {
        height: 42,
        alignItems: 'center',
        paddingRight: 34,
        backgroundColor: 'transparent'
    },
    multiMintRow: {
        flex: 1,
        paddingRight: 8
    },
    text: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book'
    },
    multiMintText: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book'
    },
    field: {
        justifyContent: 'center', // Centered vertically
        width: '100%',
        height: 42,
        borderRadius: 6,
        paddingLeft: 10,
        overflow: 'hidden'
    },
    leadingIcon: {
        marginRight: 10,
        flexShrink: 0
    },
    amountContainer: {
        marginRight: 8,
        flexShrink: 0
    },
    inlineCaretContainer: {
        width: 24,
        flexShrink: 0,
        justifyContent: 'center',
        alignItems: 'center'
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
    },
    mintIconsContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    mintIconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    moreMintsText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        marginLeft: 4
    }
});
