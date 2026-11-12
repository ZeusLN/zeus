import { expect } from 'detox';

import { createSelfCustodialWallet } from '../../flows/wallet';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import AddContactScreen from '../../screens/AddContactScreen';
import ContactsScreen from '../../screens/ContactsScreen';
import Header from '../../screens/Header';
import MenuScreen from '../../screens/MenuScreen';
import WalletScreen from '../../screens/WalletScreen';

// The balances show once the node reports in after its first sync.
const BALANCES_TIMEOUT_MS = 180000;

const CONTACT_NAME = 'Satoshi';
const CONTACT_LIGHTNING_ADDRESS = 'satoshi@zeuspay.com';
// The empty state is a button, and buttons render their titles uppercase.
const NO_CONTACTS_LABEL = t('views.Settings.Contacts.noContacts').toUpperCase();

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Wallet', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
    });

    describe('balances', () => {
        it('opens a new wallet with its tabs', async () => {
            await expect(WalletScreen.tab('Balance')).toBeVisible();
            await expect(WalletScreen.tab('Camera')).toBeVisible();
        });

        it('shows the balance of each layer', async () => {
            await WalletScreen.openTab('Balance');

            await waitForVisible(
                WalletScreen.activityButton,
                BALANCES_TIMEOUT_MS
            );
            await expect(byText(t('general.lightning'))).toBeVisible();
            await expect(byText(t('general.onchain'))).toBeVisible();
        });
    });

    describe('activity', () => {
        it('opens the activity list from the balances', async () => {
            await WalletScreen.activityButton.tap();

            await waitForVisible(byText(t('general.activity')));
        });

        it('closes the activity list', async () => {
            await Header.close();

            await waitForVisible(WalletScreen.activityButton);
        });
    });

    describe('header', () => {
        it('opens the menu with the new wallet selected', async () => {
            await WalletScreen.menuButton.tap();

            await MenuScreen.waitUntilDisplayedWithWallet();
        });

        it('closes the menu', async () => {
            await Header.close();

            await WalletScreen.waitUntilDisplayed();
        });

        it('lists the wallets', async () => {
            await WalletScreen.walletsButton.tap();

            await waitForVisible(byText(t('views.Settings.Wallets.title')));
        });

        it('returns from the wallet list', async () => {
            await Header.goBack();

            await WalletScreen.waitUntilDisplayed();
        });
    });

    describe('contacts', () => {
        it('starts with no contacts', async () => {
            await WalletScreen.menuButton.tap();
            await MenuScreen.waitUntilDisplayedWithWallet();
            await MenuScreen.contactsButton.tap();

            await ContactsScreen.waitUntilDisplayed();
            await expect(byText(NO_CONTACTS_LABEL)).toBeVisible();
        });

        it('adds a contact with a lightning address', async () => {
            await ContactsScreen.addButton.tap();
            await AddContactScreen.waitUntilDisplayed();
            await AddContactScreen.fill(
                CONTACT_NAME,
                CONTACT_LIGHTNING_ADDRESS
            );
            await AddContactScreen.saveButton.tap();

            await ContactsScreen.waitUntilDisplayed();
            await waitForVisible(byText(CONTACT_NAME));
            await expect(byText(NO_CONTACTS_LABEL)).not.toBeVisible();
        });
    });
});
