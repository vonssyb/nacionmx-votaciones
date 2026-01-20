/**
 * Tests for ErrorHandler utility
 */

const ErrorHandler = require('../../utils/errorHandler');

describe('ErrorHandler', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = global.createMockInteraction();
    });

    describe('getUserFriendlyMessage', () => {
        it('should return custom message for known error codes', () => {
            const error = { code: 'INSUFFICIENT_FUNDS' };
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toContain('No tienes suficiente dinero');
        });

        it('should handle DNI_REQUIRED error', () => {
            const error = { code: 'DNI_REQUIRED' };
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toContain('DNI');
        });

        it('should return fallback message for unknown errors', () => {
            const error = { message: 'Something went wrong' };
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toContain('inesperado');
        });

        it('should handle PostgreSQL unique violation', () => {
            const error = { code: '23505' };
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toContain('ya existe');
        });
    });

    describe('createError', () => {
        it('should create error with code and message', () => {
            const error = ErrorHandler.createError('INSUFFICIENT_FUNDS', 'Test message');

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('INSUFFICIENT_FUNDS');
            expect(error.message).toBe('Test message');
        });

        it('should include details', () => {
            const details = { amount: 100, balance: 50 };
            const error = ErrorHandler.createError('INSUFFICIENT_FUNDS', null, details);

            expect(error.details).toEqual(details);
        });
    });

    describe('isCritical', () => {
        it('should identify critical errors', () => {
            const error = { code: 'DATABASE_ERROR' };
            expect(ErrorHandler.isCritical(error)).toBe(true);
        });

        it('should identify non-critical errors', () => {
            const error = { code: 'COOLDOWN_ACTIVE' };
            expect(ErrorHandler.isCritical(error)).toBe(false);
        });

        it('should identify database errors by code prefix', () => {
            const error = { code: '23505' }; // PostgreSQL error
            expect(ErrorHandler.isCritical(error)).toBe(true);
        });
    });

    describe('sendErrorToUser', () => {
        it('should send error as embed if not replied', async () => {
            await ErrorHandler.sendErrorToUser(mockInteraction, 'Test error');

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                    ephemeral: true
                })
            );
        });

        it('should edit reply if already replied', async () => {
            mockInteraction.replied = true;

            await ErrorHandler.sendErrorToUser(mockInteraction, 'Test error');

            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });

    describe('wrap', () => {
        it('should wrap function with error handling', async () => {
            const testFn = jest.fn().mockRejectedValue(new Error('Test error'));
            const wrapped = ErrorHandler.wrap(testFn);

            await wrapped(mockInteraction);

            expect(testFn).toHaveBeenCalledWith(mockInteraction);
            expect(mockInteraction.reply).toHaveBeenCalled();
        });

        it('should pass through successful results', async () => {
            const testFn = jest.fn().mockResolvedValue('success');
            const wrapped = ErrorHandler.wrap(testFn);

            const result = await wrapped(mockInteraction);

            expect(result).toBe('success');
        });
    });
});
