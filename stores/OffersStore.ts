import { action, observable, runInAction } from 'mobx';

import BackendUtils from '../utils/BackendUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

export default class OffersStore {
    @observable public offers: Array<any> = [];
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string;

    @action
    public listOffers = async () => {
        this.loading = true;
        this.error = false;

        await BackendUtils.listOffers()
            .then((data: any) => {
                runInAction(() => {
                    this.offers = data.offers;
                    this.loading = false;
                });
            })
            .catch(() => {
                runInAction(() => {
                    this.offers = [];
                    this.error = true;
                    this.loading = false;
                });
            });
    };

    @action
    public disableOffer = async (offer_id: string) => {
        this.loading = true;
        this.error = false;
        this.error_msg = '';

        return await BackendUtils.disableOffer({ offer_id })
            .then((data: any) => {
                this.loading = false;
                return data;
            })
            .catch((e: any) => {
                runInAction(() => {
                    this.error = true;
                    this.error_msg = errorToUserFriendly(e);
                    this.loading = false;
                });
            });
    };

    @action
    public createOffer = async (data: any) => {
        this.loading = true;
        this.error = false;
        this.error_msg = '';

        return await BackendUtils.createOffer(data)
            .then((data: any) => {
                this.loading = false;
                return data;
            })
            .catch((e: any) => {
                runInAction(() => {
                    this.error = true;
                    this.error_msg = errorToUserFriendly(e);
                    this.loading = false;
                });
            });
    };
}
