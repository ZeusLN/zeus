import { action, observable } from 'mobx';
import BackendUtils from './../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import addressUtils from '../utils/AddressUtils';

interface VerificationRequest {
    msg: string;
    signature: string;
    addr?: string;
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

    private parseErrorMessage(error: any, fallbackMessage: string): string {
        if (error && typeof error === 'object') {
            if (error.message) {
                try {
                    const parsed = JSON.parse(error.message);
                    return parsed.message || error.message;
                } catch {
                    return error.message;
                }
            } else if (error.toString) {
                try {
                    const errorStr = error.toString();
                    const jsonMatch = errorStr.match(/\{.*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        return parsed.message || errorStr;
                    } else {
                        return errorStr;
                    }
                } catch {
                    return error.toString();
                }
            } else {
                return fallbackMessage;
            }
        } else {
            return error ? error.toString() : fallbackMessage;
        }
    }

    private handleError(
        error: any,
        fallbackMessage: string,
        resetState: boolean = false
    ): void {
        console.error('Error occurred:', error);
        this.error = true;
        this.errorMessage = this.parseErrorMessage(error, fallbackMessage);
        this.loading = false;

        if (resetState) {
            this.signature = null;
            this.pubkey = null;
            this.valid = null;
        }
    }

    @action
    public reset() {
        this.signature = null;
        this.pubkey = null;
        this.valid = null;
        this.error = false;
        this.errorMessage = '';
        this.selectedAddress = '';
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

        const previouslySelectedAddress = this.selectedAddress;

        BackendUtils.listAddresses()
            .then((data: any) => {
                // Handle response format from UTXOsStore
                if (data && data.account_with_addresses) {
                    // Flatten all addresses from all accounts
                    const allAddresses: any[] = [];
                    data.account_with_addresses.forEach((account: any) => {
                        if (account.addresses && account.addresses.length > 0) {
                            account.addresses.forEach((addr: any) => {
                                allAddresses.push({
                                    address: addr.address,
                                    type: addressUtils.getAddressType(
                                        addr.address
                                    ),
                                    accountName: account.name,
                                    addressType: account.address_type
                                });
                            });
                        }
                    });

                    this.addresses = allAddresses;
                } else if (data && data.addresses) {
                    // Format directly with addresses array (current format)
                    this.addresses = data.addresses.map((addr: any) => ({
                        address: addr.address,
                        type:
                            addr.type ||
                            addressUtils.getAddressType(addr.address)
                    }));
                } else {
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
                        this.handleError(error, 'Unknown signing error', true);
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
            this.handleError(error, 'Unknown signing error');
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

            // Check if verifyOperation is a valid Promise
            if (verifyOperation && typeof verifyOperation.then === 'function') {
                verifyOperation
                    .then((result: any) => {
                        this.valid = result.valid || result.verified || false;
                        const rawPubkey = result.pubkey || result.publicKey;
                        if (rawPubkey) {
                            if (rawPubkey instanceof Uint8Array) {
                                this.pubkey = Array.from(rawPubkey, (byte) =>
                                    byte.toString(16).padStart(2, '0')
                                ).join('');
                            } else {
                                this.pubkey = rawPubkey;
                            }
                        } else {
                            this.pubkey = null;
                        }
                        this.error = false;
                        this.errorMessage = '';
                    })
                    .catch((error: any) => {
                        this.valid = false;
                        this.handleError(error, 'Unknown verification error');
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
            this.valid = false;
            this.handleError(error, 'Unknown verification error');
        }
    };
}
