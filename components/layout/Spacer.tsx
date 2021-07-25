import * as React from 'react';
import { View } from 'react-native';

export function Spacer({ width = 0, height = 0 }) {
    return <View style={{ height, width }} />;
}
