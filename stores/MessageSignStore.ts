import { action, observable } from 'mobx';
import BackendUtils from './../utils/BackendUtils';

interface VerificationRequest {
    msg: string;
    signature: string;
    addr?: string; // Optional address for on-chain verification
}

export enum SortBy {
    creationTimeAscending = 'creationTimeAscending',
    creationTimeDescending = 'creationTimeDescending',
    balanceAscending = 'balanceAscending',
    balanceDescending = 'balanceDescending'
}

export default class MessageSignStore {
    @observable public loading = false;
    @observable public error: boolean | string = false;
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
        createdAt?: string;
        balance?: number;
        derivation_path?: string;
    }[] = [];
    @observable public sortBy: SortBy = SortBy.balanceDescending;

    @action
    public setSortBy(sortBy: SortBy) {
        this.sortBy = sortBy;
    }

    @action
    public reset() {
        this.signature = null;
        this.pubkey = null;
        this.valid = null;
        this.error = false;
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
                // Log the structure of the first address or first account's first address if available
                if (
                    data &&
                    data.account_with_addresses &&
                    data.account_with_addresses.length > 0
                ) {
                    if (
                        data.account_with_addresses[0].addresses &&
                        data.account_with_addresses[0].addresses.length > 0
                    ) {
                        console.log(
                            'First address structure:',
                            JSON.stringify(
                                data.account_with_addresses[0].addresses[0]
                            )
                        );
                    }
                } else if (
                    data &&
                    data.addresses &&
                    data.addresses.length > 0
                ) {
                    console.log(
                        'First address structure:',
                        JSON.stringify(data.addresses[0])
                    );
                }

                let allAddresses: any[] = [];

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
                                    addressType: account.address_type,
                                    createdAt: addr.created_at,
                                    balance: addr.balance,
                                    derivation_path: addr.derivation_path // Make sure to include this field
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
                        type: addr.type || this.getAddressType(addr.address),
                        derivation_path: addr.derivation_path // Make sure to include this field
                    }));
                } else {
                    console.log('No address data found in expected format');
                    this.addresses = [];
                    this.error = true;
                }

                // Log a sample address after mapping to debug
                if (this.addresses.length > 0) {
                    console.log(
                        'Sample mapped address:',
                        JSON.stringify(this.addresses[0])
                    );
                }

                // Sort addresses based on current sortBy value
                console.log('this.addresses before sorting:', this.addresses);
                // sort addresses based on the selected sortBy value
                allAddresses = this.sortAddresses(this.addresses);
                console.log('Sorted addresses:', allAddresses);

                this.addresses = allAddresses;
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
            })
            .finally(() => {
                this.loading = false;
            });
    };

    private sortAddresses = (addresses: any[]): any[] => {
        const sortedAddresses = [...addresses];
        console.log('Sorting addresses:', sortedAddresses);

        switch (this.sortBy) {
            case SortBy.creationTimeAscending:
                return sortedAddresses.sort((a, b) => {
                    // Using explicit null/undefined checks to avoid errors
                    if (!a || !b) return 0;

                    // First check if derivation_path exists and use it for sorting
                    if (a.derivation_path && b.derivation_path) {
                        console.log('a.derivation_path', a.derivation_path);
                        console.log('b.derivation_path', b.derivation_path);
                        try {
                            const pathA = a.derivation_path.split('/');
                            const pathB = b.derivation_path.split('/');
                            const indexA =
                                parseInt(
                                    pathA[pathA.length - 1].replace("'", ''),
                                    10
                                ) || 0;
                            const indexB =
                                parseInt(
                                    pathB[pathB.length - 1].replace("'", ''),
                                    10
                                ) || 0;
                            return indexA - indexB;
                        } catch (err) {
                            console.log('Error parsing derivation path:', err);
                            return 0;
                        }
                    }

                    // Fallback to createdAt if available
                    if (a.createdAt && b.createdAt) {
                        const timeA = new Date(a.createdAt).getTime();
                        const timeB = new Date(b.createdAt).getTime();
                        return timeA - timeB;
                    }

                    return 0;
                });

            case SortBy.creationTimeDescending:
                return sortedAddresses.sort((a, b) => {
                    // Using explicit null/undefined checks to avoid errors
                    if (!a || !b) return 0;

                    // First check if derivation_path exists and use it for sorting
                    if (a.derivation_path && b.derivation_path) {
                        try {
                            const pathA = a.derivation_path.split('/');
                            const pathB = b.derivation_path.split('/');
                            const indexA =
                                parseInt(
                                    pathA[pathA.length - 1].replace("'", ''),
                                    10
                                ) || 0;
                            const indexB =
                                parseInt(
                                    pathB[pathB.length - 1].replace("'", ''),
                                    10
                                ) || 0;
                            return indexB - indexA;
                        } catch (err) {
                            console.log('Error parsing derivation path:', err);
                            return 0;
                        }
                    }

                    // Fallback to createdAt if available
                    if (a.createdAt && b.createdAt) {
                        const timeA = new Date(a.createdAt).getTime();
                        const timeB = new Date(b.createdAt).getTime();
                        return timeB - timeA;
                    }

                    return 0;
                });

            case SortBy.balanceAscending:
                return sortedAddresses.sort((a, b) => {
                    // Using explicit null/undefined checks to avoid errors
                    if (!a || !b) return 0;

                    // Handle balance objects or direct numbers
                    const balA = a.balance
                        ? typeof a.balance === 'object'
                            ? a.balance.low || 0
                            : Number(a.balance) || 0
                        : 0;
                    const balB = b.balance
                        ? typeof b.balance === 'object'
                            ? b.balance.low || 0
                            : Number(b.balance) || 0
                        : 0;
                    return balA - balB;
                });

            case SortBy.balanceDescending:
            default:
                return sortedAddresses.sort((a, b) => {
                    // Using explicit null/undefined checks to avoid errors
                    if (!a || !b) return 0;

                    // Handle balance objects or direct numbers
                    const balA = a.balance
                        ? typeof a.balance === 'object'
                            ? a.balance.low || 0
                            : Number(a.balance) || 0
                        : 0;
                    const balB = b.balance
                        ? typeof b.balance === 'object'
                            ? b.balance.low || 0
                            : Number(b.balance) || 0
                        : 0;
                    return balB - balA;
                });
        }
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

        if (text === undefined || text === null) {
            text = '';
        }

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
                        } else {
                            throw new Error(
                                'No data received from sign operation'
                            );
                        }
                    })
                    .catch((error: any) => {
                        console.error('Error in sign operation:', error);
                        this.error = error.toString();
                        this.reset();
                    })
                    .finally(() => {
                        this.loading = false;
                    });
            } else {
                console.error('Sign operation did not return a valid Promise');
                this.error = 'Sign operation not supported by this backend';
                this.loading = false;
            }
        } catch (error: any) {
            console.error('Exception in signMessage:', error);
            this.error = error.toString();
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
            this.error = 'No address provided for on-chain verification';
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
                    })
                    .catch((error: any) => {
                        console.error('Error in verify operation:', error);
                        this.error = error.toString();
                    })
                    .finally(() => {
                        this.loading = false;
                    });
            } else {
                console.error(
                    'Verify operation did not return a valid Promise'
                );
                this.error =
                    'Verification operation not supported by this backend';
                this.loading = false;
            }
        } catch (error: any) {
            console.error('Exception in verifyMessage:', error);
            this.error = error.toString();
            this.loading = false;
        }
    };
}
