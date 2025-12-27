import * as React from 'react';
import {
    FlatList,
    Image,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { Button, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import ButtonComponent from '../../components/Button';
import { Row } from '../../components/layout/Row';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import Add from '../../assets/images/SVG/Add.svg';

interface MintsProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
    route: Route<'Mints', { forceSingleMint: boolean }>;
}

interface MintsState {
    mints: any[];
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

    handleFocus = () => {
        const { CashuStore, SettingsStore } = this.props;
        const { cashuWallets, mintUrls } = CashuStore;

        const allMints = mintUrls.map((mintUrl) => ({
            ...(cashuWallets[mintUrl]?.mintInfo || {}),
            mintUrl,
            mintBalance: cashuWallets[mintUrl]?.balanceSats ?? 0,
            errorConnecting: cashuWallets[mintUrl]?.errorConnecting ?? false
        }));

        this.setState({ mints: allMints });

        if (SettingsStore.settings.ecash.enableMultiMint) {
            this.syncMultiMintSelection(allMints);
        }
    };

    syncMultiMintSelection = async (allMints: any[]) => {
        const { CashuStore, SettingsStore } = this.props;

        const nut15MintUrls = allMints
            .filter((m) => m.nuts && m.nuts[15])
            .map((m) => m.mintUrl);

        const selectedFromSettings =
            SettingsStore.settings.lightningAddress.mintUrls || [];

        let validSelection = selectedFromSettings.filter((url) =>
            nut15MintUrls.includes(url)
        );

        if (validSelection.length === 0 && nut15MintUrls.length > 0) {
            validSelection = nut15MintUrls;
        }

        await SettingsStore.updateSettings({
            lightningAddress: {
                mintUrls: validSelection
            }
        });

        await CashuStore.setSelectedMintUrls(validSelection);
    };

    renderSeparator = () => (
        <View
            style={{ height: 0.4, backgroundColor: themeColor('separator') }}
        />
    );

    render() {
        const { navigation, CashuStore, SettingsStore } = this.props;
        const { mints } = this.state;
        const {
            selectedMintUrl,
            selectedMintUrls = [],
            clearInvoice,
            setSelectedMint,
            toggleMintSelection
        } = CashuStore;

        const { settings } = SettingsStore;
        const forceSingleMint = this.props.route.params?.forceSingleMint;

        const multiMint = settings.ecash.enableMultiMint && !forceSingleMint;

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
                    onBack={clearInvoice}
                />

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
                            const supportsMultinut =
                                mintInfo?.nuts && mintInfo.nuts[15];
                            const isDisabled = multiMint && !supportsMultinut;
                            const isSelectedMint = multiMint
                                ? selectedMintUrls.includes(mintInfo?.mintUrl)
                                : selectedMintUrl === mintInfo?.mintUrl;
                            const errorConnecting = item.errorConnecting;

                            let subTitle = isSelectedMint
                                ? `${localeString('general.selected')} | ${
                                      item.mintUrl
                                  }`
                                : item.mintUrl;

                            if (errorConnecting) {
                                subTitle = `${localeString(
                                    'general.errorConnecting'
                                )} | ${subTitle}`;
                            }

                            return (
                                <React.Fragment key={`mint-${index}`}>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent',
                                            opacity: isDisabled ? 0.4 : 1
                                        }}
                                        disabled={isDisabled}
                                        onPress={async () => {
                                            if (isDisabled) {
                                                return;
                                            }
                                            const forceSingleMint =
                                                this.props.route.params
                                                    ?.forceSingleMint;

                                            if (multiMint && !forceSingleMint) {
                                                await toggleMintSelection(
                                                    mintInfo?.mintUrl
                                                );
                                            } else if (forceSingleMint) {
                                                await CashuStore.setReceiveMint(
                                                    mintInfo?.mintUrl
                                                );
                                                navigation.goBack();
                                            } else {
                                                await setSelectedMint(
                                                    mintInfo?.mintUrl
                                                );
                                                navigation.goBack();
                                            }
                                        }}
                                    >
                                        {multiMint && supportsMultinut && (
                                            <Icon
                                                name={
                                                    isSelectedMint
                                                        ? 'check-box'
                                                        : 'check-box-outline-blank'
                                                }
                                                color={
                                                    isSelectedMint
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
                                        {mintInfo?.icon_url && (
                                            <Image
                                                source={{
                                                    uri: mintInfo?.icon_url
                                                }}
                                                style={{
                                                    alignSelf: 'center',
                                                    width: 42,
                                                    height: 42,
                                                    borderRadius: 68,
                                                    opacity: isDisabled
                                                        ? 0.4
                                                        : 1
                                                }}
                                            />
                                        )}
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
                                                        {mintInfo.name}
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
                {multiMint && (
                    <View
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 15,
                            paddingHorizontal: 16,
                            backgroundColor: 'transparent',
                            zIndex: 20
                        }}
                    >
                        <ButtonComponent
                            title={localeString('general.confirm')}
                            onPress={() => navigation.goBack()}
                            containerStyle={{ marginTop: 15 }}
                            noUppercase
                        />
                    </View>
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
