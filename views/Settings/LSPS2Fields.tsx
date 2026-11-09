import * as React from 'react';
import { Text, View } from 'react-native';

import Button from '../../components/Button';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

export type Lsps2Field = 'pubkey' | 'host' | 'token';

interface LSPS2FieldsProps {
    pubkey: string;
    host: string;
    token: string;
    locked?: boolean;
    onChange: (field: Lsps2Field, value: string) => void;
    onBlur: () => void;
    showReset: boolean;
    onReset: () => void;
}

const fieldStyle = {
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 15,
    paddingRight: 15
};

export default function LSPS2Fields({
    pubkey,
    host,
    token,
    locked,
    onChange,
    onBlur,
    showReset,
    onReset
}: LSPS2FieldsProps) {
    const labelStyle = {
        fontFamily: 'PPNeueMontreal-Book',
        color: themeColor('secondaryText')
    };

    return (
        <>
            <View style={fieldStyle}>
                <Text style={labelStyle}>
                    {localeString('views.OpenChannel.nodePubkey')}
                </Text>
                <TextInput
                    value={pubkey}
                    placeholder={'02...'}
                    onChangeText={(text: string) => onChange('pubkey', text)}
                    onBlur={onBlur}
                    locked={locked}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>
            <View style={fieldStyle}>
                <Text style={labelStyle}>
                    {localeString('views.OpenChannel.host')}
                </Text>
                <TextInput
                    value={host}
                    placeholder={localeString('views.OpenChannel.hostPort')}
                    onChangeText={(text: string) => onChange('host', text)}
                    onBlur={onBlur}
                    locked={locked}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                />
            </View>
            <View style={fieldStyle}>
                <Text style={labelStyle}>
                    {localeString('general.discountCode')}
                </Text>
                <TextInput
                    value={token}
                    onChangeText={(text: string) => onChange('token', text)}
                    onBlur={onBlur}
                    locked={locked}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {showReset && (
                <View style={{ marginTop: 20 }}>
                    <Button
                        title={localeString('general.reset')}
                        accessibilityLabel={localeString('general.reset')}
                        onPress={onReset}
                    />
                </View>
            )}
        </>
    );
}
