import * as React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import BigNumber from 'bignumber.js';

import CashuStore from '../../stores/CashuStore';

interface LockDurationSettingsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'LockDurationSettings', { mintUrl: string }>;
    CashuStore: CashuStore;
}

interface LockDurationSettingsState {
    duration: string;
    timePeriod: string;
}

@inject('CashuStore')
@observer
export default class LockDurationSettings extends React.Component<
    LockDurationSettingsProps,
    LockDurationSettingsState
> {
    constructor(props: LockDurationSettingsProps) {
        super(props);
        this.state = {
            duration: '1',
            timePeriod: 'Hours'
        };
    }

    componentDidMount() {
        this.loadDuration();
    }

    loadDuration = async () => {
        const { CashuStore, route } = this.props;
        const { mintUrl } = route.params;
        const duration = await CashuStore.getLockDuration(mintUrl);

        if (duration > 0) {
            let timePeriod = 'Hours';
            let displayDuration = duration / 3600;

            if (duration >= 86400) {
                timePeriod = 'Days';
                displayDuration = duration / 86400;
            } else if (duration >= 3600) {
                timePeriod = 'Hours';
                displayDuration = duration / 3600;
            } else if (duration >= 60) {
                timePeriod = 'Minutes';
                displayDuration = duration / 60;
            } else {
                timePeriod = 'Seconds';
                displayDuration = duration;
            }

            this.setState({
                duration: displayDuration.toString(),
                timePeriod
            });
        }
    };

    saveDuration = async () => {
        const { CashuStore, route, navigation } = this.props;
        const { mintUrl } = route.params;
        const { duration, timePeriod } = this.state;

        let seconds = new BigNumber(duration);

        if (timePeriod === 'Days') {
            seconds = seconds.multipliedBy(86400);
        } else if (timePeriod === 'Hours') {
            seconds = seconds.multipliedBy(3600);
        } else if (timePeriod === 'Minutes') {
            seconds = seconds.multipliedBy(60);
        }

        await CashuStore.setLockDuration(mintUrl, seconds.toNumber());
        navigation.goBack();
    };

    render() {
        const { navigation } = this.props;
        const { duration, timePeriod } = this.state;

        const styles = StyleSheet.create({
            content: {
                padding: 20
            },
            label: {
                color: themeColor('text'),
                fontSize: 16,
                marginBottom: 10
            },
            inputContainer: {
                marginBottom: 20
            },
            timePeriodContainer: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 20
            },
            timeButton: {
                flex: 1,
                marginHorizontal: 5
            },
            selectedButton: {
                backgroundColor: themeColor('highlight')
            },
            button: {
                marginTop: 20
            }
        });

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={
                        <Text style={{ color: themeColor('text') }}>
                            {localeString(
                                'views.Cashu.LockDurationSettings.title'
                            )}
                        </Text>
                    }
                    navigation={navigation}
                />
                <View style={styles.content}>
                    <Text style={styles.label}>
                        {localeString(
                            'views.Cashu.LockDurationSettings.duration'
                        )}
                    </Text>
                    <TextInput
                        placeholder={localeString(
                            'views.Cashu.LockDurationSettings.durationPlaceholder'
                        )}
                        value={duration}
                        onChangeText={(text: string) =>
                            this.setState({ duration: text })
                        }
                        keyboardType="numeric"
                        style={styles.inputContainer}
                    />

                    <View style={styles.timePeriodContainer}>
                        <Button
                            title={localeString('general.seconds')}
                            onPress={() =>
                                this.setState({ timePeriod: 'Seconds' })
                            }
                            containerStyle={[
                                styles.timeButton,
                                timePeriod === 'Seconds' &&
                                    styles.selectedButton
                            ]}
                        />
                        <Button
                            title={localeString('general.minutes')}
                            onPress={() =>
                                this.setState({ timePeriod: 'Minutes' })
                            }
                            containerStyle={[
                                styles.timeButton,
                                timePeriod === 'Minutes' &&
                                    styles.selectedButton
                            ]}
                        />
                        <Button
                            title={localeString('general.hours')}
                            onPress={() =>
                                this.setState({ timePeriod: 'Hours' })
                            }
                            containerStyle={[
                                styles.timeButton,
                                timePeriod === 'Hours' && styles.selectedButton
                            ]}
                        />
                        <Button
                            title={localeString('general.days')}
                            onPress={() =>
                                this.setState({ timePeriod: 'Days' })
                            }
                            containerStyle={[
                                styles.timeButton,
                                timePeriod === 'Days' && styles.selectedButton
                            ]}
                        />
                    </View>

                    <Button
                        title={localeString('general.save')}
                        onPress={() => this.saveDuration()}
                        containerStyle={styles.button}
                    />
                </View>
            </Screen>
        );
    }
}
