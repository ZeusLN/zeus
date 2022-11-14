import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Slider } from 'react-native-elements';
import { themeColor } from './../utils/ThemeUtils';

interface BalanceSliderProps {
    localBalance: string | number;
    remoteBalance: string | number;
    list?: boolean;
}

export default class BalanceSlider extends React.Component<
    BalanceSliderProps,
    Record<string, never>
> {
    render() {
        const { localBalance, remoteBalance, list } = this.props;

        const totalBalance =
            Number(localBalance || 0) + Number(remoteBalance || 0);

        const ratio = Number(localBalance) / Number(totalBalance) || 0;

        return (
            <View style={list ? styles.sliderList : styles.slider}>
                <Slider
                    value={ratio}
                    minimumTrackTintColor={themeColor('outbound')}
                    maximumTrackTintColor={themeColor('inbound')}
                    trackStyle={styles.trackStyle}
                    thumbStyle={styles.thumbStyle}
                    disabled
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    slider: {
        flex: 1,
        marginLeft: 20,
        marginRight: 20
    },
    sliderList: {
        marginTop: -15,
        marginLeft: 65,
        marginRight: 20,
        marginBottom: -5
    },
    trackStyle: {
        backgroundColor: 'orange'
    },
    thumbStyle: {
        width: 0,
        height: 0
    }
});
