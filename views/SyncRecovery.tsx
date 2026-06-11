import React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import Screen from '../components/Screen';
import Header from '../components/Header';
import SyncCircularProgress from '../components/SyncCircularProgress';

import SyncStore from '../stores/SyncStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SyncRecoveryProps {
    navigation: NativeStackNavigationProp<any, any>;
    SyncStore: SyncStore;
}

@inject('SyncStore')
@observer
export default class SyncRecovery extends React.PureComponent<
    SyncRecoveryProps,
    {}
> {
    render() {
        const { navigation, SyncStore } = this.props;
        const { recoveryProgress } = SyncStore;

        const progressValue = recoveryProgress
            ? (Math.floor(recoveryProgress * 1000) / 1000) * 100
            : 0;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.SyncRecovery.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <SyncCircularProgress value={progressValue} />
                    </View>
                </View>
                <View style={{ bottom: 15 }}>
                    <Button
                        title={localeString('general.goBack')}
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </Screen>
        );
    }
}
