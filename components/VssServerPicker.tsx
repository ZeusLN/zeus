import * as React from 'react';
import { Text, View } from 'react-native';

import DropdownSetting from './DropdownSetting';
import TextInput from './TextInput';

import { LDK_VSS_SERVER_KEYS } from '../stores/SettingsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';
import { DEFAULT_VSS_SERVER } from '../utils/LdkNodeUtils';

export const VSS_CUSTOM_VALUE = 'custom';

interface VssServerPickerProps {
    selectedValue: string;
    customServer: string;
    onChange: (selectedValue: string, customServer: string) => void;
    locked?: boolean;
}

export const resolveVssServer = (
    selectedValue: string,
    customServer: string
): string =>
    selectedValue === VSS_CUSTOM_VALUE ? customServer.trim() : selectedValue;

export const isVssServerValid = (
    selectedValue: string,
    customServer: string
): boolean => {
    if (selectedValue !== VSS_CUSTOM_VALUE) return true;
    const trimmed = customServer.trim();
    return trimmed !== '' && UrlUtils.isValidUrl(trimmed);
};

export default function VssServerPicker({
    selectedValue,
    customServer,
    onChange,
    locked
}: VssServerPickerProps) {
    const isCustom = selectedValue === VSS_CUSTOM_VALUE;
    const showInvalidUrlError =
        isCustom &&
        customServer.trim() !== '' &&
        !UrlUtils.isValidUrl(customServer);

    return (
        <View>
            <DropdownSetting
                title={localeString(
                    'views.Settings.EmbeddedNode.VssServer.serverUrl'
                )}
                selectedValue={selectedValue}
                onValueChange={(value: string) =>
                    onChange(
                        value,
                        value === VSS_CUSTOM_VALUE ? customServer : ''
                    )
                }
                values={LDK_VSS_SERVER_KEYS}
                disabled={locked}
            />

            {isCustom && (
                <>
                    <TextInput
                        value={customServer}
                        placeholder={DEFAULT_VSS_SERVER}
                        onChangeText={(text: string) =>
                            onChange(selectedValue, text)
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        locked={locked}
                    />
                    {showInvalidUrlError && (
                        <Text
                            style={{
                                color: themeColor('error'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 12,
                                marginTop: 4
                            }}
                        >
                            {localeString(
                                'views.Settings.EmbeddedNode.invalidServerUrl'
                            )}
                        </Text>
                    )}
                </>
            )}
        </View>
    );
}
