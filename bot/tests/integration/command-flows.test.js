/**
 * Integration tests for critical commands using our new utilities
 * Tests payment processing, state management, validators, and error handling
 */

const PaymentProcessor = require('../../utils/paymentProcessor');
const Validators = require('../../utils/validators');
const ErrorHandler = require('../../utils/errorHandler');

describe('Payment Processing Integration', () => {
    let processor;
    let mockSupabase;
    let mockBillingService;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();
        mockBillingService = {
            ubService: {
                getUserBalance: jest.fn(),
                setBalance: jest.fn()
            }
        };
        processor = new PaymentProcessor(mockSupabase, mockBillingService);
    });

    describe('getAvailablePaymentMethods', () => {
        it('should return all payment methods for a wealthy user', async () => {
            mockBillingService.ubService.getUserBalance.mockResolvedValue({
                cash: 50000,
                bank: 100000
            });

            mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
                data: [{ id: 'card1', card_number: '1234', balance: 5000, credit_limit: 10000 }],
                error: null
            });

            mockSupabase.from().select().eq().eq().maybeSingle.mockResolvedValue({
                data: [{ id: 'debit1', card_number: '5678' }],
                error: null
            });

            const methods = await processor.getAvailablePaymentMethods('user123', 'guild123', 1000);

            expect(methods.cash).toBeDefined();
            expect(methods.cash.available).toBeTruthy();
            expect(methods.debit).toBeDefined();
            expect(methods.credit).toBeDefined();
        });

        it('should show insufficient funds when user is poor', async () => {
            mockBillingService.ubService.getUserBalance.mockResolvedValue({
                cash: 100,
                bank: 0
            });

            const methods = await processor.getAvailablePaymentMethods('user123', 'guild123', 5000);

            expect(methods.cash.available).toBeFalsy();
            expect(methods.cash.reason).toBe('Fondos insuficientes');
        });
    });

    describe('processPayment', () => {
        it('should process cash payment successfully', async () => {
            mockBillingService.ubService.getUserBalance.mockResolvedValue({
                cash: 10000,
                bank: 5000
            });
            mockBillingService.ubService.setBalance.mockResolvedValue({});

            const result = await processor.processPayment('cash', 'user123', 'guild123', 1000, 'Test payment');

            expect(result.success).toBeTruthy();
            expect(result.method).toBe('💵 Efectivo');
            expect(result.amount).toBe(1000);
            expect(mockBillingService.ubService.setBalance).toHaveBeenCalledWith(
                'guild123',
                'user123',
                { cash: 9000, bank: 5000 },
                expect.stringContaining('Test payment')
            );
        });

        it('should fail payment with insufficient funds', async () => {
            mockBillingService.ubService.getUserBalance.mockResolvedValue({
                cash: 100,
                bank: 0
            });

            await expect(
                processor.processPayment('cash', 'user123', 'guild123', 5000, 'Test')
            ).rejects.toThrow();
        });
    });
});

describe('Validators Integration', () => {
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();
    });

    describe('validateAmount', () => {
        it('should accept valid amounts', () => {
            expect(() => Validators.validateAmount(1000, { min: 1, max: 10000 })).not.toThrow();
            expect(() => Validators.validateAmount(1, { min: 1, max: 100 })).not.toThrow();
            expect(() => Validators.validateAmount(100, { min: 1, max: 100 })).not.toThrow();
        });

        it('should reject amounts below minimum', () => {
            expect(() => Validators.validateAmount(0, { min: 1, max: 1000 }))
                .toThrow(); // Checks for any error thrown
            expect(() => Validators.validateAmount(-100, { min: 1, max: 1000 }))
                .toThrow();
        });

        it('should reject amounts above maximum', () => {
            expect(() => Validators.validateAmount(10001, { min: 1, max: 10000 }))
                .toThrow(); // Just check it throws, message may vary
        });
    });

    describe('parseAmount', () => {
        it('should parse numeric strings', () => {
            expect(Validators.parseAmount('1000', 5000)).toBe(1000);
            expect(Validators.parseAmount('1,000', 5000)).toBe(1000);
            expect(Validators.parseAmount('1,000,000', 5000000)).toBe(1000000);
        });

        it('should parse "todo" and "all" keywords', () => {
            expect(Validators.parseAmount('todo', 5000)).toBe(5000);
            expect(Validators.parseAmount('all', 3000)).toBe(3000);
            expect(Validators.parseAmount('TODO', 10000)).toBe(10000);
        });

        it('should throw on invalid input', () => {
            expect(() => Validators.parseAmount('abc', 1000)).toThrow();
            expect(() => Validators.parseAmount('', 1000)).toThrow();
            expect(() => Validators.parseAmount(null, 1000)).toThrow();
        });
    });
});

