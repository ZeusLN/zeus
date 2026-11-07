// Stable element identifiers shared by the views and the Detox E2E suite in
// e2e/. Tests select elements through these rather than visible text, so a
// copy change or a translation cannot break them.
export const TEST_IDS = {
    header: {
        backButton: 'header.backButton',
        closeButton: 'header.closeButton'
    },
    infoModal: {
        content: 'infoModal.content'
    },
    introSplash: {
        languageButton: 'introSplash.languageButton',
        advancedSetupButton: 'introSplash.advancedSetupButton',
        getStartedButton: 'introSplash.getStartedButton'
    },
    language: {
        searchInput: 'language.searchInput',
        option: (locale: string) => `language.option.${locale}`
    },
    menu: {
        addWalletButton: 'menu.addWalletButton',
        selectedWalletButton: 'menu.selectedWalletButton'
    },
    onboarding: {
        recommendedButton: 'onboarding.recommendedButton',
        questionnaireButton: 'onboarding.questionnaireButton'
    },
    walletSetup: {
        createWalletButton: 'walletSetup.createWalletButton',
        connectRemoteNodeButton: 'walletSetup.connectRemoteNodeButton'
    },
    walletType: {
        selfCustodyButton: 'walletType.selfCustodyButton',
        selfCustodyInfoButton: 'walletType.selfCustodyInfoButton',
        ecashButton: 'walletType.ecashButton',
        ecashInfoButton: 'walletType.ecashInfoButton'
    },
    nodeChoice: {
        ldkNodeButton: 'nodeChoice.ldkNodeButton',
        ldkNodeInfoButton: 'nodeChoice.ldkNodeInfoButton',
        embeddedLndButton: 'nodeChoice.embeddedLndButton',
        embeddedLndInfoButton: 'nodeChoice.embeddedLndInfoButton',
        deviceCheck: 'nodeChoice.deviceCheck'
    },
    recommendedSettings: {
        walletTypeRow: 'recommendedSettings.walletTypeRow',
        walletTypeValue: 'recommendedSettings.walletTypeValue',
        nodeImplementationRow: 'recommendedSettings.nodeImplementationRow',
        nodeImplementationValue: 'recommendedSettings.nodeImplementationValue',
        mintSourceRow: 'recommendedSettings.mintSourceRow',
        mintSourceValue: 'recommendedSettings.mintSourceValue',
        recommendedMints: 'recommendedSettings.recommendedMints',
        clipboardRow: 'recommendedSettings.clipboardRow',
        clipboardValue: 'recommendedSettings.clipboardValue',
        fiatRow: 'recommendedSettings.fiatRow',
        fiatValue: 'recommendedSettings.fiatValue',
        createWalletButton: 'recommendedSettings.createWalletButton'
    },
    mintDiscovery: {
        option: (mode: string) => `mintDiscovery.option.${mode}`,
        npubInput: 'mintDiscovery.npubInput',
        npubError: 'mintDiscovery.npubError',
        fetchMintsButton: 'mintDiscovery.fetchMintsButton',
        selectButton: 'mintDiscovery.selectButton'
    },
    walletSettings: {
        clipboardLabel: 'walletSettings.clipboardLabel',
        clipboardSwitch: 'walletSettings.clipboardSwitch',
        fiatSwitch: 'walletSettings.fiatSwitch',
        fiatRatesSourceDropdown: 'walletSettings.fiatRatesSourceDropdown',
        selectCurrencyRow: 'walletSettings.selectCurrencyRow',
        selectCurrencyValue: 'walletSettings.selectCurrencyValue',
        securityRow: 'walletSettings.securityRow',
        createWalletButton: 'walletSettings.createWalletButton'
    },
    selectCurrency: {
        searchInput: 'selectCurrency.searchInput',
        option: (currency: string) => `selectCurrency.option.${currency}`
    },
    pinPad: {
        key: (digit: string) => `pinPad.key.${digit}`,
        decimal: 'pinPad.decimal',
        delete: 'pinPad.delete',
        clear: 'pinPad.clear'
    },
    keypad: {
        amount: 'keypad.amount',
        ecashToggle: 'keypad.ecashToggle',
        unitToggle: 'keypad.unitToggle',
        requestButton: 'keypad.requestButton',
        editButton: 'keypad.editButton',
        sendButton: 'keypad.sendButton',
        amountShortcut: (amount: string) => `keypad.amountShortcut.${amount}`,
        sendBitcoinOption: 'keypad.sendBitcoinOption',
        sendEcashOption: 'keypad.sendEcashOption'
    },
    currencySelectorModal: {
        content: 'currencySelectorModal.content'
    },
    currencyList: {
        option: (currency: string) => `currencyList.option.${currency}`
    },
    wallet: {
        tab: (name: string) => `wallet.tab.${name}`,
        activityButton: 'wallet.activityButton'
    },
    walletHeader: {
        menuButton: 'walletHeader.menuButton',
        walletsButton: 'walletHeader.walletsButton'
    },
    walletConfiguration: {
        interfaceDropdown: 'walletConfiguration.interfaceDropdown',
        hostInput: 'walletConfiguration.hostInput',
        lndhubUrlInput: 'walletConfiguration.lndhubUrlInput'
    }
};
