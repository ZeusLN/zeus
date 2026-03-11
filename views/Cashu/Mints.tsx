import * as React from 'react';
import {
    FlatList,
    Text,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { Button, Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import cloneDeep from 'lodash/cloneDeep';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import MintAvatar from '../../components/MintAvatar';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import { Row } from '../../components/layout/Row';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import Add from '../../assets/images/SVG/Add.svg';

interface MintsProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
    route: Route<
        'Mints',
        { disableRandom?: boolean; forceSingleMint?: boolean }
    >;
}

interface MintsState {
    mints: any;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class Mints extends React.Component<MintsProps, MintsState> {
    state = {
        mints: []
    };

    focusListener: any = null;

    componentDidMount(): void {
        const { navigation } = this.props;

        this.focusListener = navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount(): void {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    handleFocus = async () => {
        const { CashuStore, SettingsStore } = this.props;
        const { cashuWallets, mintUrls, mintInfos, mintBalances } = CashuStore;
        const mints: any = [];
        mintUrls.forEach((mintUrl) => {
            const wallet = cashuWallets[mintUrl];
            const mintInfo = mintInfos[mintUrl];
            mints.push({
                ...mintInfo,
                mintUrl,
                mintBalance: mintBalances[mintUrl] || 0,
                errorConnecting: wallet?.errorConnecting
            });
        });

        this.setState({
            mints
        });

        if (SettingsStore.settings?.ecash?.enableMultiMint) {
            this.syncMultiMintSelection(mints);
        }
    };

    syncMultiMintSelection = async (allMints: any[]) => {
        const { CashuStore } = this.props;

        const nut15MintUrls = allMints
            .filter((mint) => mint?.nuts && (mint.nuts[15] || mint.nuts['15']))
            .map((mint) => mint.mintUrl);

        if (nut15MintUrls.length === 0) {
            return;
        }

        const selectedFromStore = CashuStore.selectedMintUrls || [];
        const validSelection = selectedFromStore.filter((mintUrl) =>
            nut15MintUrls.includes(mintUrl)
        );

        const nextSelection =
            validSelection.length > 0 ? validSelection : nut15MintUrls;

        await CashuStore.setSelectedMintUrls(nextSelection);
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
        const { navigation, CashuStore, SettingsStore, route } = this.props;
        const { mints } = this.state;
        const disableRandom = route?.params?.disableRandom;
        const {
            selectedMintUrl,
            selectedMintUrls,
            clearInvoice,
            setSelectedMint,
            setReceiveMint,
            toggleMintSelection,
            randomizeMintSelection,
            setRandomizeMintSelection
        } = CashuStore;
        const forceSingleMint = !!route.params?.forceSingleMint;
        const multiMintEnabled =
            !!SettingsStore.settings?.ecash?.enableMultiMint &&
            !forceSingleMint;

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

        return (
            <Screen>
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
                {!!mints &&
                    mints.length > 1 &&
                    !disableRandom &&
                    !multiMintEnabled && (
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingHorizontal: 16,
                                paddingVertical: 10
                            }}
                        >
                            <Row style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 16
                                    }}
                                >
                                    {localeString(
                                        'cashu.randomizeMintSelection'
                                    )}
                                </Text>
                            </Row>
                            <Switch
                                value={randomizeMintSelection}
                                onValueChange={() =>
                                    setRandomizeMintSelection(
                                        !randomizeMintSelection
                                    )
                                }
                            />
                        </View>
                    )}
                {!!mints && mints.length > 0 ? (
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
                            const isSelectedMint = multiMintEnabled
                                ? !!mintInfo?.mintUrl &&
                                  selectedMintUrls.includes(mintInfo?.mintUrl)
                                : (!randomizeMintSelection || disableRandom) &&
                                  selectedMintUrl &&
                                  mintInfo?.mintUrl &&
                                  selectedMintUrl === mintInfo?.mintUrl;
                            const supportsMultinut =
                                !!mintInfo?.nuts &&
                                !!(mintInfo.nuts[15] || mintInfo.nuts['15']);
                            const isDisabled =
                                multiMintEnabled && !supportsMultinut;
                            const errorConnecting = item.errorConnecting;
                            const hasName = !!mintInfo?.name;

                            let subTitle = hasName
                                ? isSelectedMint
                                    ? `${localeString('general.selected')} | ${
                                          item.mintUrl
                                      }`
                                    : item.mintUrl
                                : isSelectedMint
                                ? localeString('general.selected')
                                : '';

                            if (errorConnecting) {
                                subTitle = subTitle
                                    ? `${localeString(
                                          'general.errorConnecting'
                                      )} | ${subTitle}`
                                    : localeString('general.errorConnecting');
                            }

                            if (multiMintEnabled && isDisabled) {
                                subTitle = `${subTitle} | ${localeString(
                                    'views.Cashu.Mints.nut15Required'
                                )}`;
                            }

                            return (
                                <React.Fragment>
                                    <ListItem
                                        key={`mint-${index}`}
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent',
                                            opacity: isDisabled ? 0.4 : 1
                                        }}
                                        onPress={async () => {
                                            if (isDisabled) {
                                                return;
                                            }

                                            if (multiMintEnabled) {
                                                await toggleMintSelection(
                                                    mintInfo?.mintUrl
                                                );
                                                return;
                                            }

                                            if (forceSingleMint) {
                                                await setReceiveMint(
                                                    mintInfo?.mintUrl
                                                ).then(() => {
                                                    navigation.goBack();
                                                });
                                                return;
                                            }

                                            if (
                                                randomizeMintSelection &&
                                                !disableRandom
                                            ) {
                                                await setRandomizeMintSelection(
                                                    false
                                                );
                                            }

                                            await setSelectedMint(
                                                mintInfo?.mintUrl
                                            ).then(() => {
                                                navigation.goBack();
                                            });
                                        }}
                                    >
                                        {multiMintEnabled && (
                                            <Icon
                                                name={
                                                    isSelectedMint
                                                        ? 'check-box'
                                                        : 'check-box-outline-blank'
                                                }
                                                color={
                                                    isDisabled
                                                        ? themeColor(
                                                              'secondaryText'
                                                          )
                                                        : isSelectedMint
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : themeColor(
                                                              'secondaryText'
                                                          )
                                                }
                                                size={24}
                                                style={{ marginRight: 10 }}
                                            />
                                        )}
                                        <MintAvatar
                                            iconUrl={mintInfo?.icon_url}
                                            name={mintInfo?.name}
                                            mintUrl={mintInfo?.mintUrl}
                                            size="medium"
                                            style={{ alignSelf: 'center' }}
                                        />
                                        <ListItem.Content>
                                            <View>
                                                <View style={styles.row}>
                                                    <ListItem.Title
                                                        style={{
                                                            ...styles.leftCell,
                                                            color: errorConnecting
                                                                ? themeColor(
                                                                      'error'
                                                                  )
                                                                : isDisabled
                                                                ? themeColor(
                                                                      'secondaryText'
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
                                                        {mintInfo.name ||
                                                            item.mintUrl}
                                                    </ListItem.Title>
                                                </View>
                                                <View style={styles.row}>
                                                    <ListItem.Subtitle
                                                        style={{
                                                            ...styles.leftCell,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            ),
                                                            fontSize: 12,
                                                            fontFamily:
                                                                'Lato-Regular',
                                                            flexWrap: 'wrap',
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
                                                <View style={{ right: 15 }}>
                                                    <Amount
                                                        sats={item.mintBalance}
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
                                                    color={themeColor('text')}
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
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                    />
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
    }
});
