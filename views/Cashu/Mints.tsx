import * as React from 'react';
import {
    FlatList,
    Image,
    View,
    StyleSheet,
    TouchableOpacity,
    Text
} from 'react-native';
import { Button, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import { Row } from '../../components/layout/Row';
import Switch from '../../components/Switch';
import DropdownSetting from '../../components/DropdownSetting';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuStore from '../../stores/CashuStore';

import Add from '../../assets/images/SVG/Add.svg';

interface MintsProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'Mints'>;
}

interface MintsState {
    mints: any;
}

const rotationDurations = [
    {
        key: '12' + ' ' + localeString('time.hours'),
        value: '43200000'
    },
    {
        key: '24' + ' ' + localeString('time.hours'),
        value: '86400000'
    },
    {
        key: '48' + ' ' + localeString('time.hours'),
        value: '172800000'
    },
    {
        key: '7' + ' ' + localeString('time.days'),
        value: '604800000'
    }
];

@inject('CashuStore')
@observer
export default class Mints extends React.Component<MintsProps, MintsState> {
    state = {
        mints: []
    };

    UNSAFE_componentWillMount(): void {
        const { navigation } = this.props;
        // triggers when loaded from navigation or back action
        navigation.addListener('focus', this.handleFocus);
    }

    handleFocus = () => {
        const { CashuStore } = this.props;
        const { cashuWallets, mintUrls } = CashuStore;
        let mints: any = [];
        mintUrls.forEach((mintUrl) => {
            const wallet = cashuWallets[mintUrl];
            const mintInfo = wallet.mintInfo;
            mints.push({
                ...mintInfo,
                mintUrl,
                mintBalance: wallet.balanceSats,
                errorConnecting: wallet.errorConnecting
            });
        });

        this.setState({
            mints
        });
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, CashuStore } = this.props;
        const { mints } = this.state;
        const {
            selectedMintUrl,
            clearInvoice,
            setSelectedMint,
            rotateMints,
            setRotateMints,
            setMintRotationInterval,
            mintRotationInterval,
            lastMintRotation
        } = CashuStore;

