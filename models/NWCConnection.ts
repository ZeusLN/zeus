import { computed } from 'mobx';
import BaseModel from './BaseModel';

export interface NWCConnectionData {
    id: string;
    name: string;
    description?: string;
    pubkey: string;
    permissions: string[];
    createdAt: Date;
    lastUsed?: Date;
    isolated?: boolean;
    maxAmountSats?: number;
    budgetRenewal?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    expiresAt?: Date;
}

export default class NWCConnection extends BaseModel {
    id: string;
    name: string;
    description?: string;
    pubkey: string;
    permissions: string[];
    createdAt: Date;
    lastUsed?: Date;
    isolated?: boolean;
    maxAmountSats?: number;
    budgetRenewal?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    expiresAt?: Date;

    constructor(data?: NWCConnectionData) {
        super(data);

        if (this.createdAt && typeof this.createdAt === 'string') {
            this.createdAt = new Date(this.createdAt);
        }
        if (this.lastUsed && typeof this.lastUsed === 'string') {
            this.lastUsed = new Date(this.lastUsed);
        }
        if (this.expiresAt && typeof this.expiresAt === 'string') {
            this.expiresAt = new Date(this.expiresAt);
        }
    }

    @computed public get isExpired(): boolean {
        if (!this.expiresAt) return false;
        return new Date() > this.expiresAt;
    }

    @computed public get statusText(): string {
        if (!this.isolated) return 'Disabled';
        if (this.isExpired) return 'Expired';
        return 'Active';
    }

    @computed public get hasRecentActivity(): boolean {
        if (!this.lastUsed) return false;
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return this.lastUsed > dayAgo;
    }
}