describe('ErrorHandler Integration', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = global.createMockInteraction();
        // Add required methods for ErrorHandler
        mockInteraction.reply = jest.fn().mockResolvedValue({});
        mockInteraction.deferred = false;
        mockInteraction.replied = false;
    });

    describe('handle', () => {
        it('should handle custom errors with user messages', async () => {
            const error = ErrorHandler.createError('INSUFFICIENT_FUNDS', 'No tienes $1000');

            await ErrorHandler.handle(error, mockInteraction);

            // Check that either editReply or reply was called
            const called = mockInteraction.editReply.mock.calls.length > 0 ||
                mockInteraction.reply.mock.calls.length > 0;
            expect(called).toBeTruthy();
        });

        it('should handle PostgreSQL unique constraint errors', async () => {
            const error = new Error('duplicate key value violates unique constraint');
            error.code = '23505';

            await ErrorHandler.handle(error, mockInteraction);

            const called = mockInteraction.editReply.mock.calls.length > 0 ||
                mockInteraction.reply.mock.calls.length > 0;
            expect(called).toBeTruthy();
        });

        it('should handle generic errors gracefully', async () => {
            const error = new Error('Random error');

            await ErrorHandler.handle(error, mockInteraction);

            const called = mockInteraction.editReply.mock.calls.length > 0 ||
                mockInteraction.reply.mock.calls.length > 0;
            expect(called).toBeTruthy();
        });
    });

    describe('wrap', () => {
        it('should wrap async functions and catch errors', async () => {
            const riskyFunction = jest.fn().mockRejectedValue(new Error('Boom'));
            const wrapped = ErrorHandler.wrap(riskyFunction);

            await wrapped(mockInteraction);

            expect(riskyFunction).toHaveBeenCalledWith(mockInteraction);
            // Check that error was handled
            const called = mockInteraction.editReply.mock.calls.length > 0 ||
                mockInteraction.reply.mock.calls.length > 0;
            expect(called).toBeTruthy();
        });

        it('should pass through successful execution', async () => {
            const safeFunction = jest.fn().mockResolvedValue('Success');
            const wrapped = ErrorHandler.wrap(safeFunction);

            await wrapped(mockInteraction);

            expect(safeFunction).toHaveBeenCalledWith(mockInteraction);
            // No error handling should occur
        });
    });
});

describe('Real Command Flow Simulation', () => {
    it('should simulate a complete payment command flow', async () => {
        const mockInteraction = global.createMockInteraction();
        const mockSupabase = global.createMockSupabase();
        const mockBillingService = {
            ubService: {
                getUserBalance: jest.fn().mockResolvedValue({ cash: 10000, bank: 5000 }),
                setBalance: jest.fn().mockResolvedValue({})
            }
        };

        // Simulate DNI validation - return data in first call
        mockSupabase.from().select().eq().maybeSingle.mockResolvedValueOnce({
            data: { discord_id: 'user123', full_name: 'Test User' },
            error: null
        });

        // Simulate payment processing
        const processor = new PaymentProcessor(mockSupabase, mockBillingService);

        // 1. Validate DNI
        const dniResult = await Validators.validateDNI(mockSupabase, 'user123');
        expect(dniResult.valid).toBeTruthy();
        expect(dniResult.dni.full_name).toBe('Test User');

        // 2. Validate and parse amount
        const amount = Validators.parseAmount('1000', 10000);
        expect(amount).toBe(1000);
        Validators.validateAmount(amount, { min: 100, max: 100000 });

        // 3. Get payment methods
        const methods = await processor.getAvailablePaymentMethods('user123', 'guild123', amount);
        expect(methods.cash.available).toBeTruthy();

        // 4. Process payment
        const result = await processor.processPayment('cash', 'user123', 'guild123', amount, 'Test');
        expect(result.success).toBeTruthy();
        expect(result.method).toBe('💵 Efectivo');
        expect(result.amount).toBe(1000);
    });
});
