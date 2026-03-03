import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import { Row } from '../../components/layout/Row';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import DangerousCopySeedButton from '../../components/DangerousCopySeedButton';
import DangerousCopySeedModal from '../../components/Modals/DangerousCopySeedModal';
import SeedWarningDisclaimer from '../../components/SeedWarningDisclaimer';
import SeedWordGrid from '../../components/SeedWordGrid';
import { buttonContainerStyle } from '../../components/seedStyles';

import SettingsStore from '../../stores/SettingsStore';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { IS_BACKED_UP_KEY } from '../../utils/MigrationUtils';

import Storage from '../../storage';

import QR from '../../assets/images/SVG/QR.svg';

interface SeedProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface SeedState {
    understood: boolean;
    showModal: boolean;
}

@inject('SettingsStore')
@observer
export default class Seed extends React.PureComponent<SeedProps, SeedState> {
    state = {
        understood: false,
        showModal: false
    };

    componentDidMount() {
        // make sure we have latest settings and the seed phrase is accessible
        this.props.SettingsStore.getSettings();
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { understood, showModal } = this.state;
        const seedPhrase = SettingsStore.seedPhrase;

        const QRExport = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('SeedQRExport')}
                style={{ marginLeft: 14 }}
            >
                <QR fill={themeColor('text')} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Seed.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        understood && seedPhrase?.length > 0 ? (
                            <Row>
                                <DangerousCopySeedButton
                                    onPress={() =>
                                        this.setState({ showModal: true })
                                    }
                                    style={{ marginLeft: 10 }}
                                />
                                <QRExport />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <DangerousCopySeedModal
                    visible={showModal}
                    seedPhrase={seedPhrase || []}
                    onClose={() => this.setState({ showModal: false })}
                />
                {!understood && (
                    <SeedWarningDisclaimer
                        text1Key="views.Settings.Seed.text1"
                        text2Key="views.Settings.Seed.text2"
                        onUnderstood={() => this.setState({ understood: true })}
                    />
                )}
                {understood && seedPhrase?.length > 0 && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <SeedWordGrid seedPhrase={seedPhrase} />
                        <View style={buttonContainerStyle()}>
                            <Button
                                onPress={async () => {
                                    await Storage.setItem(
                                        IS_BACKED_UP_KEY,
                                        true
                                    );
                                    navigation.popTo('Wallet');
                                }}
                                title={localeString(
                                    'views.Settings.Seed.backupComplete'
                                )}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}
