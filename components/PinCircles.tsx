import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Row } from './layout/Row';
import Filled from './../assets/images/SVG/PinFilled.svg';
import Hollow from './../assets/images/SVG/PinHollow.svg';

interface PinCirclesProps {
    pinLength: number;
    numFilled: number;
    pinCreate: boolean;
}

export default function PinCircles({
    pinLength,
    numFilled,
    pinCreate
}: PinCirclesProps) {
    const styles = StyleSheet.create({
        pinCirclesRow: {
            justifyContent: 'center'
        },
        circles: {
            margin: 10
        }
    });

    let filled = [];
    for (let i = 0; i < numFilled; i++) {
        filled.push(<Filled style={styles.circles} />);
    }

    let hollow = [];
    if (!pinCreate) {
        for (let i = 0; i < pinLength - numFilled; i++) {
            hollow.push(<Hollow style={styles.circles} />);
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
