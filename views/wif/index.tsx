import * as React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import BalanceStore from '../../stores/BalanceStore';
import InvoicesStore from '../../stores/InvoicesStore';
import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import TransactionsStore from '../../stores/TransactionsStore';
import SweepStore from '../../stores/SweepStore';

import Button from '../../components/Button';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { Text } from 'react-native-elements';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Scan from '../../assets/images/SVG/Scan.svg';
import ShowHideToggle from '../../components/ShowHideToggle';

interface SweepProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    SweepStore: SweepStore;
    route: Route<'Sweep', { destination: string; p: string }>;
}

interface SweepState {
    privateKey: string;
    hidden: boolean;
}

@inject('NodeInfoStore', 'SettingsStore', 'SweepStore')
@observer
export default class WIFSweeper extends React.Component<
    SweepProps,
    SweepState
> {
    state = {
        privateKey: '',
        hidden: true
    };

    componentDidMount() {
        this.props.SweepStore.resetSweepError();
        this.initFromProps(this.props);
    }

    initFromProps(props: SweepProps) {
        const { route } = props;
        const scannedKey = route.params?.p;

        if (scannedKey) {
            this.setState({
                privateKey: scannedKey
            });
        }
    }

    componentDidUpdate(prevProps: SweepProps) {
        if (prevProps.route.params?.p !== this.props.route.params?.p) {
            this.initFromProps(this.props);
        }
    }

    render() {
        const { navigation, SweepStore } = this.props;
        const { privateKey, hidden } = this.state;
        const { sweepError, sweepErrorMsg, loading, isValidWif } = SweepStore;

        const ScanButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('HandlePrivateKeyQRScanner')}
            >
                <Scan fill={themeColor('text')} width={30} height={30} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Wif.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                        rightComponent={<ScanButton />}
                    />

                    {sweepError && (
                        <View>
                            <ErrorMessage
                                message={
                                    sweepErrorMsg || 'Invalid wif priv key'
                                }
                            />
                        </View>
                    )}

                    <View style={{ padding: 20, flex: 1 }}>
                        <Text style={{ color: themeColor('secondaryText') }}>
                            {localeString('views.Wif.enterPrivatekey')}
                        </Text>

                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            <TextInput
                                placeholder={localeString(
                                    'views.Wif.enterPrivatekeyPlaceholder'
                                )}
                                value={privateKey}
                                onChangeText={(text: string) =>
                                    this.setState({ privateKey: text })
                                }
                                secureTextEntry={hidden}
                                style={{ flex: 1, marginRight: 15 }}
                                locked={loading}
                            />
                            <ShowHideToggle
                                onPress={() =>
                                    this.setState({
                                        hidden: !hidden
                                    })
                                }
                            />
                        </View>
                    </View>

                    <View style={{ padding: 20, paddingBottom: 30 }}>
                        <Button
                            title={localeString('views.Wif.sweep')}
                            onPress={() => {
                                const valid = this.props.SweepStore.isValidWif(
                                    this.state.privateKey
                                );
                                if (valid) {
                                    isValidWif(this.state.privateKey);
                                }
                            }}
                            disabled={!privateKey || loading}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}
