/**
 * WebhookService - Event-driven webhooks with retry logic
 * Fase 3, Item #10: Webhooks para Eventos
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('./Logger');

class WebhookService {
    constructor(supabase) {
        this.supabase = supabase;
        this.retryInterval = 60 * 1000; // Check for retries every minute

        // Start retry processor
        this.startRetryProcessor();
    }

    /**
     * Emit event to all registered webhooks
     */
    async emitEvent(eventType, payload) {
        try {
            // Get webhooks for this event type
            const { data: webhooks, error } = await this.supabase
                .rpc('get_active_webhooks_for_event', {
                    p_event_type: eventType
                });

            if (error) throw error;

            if (!webhooks || webhooks.length === 0) {
                logger.debug(`No webhooks registered for event: ${eventType}`);
                return;
            }

            logger.info(`Emitting ${eventType} to ${webhooks.length} webhooks`);

            // Send to each webhook
            for (const webhook of webhooks) {
                await this.sendWebhook(webhook, eventType, payload);
            }

        } catch (error) {
            logger.errorWithContext('Error emitting event', error, { eventType });
        }
    }

    /**
     * Send webhook HTTP request
     */
    async sendWebhook(webhook, eventType, payload) {
        try {
            const webhookPayload = {
                event: eventType,
                timestamp: new Date().toISOString(),
                data: payload
            };

            // Generate signature if secret is configured
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'NacionMX-Webhook/1.0'
            };

            if (webhook.secret) {
                const signature = this.generateSignature(webhookPayload, webhook.secret);
                headers['X-Webhook-Signature'] = signature;
            }

            // Send request
            const response = await axios.post(webhook.url, webhookPayload, {
                headers,
                timeout: 10000 // 10 seconds
            });

            // Record success
            await this.recordDelivery(
                webhook.id,
                eventType,
                webhookPayload,
                'success',
                response.status,
                JSON.stringify(response.data).substring(0, 1000)
            );

            logger.info(`Webhook delivered: ${webhook.name}`, {
                eventType,
                status: response.status
            });

        } catch (error) {
            // Record failure
            const httpStatus = error.response?.status || 0;
            const responseBody = error.response?.data
                ? JSON.stringify(error.response.data).substring(0, 1000)
                : error.message;

            await this.recordDelivery(
                webhook.id,
                eventType,
                { event: eventType, data: payload },
                'failed',
                httpStatus,
                responseBody
            );

            logger.errorWithContext('Webhook delivery failed', error, {
                webhook: webhook.name,
                eventType,
                httpStatus
            });
        }
    }

    /**
     * Record webhook delivery
     */
    async recordDelivery(webhookId, eventType, payload, status, httpStatus = null, responseBody = null) {
        try {
            const { error } = await this.supabase
                .rpc('record_webhook_delivery', {
                    p_webhook_id: webhookId,
                    p_event_type: eventType,
                    p_payload: payload,
                    p_status: status,
                    p_http_status: httpStatus,
                    p_response_body: responseBody
                });

            if (error) throw error;

        } catch (error) {
            logger.errorWithContext('Error recording webhook delivery', error, {
                webhookId,
                eventType
            });
        }
    }

    /**
     * Generate HMAC signature for webhook payload
     */
    generateSignature(payload, secret) {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return `sha256=${hmac.digest('hex')}`;
    }

    /**
     * Start retry processor for failed deliveries
     */
    startRetryProcessor() {
        setInterval(async () => {
            await this.processRetries();
        }, this.retryInterval);

        logger.info('Webhook retry processor started');
    }

    /**
     * Process pending retries
     */
    async processRetries() {
        try {
            const { data: deliveries, error } = await this.supabase
                .rpc('get_pending_retries');

            if (error) throw error;

            if (!deliveries || deliveries.length === 0) {
                return;
            }

            logger.info(`Processing ${deliveries.length} webhook retries`);

            for (const delivery of deliveries) {
                // Get webhook config
                const { data: webhook } = await this.supabase
                    .from('webhooks')
                    .select('*')
                    .eq('id', delivery.webhook_id)
                    .single();

                if (webhook && webhook.active) {
                    await this.sendWebhook(
                        webhook,
                        delivery.event_type,
                        delivery.payload.data
                    );
                }
            }

        } catch (error) {
            logger.errorWithContext('Error processing webhook retries', error);
        }
    }

    /**
     * Register a new webhook
     */
    async registerWebhook(name, url, events, secret = null, createdBy = null) {
        try {
            const { data, error } = await this.supabase
                .from('webhooks')
                .insert({
                    name,
                    url,
                    events,
                    secret,
                    created_by: createdBy
                })
                .select()
                .single();

            if (error) throw error;

            logger.info(`Webhook registered: ${name}`, { url, events });

            return data;

        } catch (error) {
            logger.errorWithContext('Error registering webhook', error);
            throw error;
        }
    }

    /**
     * Delete a webhook
     */
    async deleteWebhook(webhookId, deletedBy) {
        try {
            const { error } = await this.supabase
                .from('webhooks')
                .delete()
                .eq('id', webhookId);

            if (error) throw error;

            logger.info(`Webhook deleted: ${webhookId} by ${deletedBy}`);

            return true;

        } catch (error) {
            logger.errorWithContext('Error deleting webhook', error);
            throw error;
        }
    }

    /**
     * List all webhooks
     */
    async listWebhooks() {
        try {
            const { data, error } = await this.supabase
                .from('webhooks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];

        } catch (error) {
            logger.errorWithContext('Error listing webhooks', error);
            return [];
        }
    }
}

// Event types constants
WebhookService.Events = {
    TRANSACTION_SUCCESS: 'transaction.success',
    TRANSACTION_FAILED: 'transaction.failed',
    CARD_CREATED: 'card.created',
    CARD_UPGRADED: 'card.upgraded',
    PAYMENT_RECEIVED: 'payment.received',
    DEBT_HIGH: 'debt.high',
    COMPANY_CREATED: 'company.created',
    PAYROLL_PROCESSED: 'payroll.processed'
};

module.exports = WebhookService;
