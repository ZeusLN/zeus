import React from 'react';
import { View } from 'react-native';
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

import CashuStore from '../../stores/CashuStore';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

interface CashuSeedProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
}

interface CashuSeedState {
    understood: boolean;
    showModal: boolean;
    seedPhrase: string[];
}

@inject('CashuStore')
@observer
export default class CashuSeed extends React.PureComponent<
    CashuSeedProps,
    CashuSeedState
> {
    state = {
        understood: false,
        showModal: false,
        seedPhrase: []
    };

    componentDidMount() {
        const { seedPhrase } = this.props.CashuStore;
        if (seedPhrase) {
            this.setState({
                seedPhrase
            });
        }
    }

    render() {
        const { navigation } = this.props;
        const { understood, showModal, seedPhrase } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Cashu.CashuSeed.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        understood && seedPhrase.length > 0 ? (
                            <Row>
                                <DangerousCopySeedButton
                                    onPress={() =>
                                        this.setState({ showModal: true })
                                    }
                                />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <DangerousCopySeedModal
                    visible={showModal}
                    seedPhrase={seedPhrase}
                    onClose={() => this.setState({ showModal: false })}
                />
                {!understood && (
                    <SeedWarningDisclaimer
                        text1Key="views.Cashu.CashuSeed.text1"
                        text2Key="views.Settings.Seed.text2"
                        onUnderstood={() => this.setState({ understood: true })}
                    />
                )}
                {understood && seedPhrase.length > 0 && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <SeedWordGrid seedPhrase={seedPhrase} />
                        <View style={buttonContainerStyle()}>
                            <Button
                                onPress={async () => {
                                    navigation.popTo('Wallet');
                                }}
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}
