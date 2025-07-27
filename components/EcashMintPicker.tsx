import * as React from 'react';
import { Image, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import Amount from './Amount';
import { Row } from './layout/Row';

import CashuStore from '../stores/CashuStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import CaretRight from '../assets/images/SVG/Caret Right.svg';

interface EcashMintPickerProps {
    title?: string;
    CashuStore?: CashuStore;
    navigation: StackNavigationProp<any, any>;
    hideAmount?: boolean;
    disabled?: boolean;
    showMore?: boolean;
}

@inject('CashuStore')
@observer
export default class EcashMintPicker extends React.Component<
    EcashMintPickerProps,
    {}
> {
    render() {
        const { CashuStore, hideAmount, disabled, navigation, showMore } =
            this.props;
        const {
            cashuWallets,
            mintUrls,
            selectedMintUrl,
            multiMint,
            selectedMintUrls = []
        } = CashuStore!!;

        let mints: any = {};
        mintUrls.forEach((mintUrl) => {
            const wallet = cashuWallets[mintUrl];
            const mintInfo = wallet?.mintInfo;
            mints[mintUrl] = {
                ...mintInfo,
                mintUrl,
                mintBalance: wallet?.balanceSats,
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
                {mints[mintUrl]?.icon_url && (
                    <Image
                        source={{ uri: mints[mintUrl]?.icon_url }}
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 68,
                            marginRight: 10
                        }}
                    />
                )}
                <Text
                    style={{
                        ...styles.text,
                        color: mints[mintUrl]?.errorConnecting
                            ? themeColor('warning')
                            : themeColor('text'),
                        marginRight: 10,
                        flex: 1
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {mints[mintUrl]?.name
                        ? mints[mintUrl].name
                        : localeString('cashu.tapToConfigure.short')}
                </Text>
                {!hideAmount && (
                    <Amount sats={mints[mintUrl]?.mintBalance} sensitive />
                )}
            </Row>
        );

        if (showMore && multiMint && selectedMintUrls.length > 0) {
            const shown = selectedMintUrls.slice(0, 2);
            const more = selectedMintUrls.length - shown.length;
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
                        <View style={{ flex: 1, position: 'relative' }}>
                            {shown.map((mintUrl) => getRow(mintUrl))}
                            {more > 0 ? (
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
                                    <CaretRight
                                        stroke={themeColor('text')}
                                        fill={themeColor('text')}
                                        width={20}
                                        height={20}
                                    />
                                </Row>
                            ) : (
                                <View
                                    style={{
                                        position: 'absolute',
                                        right: 5,
                                        top: 0,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        width: 24
                                    }}
                                    pointerEvents="none"
                                >
                                    <CaretRight
                                        stroke={themeColor('text')}
                                        fill={themeColor('text')}
                                        width={20}
                                        height={20}
                                    />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

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
                    {getRow(selectedMintUrl, 'single')}
                    <View
                        style={{
                            position: 'absolute',
                            right: 5,
                            top: 0,
                            bottom: 0,
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: 24,
                            pointerEvents: 'none'
                        }}
                    >
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
