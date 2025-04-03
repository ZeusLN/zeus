import { action, observable } from 'mobx';
import BackendUtils from './../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';

interface VerificationRequest {
    msg: string;
    signature: string;
    addr?: string; // Optional address for on-chain verification
}

export default class MessageSignStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMessage = '';
    @observable public signature: string | null;
    @observable public verification: string | null;
    @observable public pubkey: string | null;
    @observable public valid: boolean | null;
    @observable public signingMode: 'lightning' | 'onchain' = 'lightning';
    @observable public selectedAddress: string = '';
    @observable public addresses: {
        address: string;
        type: string;
        accountName?: string;
        addressType?: string;
    }[] = [];

    @action
    public reset() {
        this.signature = null;
        this.pubkey = null;
        this.valid = null;
        this.error = false;
        this.errorMessage = '';
    }

    @action
    public setSigningMode(mode: 'lightning' | 'onchain') {
        this.signingMode = mode;
        this.reset();
    }

    @action
    public setSelectedAddress(address: string) {
        this.selectedAddress = address;
    }

    @action
    public loadAddresses = () => {
        this.loading = true;
        console.log('Loading on-chain addresses...');

        const previouslySelectedAddress = this.selectedAddress;

        BackendUtils.listAddresses()
            .then((data: any) => {
                console.log('Address data received:', data);

                // Handle response format from UTXOsStore
                if (data && data.account_with_addresses) {
                    // Format from UTXOsStore - has account_with_addresses array
                    console.log(
                        `Found ${data.account_with_addresses.length} accounts with addresses`
                    );

                    // Flatten all addresses from all accounts
                    const allAddresses: any[] = [];
                    data.account_with_addresses.forEach((account: any) => {
                        if (account.addresses && account.addresses.length > 0) {
                            account.addresses.forEach((addr: any) => {
                                allAddresses.push({
                                    address: addr.address,
                                    type: this.getAddressType(addr.address),
                                    accountName: account.name,
                                    addressType: account.address_type
                                });
                            });
                        }
                    });

                    console.log(
                        `Extracted ${allAddresses.length} total addresses`
                    );
                    this.addresses = allAddresses;
                } else if (data && data.addresses) {
                    // Format directly with addresses array (current format)
                    console.log(
                        `Found ${data.addresses.length} on-chain addresses`
                    );
                    this.addresses = data.addresses.map((addr: any) => ({
                        address: addr.address,
                        type: addr.type || this.getAddressType(addr.address)
                    }));
                } else {
                    console.log('No address data found in expected format');
                    this.addresses = [];
                    this.error = true;
                }

                // Check if the previously selected address is still in the list
                const addressStillExists =
                    previouslySelectedAddress &&
                    this.addresses.some(
                        (addr) => addr.address === previouslySelectedAddress
                    );

                if (addressStillExists) {
                    // Keep the previously selected address
                    console.log(
                        `Keeping previously selected address: ${previouslySelectedAddress}`
                    );
                    this.selectedAddress = previouslySelectedAddress;
                } else if (this.addresses.length > 0) {
                    // Only set to first address if there was no previous selection or it no longer exists
                    this.selectedAddress = this.addresses[0].address;
                    console.log(`Selected address: ${this.selectedAddress}`);
                } else {
                    console.log('No addresses available');
                }
            })
            .catch((error: any) => {
                console.log('Error loading addresses:', error);
                this.error = true;
                this.errorMessage = error.toString();
            })
            .finally(() => {
                this.loading = false;
            });
    };

    private getAddressType = (address: string): string => {
        // Proper address type detection based on LND's supported types
        if (address.startsWith('bc1q')) return 'P2WPKH (Segwit)';
        if (address.startsWith('bc1p')) return 'P2TR (Taproot)';
        if (address.startsWith('3')) return 'NP2WKH (Nested Segwit)';
        if (address.startsWith('1')) return 'P2PKH (Legacy)';
        if (address.startsWith('tb1q')) return 'P2WPKH (Testnet Segwit)';
        if (address.startsWith('tb1p')) return 'P2TR (Testnet Taproot)';
        if (address.startsWith('2')) return 'NP2WKH (Testnet Nested Segwit)';
        if (address.startsWith('m') || address.startsWith('n'))
            return 'P2PKH (Testnet Legacy)';
        // Add regtest address patterns
        if (address.startsWith('bcrt1q')) return 'P2WPKH (Regtest Segwit)';
        if (address.startsWith('bcrt1p')) return 'P2TR (Regtest Taproot)';
        return 'Unknown';
    };

    @action
    public signMessage = (text: string) => {
        this.loading = true;

        try {
            const signOperation =
                this.signingMode === 'lightning'
                    ? BackendUtils.signMessage(text)
                    : BackendUtils.signMessageWithAddr(
                          text,
                          this.selectedAddress
                      );

            // Check if signOperation is a valid Promise
            if (signOperation && typeof signOperation.then === 'function') {
                signOperation
                    .then((data: any) => {
                        if (data) {
                            this.signature = data.zbase || data.signature;
                            this.error = false;
                            this.errorMessage = '';
                        } else {
                            throw new Error(
                                localeString(
                                    'views.Settings.SignMessage.noDataReceived'
                                )
                            );
                        }
                    })
                    .catch((error: any) => {
                        console.error('Error in sign operation:', error);
                        this.error = true;
                        this.errorMessage = error.toString();
                        this.reset();
                    })
                    .finally(() => {
                        this.loading = false;
                    });
            } else {
                console.error('Sign operation did not return a valid Promise');
                this.error = true;
                this.errorMessage = localeString(
                    'views.Settings.SignMessage.signOperationFailed'
                );
                this.loading = false;
            }
        } catch (error: any) {
            console.error('Exception in signMessage:', error);
            this.error = true;
            this.errorMessage = error.toString();
            this.loading = false;
        }
    };

    @action
    public verifyMessage = (data: VerificationRequest) => {
        this.loading = true;

        // Extra validation for onchain verification
        if (
            this.signingMode === 'onchain' &&
            (!data.addr || data.addr.trim() === '')
        ) {
            this.error = true;
            this.errorMessage = localeString(
                'views.Settings.SignMessage.noAddressForVerification'
            );
            this.loading = false;
            return;
        }

        try {
            const verifyOperation =
                this.signingMode === 'lightning'
                    ? BackendUtils.verifyMessage({
                          msg: data.msg,
                          signature: data.signature
                      })
                    : BackendUtils.verifyMessageWithAddr(
                          data.msg,
                          data.signature,
                          data.addr || ''
                      );

            console.log(
                '[MessageSignStore] Calling backend with signingMode:',
                this.signingMode
            );

            // Check if verifyOperation is a valid Promise
            if (verifyOperation && typeof verifyOperation.then === 'function') {
                verifyOperation
                    .then((result: any) => {
                        this.valid = result.valid || result.verified || false;
                        this.pubkey = result.pubkey || result.publicKey;
                        this.error = false;
                        this.errorMessage = '';
                    })
                    .catch((error: any) => {
                        console.error('Error in verify operation:', error);
                        this.error = true;
                        this.errorMessage = error.toString();
                    })
                    .finally(() => {
                        this.loading = false;
                    });
            } else {
                console.error(
                    'Verify operation did not return a valid Promise'
                );
                this.error = true;
                this.errorMessage = localeString(
                    'views.Settings.SignMessage.verificationOperationFailed'
                );
                this.loading = false;
            }
        } catch (error: any) {
            console.error('Exception in verifyMessage:', error);
            this.error = true;
            this.errorMessage = error.toString();
            this.loading = false;
        }
    };
}
