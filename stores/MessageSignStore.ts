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

    private processAddress = (addr: any, account?: any): any => {
        try {
            const addressValue = addressUtils.extractAddressValue(addr);

            if (!addressValue) {
                console.warn(
                    'Address missing required address/bech32/p2tr property:',
                    addr
                );
                return null;
            }

            return {
                address: addressValue,
                type: addr.type || addressUtils.getAddressType(addressValue),
                accountName: account?.name,
                addressType: account?.address_type
            };
        } catch (err) {
            console.warn('Error processing address:', err, addr);
            return null;
        }
    };

    private processAddresses = (addresses: any[], account?: any): any[] => {
        return addresses
            .filter((addr: any) => addr)
            .map((addr: any) => this.processAddress(addr, account))
            .filter((addr: any) => addr !== null);
    };

    private addressResponseHandlers = {
        // account_with_addresses format
        accountWithAddresses: (data: any): any[] => {
            const allAddresses: any[] = [];
            data.account_with_addresses.forEach((account: any) => {
                if (account.addresses && account.addresses.length > 0) {
                    const processedAddresses = this.processAddresses(
                        account.addresses,
                        account
                    );
                    allAddresses.push(...processedAddresses);
                }
            });
            return allAddresses;
        },

        // flat addresses array format
        flatAddresses: (data: any): any[] => {
            return this.processAddresses(data.addresses);
        },

        // Array of accounts format
        accountsArray: (data: any): any[] => {
            const allAddresses: any[] = [];
            data.forEach((account: any) => {
                if (account.addresses && account.addresses.length > 0) {
                    const processedAddresses = this.processAddresses(
                        account.addresses,
                        account
                    );
                    allAddresses.push(...processedAddresses);
                }
            });
            return allAddresses;
        }
    };

    private getAddressHandler = (data: any): ((data: any) => any[]) | null => {
        if (data && data.account_with_addresses) {
            return this.addressResponseHandlers.accountWithAddresses;
        }
        if (data && data.addresses) {
            return this.addressResponseHandlers.flatAddresses;
        }
        if (Array.isArray(data)) {
            return this.addressResponseHandlers.accountsArray;
        }
        return null;
    };

    private handleAddressSelection = (previouslySelectedAddress: string) => {
        const addressStillExists =
            previouslySelectedAddress &&
            this.addresses.some(
                (addr) =>
                    addressUtils.extractAddressValue(addr) ===
                    previouslySelectedAddress
            );

        if (addressStillExists) {
            this.selectedAddress = previouslySelectedAddress;
        } else if (this.addresses.length > 0) {
            this.selectedAddress =
                addressUtils.extractAddressValue(this.addresses[0]) || '';
            console.log(`Selected address: ${this.selectedAddress}`);
        } else {
            console.log('No addresses available');
        }
    };

    @action
    public loadAddresses = () => {
        this.loading = true;
        const previouslySelectedAddress = this.selectedAddress;

        BackendUtils.listAddresses()
            .then((data: any) => {
                try {
                    const handler = this.getAddressHandler(data);

                    if (handler) {
                        this.addresses = handler(data);
                    } else {
                        this.addresses = [];
                        this.error = true;
                        console.log(
                            'MessageSignStore: No valid address data found'
                        );
                    }

                    this.handleAddressSelection(previouslySelectedAddress);
                } catch (err: any) {
                    console.error('Error processing addresses:', err);
                    this.error = true;
                    this.errorMessage = `Error processing addresses: ${
                        err.message || err
                    }`;
                    this.addresses = [];
                }
            })
            .catch((error: any) => {
                console.log('Error loading addresses:', error);
                this.error = true;
                this.errorMessage = error.toString();
                this.addresses = [];
            })
            .finally(() => {
                this.loading = false;
            });
    };

    private executeAsyncOperation = async (
        operation: Promise<any>,
        successCallback: (data: any) => void,
        errorMessage: string,
        resetState: boolean = false
    ): Promise<void> => {
        try {
            if (!operation || typeof operation.then !== 'function') {
                throw new Error('Operation did not return a valid Promise');
            }

            const result = await operation;
            successCallback(result);
            this.error = false;
            this.errorMessage = '';
        } catch (error: any) {
            this.handleError(error, errorMessage, resetState);
        } finally {
            this.loading = false;
        }
    };

    @action
    public signMessage = (text: string) => {
        this.loading = true;

        // Validation
        if (this.signingMode === 'onchain' && !this.selectedAddress) {
            this.error = true;
            this.errorMessage = localeString(
                'views.Settings.SignMessage.noAddressForSigning'
            );
            this.loading = false;
            return;
        }

        const signOperation =
            this.signingMode === 'lightning'
                ? BackendUtils.signMessage(text)
                : BackendUtils.signMessageWithAddr(text, this.selectedAddress);

        this.executeAsyncOperation(
            signOperation,
            (data: any) => {
                if (data) {
                    this.signature =
                        data.base64 || data.zbase || data.signature;
                } else {
                    throw new Error(
                        localeString(
                            'views.Settings.SignMessage.noDataReceived'
                        )
                    );
                }
            },
            'Unknown signing error',
            true
        );
    };

    @action
    public verifyMessage = (data: VerificationRequest) => {
        this.loading = true;

        // Validation for onchain verification
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

        this.executeAsyncOperation(
            verifyOperation,
            (result: any) => {
                this.valid = result.valid || result.verified || false;
                const rawPubkey = result.pubkey || result.publicKey;

                if (rawPubkey) {
                    this.pubkey =
                        rawPubkey instanceof Uint8Array
                            ? Array.from(rawPubkey, (byte) =>
                                  byte.toString(16).padStart(2, '0')
                              ).join('')
                            : rawPubkey;
                } else {
                    this.pubkey = null;
                }
            },
            'Unknown verification error'
        );
    };
}
