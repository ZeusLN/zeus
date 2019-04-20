import { action, observable } from 'mobx';
import axios from 'axios';

export default class FeeStore {
    @observable public dataFrame: any = {};
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    getFeesToken: any;

    constructor() {
        this.getFeesToken = axios.CancelToken.source().token;
    }

    @action
    public getFees = () => {
        console.log('loiading');
        this.loading = true;
        axios.request({
            method: 'get',
            // url: `https://whatthefee.io/data.json`,
            url: `https://whatthefee.io/data.json?c=1555717500`,
            cancelToken: this.getFeesToken
        }).then((response: any) => {
            // handle success
            this.loading = false;
            const data = response.data;
            console.log('got data!');
            console.log(data);
            this.dataFrame = data;
        })
        .catch(() => {
            // handle error
            this.dataFrame = {};
            this.loading = false;
        });
    }
}