        const AddMintButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('AddMint')}
                accessibilityLabel={localeString('views.Cashu.AddMint.title')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const RotateMintsSwitch = () => (
            <View
                style={{
                    ...styles.stickyBottomContainer,
                    borderTopColor: themeColor('secondary')
                }}
            >
                <>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingTop: 10
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 16
                                }}
                            >
                                {localeString('views.Cashu.Mint.rotateMints')}
                            </Text>
                        </View>
                        <Switch
                            value={rotateMints}
                            onValueChange={async (value: boolean) => {
                                await setRotateMints(value);
                            }}
                        />
                    </View>
                    {rotateMints && (
                        <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 16
                                }}
                            >
                                {localeString(
                                    'views.Cashu.LightningAddressInfo.selectRotationDuration'
                                )}
                            </Text>
                            <DropdownSetting
                                selectedValue={mintRotationInterval.toString()}
                                values={rotationDurations}
                                onValueChange={async (value: string) => {
                                    await setMintRotationInterval(
                                        parseInt(value)
                                    );
                                }}
                            />
                            <View style={{ marginTop: 10 }}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 14,
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {lastMintRotation > 0
                                        ? `${localeString(
                                              'views.Cashu.LightningAddressInfo.nextRotation'
                                          )}: ${new Date(
                                              lastMintRotation +
                                                  mintRotationInterval
                                          ).toLocaleString()}`
                                        : localeString(
                                              'views.Cashu.LightningAddressInfo.rotationNotStarted'
                                          )}
                                </Text>
                            </View>
                        </View>
                    )}
                </>
            </View>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text:
                                mints.length > 0
                                    ? `${localeString('cashu.mints')} (${
                                          mints.length
                                      })`
                                    : localeString('cashu.mints'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={<AddMintButton />}
                        navigation={navigation}
                        onBack={() => {
                            clearInvoice();
                        }}
                    />
                    <View style={{ flex: 1 }}>
                        {!!mints && mints.length > 0 ? (
                            <>
                                <FlatList
                                    data={mints}
                                    renderItem={({
                                        item,
                                        index
                                    }: {
                                        item: any;
                                        index: number;
                                    }) => {
                                        const mintInfo = item._mintInfo || item;
                                        const isSelectedMint =
                                            selectedMintUrl &&
                                            mintInfo?.mintUrl &&
                                            selectedMintUrl ===
                                                mintInfo?.mintUrl;
                                        const errorConnecting =
                                            item.errorConnecting;

                                        let subTitle = isSelectedMint
                                            ? `${localeString(
                                                  'general.selected'
                                              )} | ${item.mintUrl}`
                                            : item.mintUrl;

                                        if (errorConnecting) {
                                            subTitle = `${localeString(
                                                'general.errorConnecting'
                                            )} | ${subTitle}`;
                                        }
                                        return (
                                            <React.Fragment>
                                                <ListItem
                                                    key={`mint-${index}`}
                                                    containerStyle={{
                                                        borderBottomWidth: 0,
                                                        backgroundColor:
                                                            'transparent'
                                                    }}
                                                    onPress={async () => {
                                                        await setSelectedMint(
                                                            mintInfo?.mintUrl
                                                        ).then(() => {
                                                            navigation.goBack();
                                                        });
                                                    }}
                                                >
                                                    {mintInfo?.icon_url && (
                                                        <Image
                                                            source={{
                                                                uri: mintInfo?.icon_url
                                                            }}
                                                            style={{
                                                                alignSelf:
                                                                    'center',
                                                                width: 42,
                                                                height: 42,
                                                                borderRadius: 68
                                                            }}
                                                        />
                                                    )}
                                                    <ListItem.Content>
                                                        <View>
                                                            <View
                                                                style={
                                                                    styles.row
                                                                }
                                                            >
                                                                <ListItem.Title
                                                                    style={{
                                                                        ...styles.leftCell,
                                                                        color: errorConnecting
                                                                            ? themeColor(
                                                                                  'error'
                                                                              )
                                                                            : isSelectedMint
                                                                            ? themeColor(
                                                                                  'highlight'
                                                                              )
                                                                            : themeColor(
                                                                                  'text'
                                                                              ),
                                                                        fontSize: 18
                                                                    }}
                                                                >
                                                                    {
                                                                        mintInfo.name
                                                                    }
                                                                </ListItem.Title>
                                                            </View>
                                                            <View
                                                                style={
                                                                    styles.row
                                                                }
                                                            >
                                                                <ListItem.Subtitle
                                                                    style={{
                                                                        ...styles.leftCell,
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        ),
                                                                        fontSize: 12,
                                                                        fontFamily:
                                                                            'Lato-Regular',
                                                                        flexWrap:
                                                                            'wrap',
                                                                        flexShrink: 1
                                                                    }}
                                                                >
                                                                    {subTitle}
                                                                </ListItem.Subtitle>
                                                            </View>
                                                        </View>
                                                    </ListItem.Content>
                                                    <View>
                                                        <Row>
                                                            <View
                                                                style={{
                                                                    right: 15
                                                                }}
                                                            >
                                                                <Amount
                                                                    sats={
                                                                        item.mintBalance
                                                                    }
                                                                    sensitive
                                                                />
                                                            </View>
                                                            <Icon
                                                                name="info"
                                                                onPress={() => {
                                                                    navigation.navigate(
                                                                        'Mint',
                                                                        {
                                                                            mint: cloneDeep(
                                                                                mintInfo
                                                                            )
                                                                        }
                                                                    );
                                                                }}
                                                                color={themeColor(
                                                                    'text'
                                                                )}
                                                                underlayColor="transparent"
                                                                size={35}
                                                            />
                                                        </Row>
                                                    </View>
                                                </ListItem>
                                            </React.Fragment>
                                        );
                                    }}
                                    keyExtractor={(_, index) => `mint-${index}`}
                                    ItemSeparatorComponent={
                                        this.renderSeparator
                                    }
                                    onEndReachedThreshold={50}
                                />
                                <RotateMintsSwitch />
                            </>
                        ) : (
                            <Button
                                title={localeString('views.Mints.noMints')}
                                icon={{
                                    name: 'error-outline',
                                    size: 25,
                                    color: themeColor('text')
                                }}
                                buttonStyle={{
                                    backgroundColor: 'transparent',
                                    borderRadius: 30
                                }}
                                titleStyle={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            />
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        flexGrow: 0,
        flexShrink: 1
    },
    rightCell: {
        flexGrow: 0,
        flexShrink: 1,
        textAlign: 'right'
    },
    stickyBottomContainer: {
        backgroundColor: 'transparent',
        borderTopWidth: 0.4,
        paddingBottom: 16,
        paddingTop: 0
    }
});
