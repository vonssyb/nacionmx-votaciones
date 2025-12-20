/**
 * Type definitions for NacionMX Bot
 * Fase 5, Item #16: TypeScript Migration
 */

import { Client, Interaction, User, GuildMember } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

// ===================================================================
// Database Types
// ===================================================================

export interface DebitCard {
    id: string;
    discord_user_id: string;
    balance: number;
    status: 'active' | 'frozen' | 'cancelled';
    created_at: string;
    updated_at: string;
}

export interface CreditCard {
    id: string;
    discord_user_id: string;
    card_type: string;
    credit_limit: number;
    current_balance: number;
    interest_rate: number;
    status: 'active' | 'frozen' | 'cancelled';
    created_at: string;
}

export interface Transaction {
    id: string;
    discord_user_id: string;
    type: string;
    amount: number;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    description?: string;
    created_at: string;
}

export interface Company {
    id: string;
    name: string;
    owner_id: string;
    balance: number;
    active: boolean;
    created_at: string;
}

export interface UserPoints {
    user_id: string;
    points_balance: number;
    lifetime_earned: number;
    lifetime_redeemed: number;
}

export interface Loan {
    id: string;
    lender_id: string;
    borrower_id: string;
    principal_amount: number;
    interest_rate: number;
    collateral_amount: number;
    total_repayment: number;
    due_date: string;
    status: 'active' | 'repaid' | 'defaulted';
}

// ===================================================================
// Service Types
// ===================================================================

export interface ServiceContext {
    client: Client;
    supabase: SupabaseClient;
}

export interface CommandHandler {
    name: string;
    description: string;
    execute: (interaction: Interaction, context: ServiceContext) => Promise<void>;
}

export interface EventHandler {
    name: string;
    once?: boolean;
    execute: (...args: any[]) => Promise<void>;
}

// ===================================================================
// API Types
// ===================================================================

export interface APIKey {
    id: string;
    user_id: string;
    key_hash: string;
    name: string;
    permissions: Record<string, boolean>;
    active: boolean;
    expires_at?: string;
}

export interface JWTPayload {
    user_id: string;
    api_key_id: string;
    permissions: Record<string, boolean>;
}

// ===================================================================
// Notification Types
// ===================================================================

export interface NotificationPayload {
    type: string;
    data: Record<string, any>;
    timestamp: Date;
}

export interface WebhookPayload {
    event: string;
    timestamp: string;
    data: Record<string, any>;
}

// ===================================================================
// Utility Types
// ===================================================================

export type Awaitable<T> = T | Promise<T>;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// ===================================================================
// Export all
// ===================================================================

export default {
    DebitCard,
    CreditCard,
    Transaction,
    Company,
    UserPoints,
    Loan,
    ServiceContext,
    CommandHandler,
    EventHandler,
    APIKey,
    JWTPayload,
    NotificationPayload,
    WebhookPayload
};
