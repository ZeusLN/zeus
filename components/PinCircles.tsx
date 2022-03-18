import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Row } from './layout/Row';
import Filled from './../assets/images/SVG/PinFilled.svg';
import Hollow from './../assets/images/SVG/PinHollow.svg';

interface PinCirclesProps {
    pinLength: number;
    numFilled: number;
    hidePinLength: boolean;
}

export default function PinCircles({
    pinLength,
    numFilled,
    hidePinLength
}: PinCirclesProps) {
    const styles = StyleSheet.create({
        pinCirclesRow: {
            justifyContent: 'center'
        },
        circles: {
            margin: 10
        }
    });

    const filled = [];
    for (let i = 0; i < numFilled; i++) {
        filled.push(<Filled key={`filled-${i}`} style={styles.circles} />);
    }

    const hollow = [];
    if (!hidePinLength) {
        for (let i = 0; i < pinLength - numFilled; i++) {
            hollow.push(<Hollow key={`hollow-${i}`} style={styles.circles} />);
        }
    }

    return (
        <View>
            <Row style={styles.pinCirclesRow}>
                {filled}
                {hollow}
            </Row>
        </View>
    );
}
