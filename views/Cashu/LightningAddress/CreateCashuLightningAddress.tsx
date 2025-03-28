import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';

import CashuStore from '../../../stores/CashuStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';
import UnitsStore from '../../../stores/UnitsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import ZeusPayIcon from '../../../assets/images/SVG/zeus-pay.svg';

interface CreateCashuLightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    LightningAddressStore: LightningAddressStore;
    UnitsStore: UnitsStore;
    route: Route<'CreateCashuLightningAddress', { nostrPrivateKey: string }>;
}

interface MintItem {
    key: string;
    value: string;
}

interface CreateCashuLightningAddressState {
    newLightningAddress: string;
    mintList: Array<MintItem>;
    mintUrl: string;
}

@inject('CashuStore', 'LightningAddressStore', 'UnitsStore')
@observer
export default class CreateCashuLightningAddress extends React.Component<
    CreateCashuLightningAddressProps,
    CreateCashuLightningAddressState
> {
    isInitialFocus = true;

    state = {
        newLightningAddress: '',
        mintList: [],
        mintUrl: ''
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
        const { navigation, LightningAddressStore } = this.props;
        const { newLightningAddress, mintUrl, mintList } = this.state;
        const { createCashu, lightningAddressHandle, error_msg, loading } =
            LightningAddressStore;

        const mintsNotConfigured = mintList.length === 0;

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
                        {!loading && !lightningAddressHandle && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.wrapper}>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.chooseHandle'
                                            )}
                                        </Text>
                                        <View
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'row'
                                            }}
                                        >
                                            <TextInput
                                                value={newLightningAddress}
                                                onChangeText={(
                                                    text: string
                                                ) => {
                                                    this.setState({
                                                        newLightningAddress:
                                                            text
                                                    });
                                                }}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row'
                                                }}
                                                locked={mintsNotConfigured}
                                            />
                                            <Row>
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontSize: 20,
                                                        marginLeft: 5
                                                    }}
                                                >
                                                    @zeusnuts.com
                                                </Text>
                                            </Row>
                                        </View>
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
                                        title={localeString(
                                            'views.Settings.LightningAddress.create'
                                        )}
                                        onPress={() =>
                                            createCashu(
                                                newLightningAddress,
                                                mintUrl
                                            ).then((response) => {
                                                if (response.success) {
                                                    navigation.popTo(
                                                        'LightningAddress'
                                                    );
                                                }
                                            })
                                        }
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
