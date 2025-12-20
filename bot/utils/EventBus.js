/**
 * Event-Driven Architecture - Central Event Bus
 * Fase 5, Item #18: Event-Driven Architecture
 */

const EventEmitter = require('events');
const logger = require('../services/Logger');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // Increase for many listeners
        this.setupErrorHandling();
    }

    /**
     * Setup error handling for uncaught events
     */
    setupErrorHandling() {
        this.on('error', (error) => {
            logger.errorWithContext('EventBus error', error);
        });
    }

    /**
     * Emit event with logging
     */
    emitEvent(eventName, data) {
        logger.debug(`Event emitted: ${eventName}`, { data });
        this.emit(eventName, data);
    }

    /**
     * Subscribe to event with error handling
     */
    subscribe(eventName, handler) {
        const wrappedHandler = async (...args) => {
            try {
                await handler(...args);
            } catch (error) {
                logger.errorWithContext(`Error in ${eventName} handler`, error);
            }
        };

        this.on(eventName, wrappedHandler);
        logger.debug(`Subscribed to event: ${eventName}`);

        return () => this.off(eventName, wrappedHandler);
    }

    /**
     * Subscribe once
     */
    subscribeOnce(eventName, handler) {
        const wrappedHandler = async (...args) => {
            try {
                await handler(...args);
            } catch (error) {
                logger.errorWithContext(`Error in ${eventName} handler`, error);
            }
        };

        this.once(eventName, wrappedHandler);
        logger.debug(`Subscribed once to event: ${eventName}`);
    }
}

// Singleton instance
const eventBus = new EventBus();

// ===================================================================
// Event Types (Constants)
// ===================================================================

const Events = {
    // Transaction events
    TRANSACTION_CREATE: 'transaction.create',
    TRANSACTION_SUCCESS: 'transaction.success',
    TRANSACTION_FAILED: 'transaction.failed',

    // Card events
    CARD_CREATED: 'card.created',
    CARD_UPGRADED: 'card.upgraded',
    CARD_FROZEN: 'card.frozen',

    // Company events
    COMPANY_CREATED: 'company.created',
    PAYROLL_PROCESSED: 'payroll.processed',

    // User events
    USER_REGISTERED: 'user.registered',
    POINTS_EARNED: 'points.earned',
    POINTS_REDEEMED: 'points.redeemed',

    // Loan events
    LOAN_CREATED: 'loan.created',
    LOAN_REPAID: 'loan.repaid',
    LOAN_DEFAULTED: 'loan.defaulted',

    // Notification events
    NOTIFICATION_QUEUED: 'notification.queued',
    NOTIFICATION_SENT: 'notification.sent',

    // System events
    BOT_READY: 'bot.ready',
    ERROR_OCCURRED: 'error.occurred'
};

module.exports = {
    eventBus,
    Events
};
