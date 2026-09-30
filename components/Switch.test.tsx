import React from 'react';
import { Switch as RNSwitch } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import Switch from './Switch';

const renderSwitch = (props: any) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(<Switch {...props} />);
    });
    return tree!.root.findByType(RNSwitch).props;
};

describe('Switch', () => {
    it('uses the highlight color for the thumb and track when on', () => {
        const props = renderSwitch({ value: true });
        expect(props.thumbColor).toBe('theme:highlight');
        expect(props.trackColor).toEqual({
            false: 'theme:disabled',
            true: 'theme:highlight'
        });
    });

    it('uses the disabled color for the thumb when off', () => {
        const props = renderSwitch({ value: false });
        expect(props.thumbColor).toBe('theme:disabled');
        expect(props.trackColor.false).toBe('theme:disabled');
    });

    it('uses trackEnabledColor for the on track when given', () => {
        const props = renderSwitch({
            value: true,
            trackEnabledColor: '#123456'
        });
        expect(props.trackColor.true).toBe('#123456');
        expect(props.thumbColor).toBe('theme:highlight');
    });

    it('aligns itself to the end of its row', () => {
        const props = renderSwitch({ value: false });
        expect(props.style).toEqual({ alignSelf: 'flex-end' });
    });

    it('passes value, onValueChange and disabled through', () => {
        const onValueChange = jest.fn();
        const props = renderSwitch({
            value: true,
            onValueChange,
            disabled: true
        });
        expect(props.value).toBe(true);
        expect(props.disabled).toBe(true);
        props.onValueChange(false);
        expect(onValueChange).toHaveBeenCalledWith(false);
    });
});
