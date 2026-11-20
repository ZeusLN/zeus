import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

// mobx-react's main entry asks react-dom for this one function; the real
// observer is what hides a modal that is already open
jest.mock(
    'react-dom',
    () => ({ unstable_batchedUpdates: (update: () => void) => update() }),
    { virtual: true }
);
jest.mock('../stores/Stores', () => {
    const { observable } = require('mobx');
    const settingsStore = observable({
        loggedIn: true,
        posStatus: 'unselected',
        loginRequired: () => !settingsStore.loggedIn
    });
    return { settingsStore };
});

import Modal from './Modal';
import { settingsStore } from '../stores/Stores';

const setSession = (session: { loggedIn: boolean; posStatus?: string }) =>
    act(() => {
        Object.assign(settingsStore, { posStatus: 'unselected', ...session });
    });

const renderModal = (props: any) =>
    render(
        <Modal testID="modal" {...props}>
            <Text>secret</Text>
        </Modal>
    );
const modal = () => screen.queryByTestId('modal');
const contents = () => screen.queryAllByText('secret');

describe('Modal', () => {
    beforeEach(() => setSession({ loggedIn: true }));

    it('passes its props through while logged in', async () => {
        await renderModal({
            visible: true,
            transparent: true,
            animationType: 'slide'
        });

        expect(modal()?.props).toMatchObject({
            transparent: true,
            animationType: 'slide'
        });
        expect(contents()).toHaveLength(1);
    });

    it('stays closed when its screen closes it', async () => {
        await renderModal({ visible: false });

        expect(modal()).toBeNull();
    });

    it('hides an open modal when the session locks, until the login', async () => {
        await renderModal({ visible: true });

        await setSession({ loggedIn: false });
        expect(modal()).toBeNull();
        expect(contents()).toHaveLength(0);

        await setSession({ loggedIn: true });
        expect(modal()).not.toBeNull();
        expect(contents()).toHaveLength(1);
    });

    it('does not show a modal that is opened while login is required', async () => {
        await setSession({ loggedIn: false });
        await renderModal({ visible: false });

        await screen.rerender(
            <Modal testID="modal" visible={true}>
                <Text>secret</Text>
            </Modal>
        );

        expect(modal()).toBeNull();
        expect(contents()).toHaveLength(0);
    });

    it('stays usable in an active POS session, which the Lockscreen waives', async () => {
        await setSession({ loggedIn: false, posStatus: 'active' });
        await renderModal({ visible: true });

        expect(modal()).not.toBeNull();
        expect(contents()).toHaveLength(1);
    });
});
