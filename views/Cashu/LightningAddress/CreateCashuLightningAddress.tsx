import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';

import CashuStore from '../../../stores/CashuStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';
import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import ZeusPayIcon from '../../../assets/images/SVG/zeus-pay.svg';

interface CreateCashuLightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    route: Route<'CreateCashuLightningAddress', { switchTo: boolean }>;
}

interface MintItem {
    key: string;
    value: string;
}

interface CreateCashuLightningAddressState {
    mintList: Array<MintItem>;
    mintUrl: string;
    loading: boolean;
}

@inject('CashuStore', 'LightningAddressStore', 'SettingsStore')
@observer
export default class CreateCashuLightningAddress extends React.Component<
    CreateCashuLightningAddressProps,
    CreateCashuLightningAddressState
> {
    isInitialFocus = true;

    state = {
        mintList: [],
        mintUrl: '',
        loading: false
    };

    async componentDidMount() {
        const { navigation } = this.props;

        this.loadMints();

        // triggers when loaded from navigation or back action
        navigation.addListener('focus', this.handleFocus);
    }

    loadMints = () => {
        const { CashuStore } = this.props;
        const { selectedMintUrl, mintUrls, cashuWallets } = CashuStore;

        const mintList: Array<MintItem> = mintUrls
            ? mintUrls.map((mintUrl) => {
                  return {
                      key: cashuWallets[mintUrl].mintInfo.name,
                      value: mintUrl
                  };
              })
            : [];

        this.setState({
            mintList,
            mintUrl: selectedMintUrl
        });
    };

    handleFocus = () => {
        if (this.isInitialFocus) {
            this.isInitialFocus = false;
        } else {
            this.loadMints();
        }
    };

    render() {
        const { navigation, LightningAddressStore, SettingsStore, route } =
            this.props;
        const { mintUrl, mintList } = this.state;
        const { createCashu, update, deleteLocalHashes, error_msg } =
            LightningAddressStore;
        const { updateSettings, settings }: any = SettingsStore;
        const switchTo = route.params?.switchTo;

        const mintsNotConfigured = mintList.length === 0;

        const loading = this.state.loading || LightningAddressStore.loading;

        const InfoButton = () => (
            <View>
                <Icon
                    name="info"
                    onPress={() => {
                        navigation.navigate('CashuLightningAddressInfo');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={
                            <ZeusPayIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        }
                        rightComponent={
                            !loading ? (
                                <Row align="flex-end">
                                    <InfoButton />
                                </Row>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.wrapper}>
                                        {mintsNotConfigured ? (
                                            <View style={{ marginTop: 20 }}>
                                                <Button
                                                    title={localeString(
                                                        'cashu.tapToConfigure'
                                                    )}
                                                    warning
                                                    onPress={() =>
                                                        navigation.navigate(
                                                            'Mints'
                                                        )
                                                    }
                                                />
                                            </View>
                                        ) : (
                                            <DropdownSetting
                                                title={localeString(
                                                    'cashu.mint'
                                                )}
                                                selectedValue={
                                                    this.props.CashuStore
                                                        ?.cashuWallets[mintUrl]
                                                        ?.mintInfo?.name || ''
                                                }
                                                values={mintList}
                                                onValueChange={(
                                                    value: string
                                                ) => {
                                                    this.setState({
                                                        mintUrl: value
                                                    });
                                                }}
                                            />
                                        )}
                                    </View>
                                </View>
                                <View style={{ bottom: 15, margin: 10 }}>
                                    <Button
                                        title={
                                            switchTo
                                                ? localeString(
                                                      'views.Settings.LightningAddress.switchToCashu'
                                                  )
                                                : localeString(
                                                      'views.Settings.LightningAddress.create'
                                                  )
                                        }
                                        onPress={async () => {
                                            if (switchTo) {
                                                this.setState({
                                                    loading: true
                                                });
                                                await update({
                                                    mint_url: mintUrl,
                                                    address_type: 'cashu'
                                                }).then(async (response) => {
                                                    if (response.success) {
                                                        await deleteLocalHashes();
                                                        await updateSettings({
                                                            lightningAddress: {
                                                                ...settings.lightningAddress,
                                                                mintUrl
                                                            }
                                                        });
                                                        navigation.popTo(
                                                            'LightningAddress'
                                                        );
                                                    } else {
                                                        this.setState({
                                                            loading: false
                                                        });
                                                    }
                                                });
                                            } else {
                                                createCashu(mintUrl).then(
                                                    (response) => {
                                                        if (response.success) {
                                                            navigation.popTo(
                                                                'LightningAddress'
                                                            );
                                                        }
                                                    }
                                                );
                                            }
                                        }}
                                        disabled={mintsNotConfigured}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    explainer: {
        fontSize: 20,
        marginBottom: 10
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
