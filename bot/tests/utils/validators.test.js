/**
 * Tests for Validators utility
 */

const Validators = require('../../utils/validators');
const ErrorHandler = require('../../utils/errorHandler');

describe('Validators', () => {
    describe('validateAmount', () => {
        it('should accept valid amounts', () => {
            expect(Validators.validateAmount(100)).toBe(true);
            expect(Validators.validateAmount(1000)).toBe(true);
        });

        it('should reject negative amounts', () => {
            expect(() => Validators.validateAmount(-100)).toThrow('mínimo');
        });

        it('should reject non-numeric values', () => {
            expect(() => Validators.validateAmount('abc')).toThrow('número válido');
            expect(() => Validators.validateAmount(NaN)).toThrow('número válido');
        });

        it('should respect min/max options', () => {
            expect(() => Validators.validateAmount(50, { min: 100 })).toThrow('mínimo');
            expect(() => Validators.validateAmount(1000, { max: 500 })).toThrow('máximo');
        });
    });

    describe('parseAmount', () => {
        it('should parse numeric strings', () => {
            expect(Validators.parseAmount('100')).toBe(100);
            expect(Validators.parseAmount('1,000')).toBe(1000);
            expect(Validators.parseAmount('50,000.50')).toBe(50000);
        });

        it('should handle "todo" keyword', () => {
            expect(Validators.parseAmount('todo', 500)).toBe(500);
            expect(Validators.parseAmount('all', 1000)).toBe(1000);
        });

        it('should throw error for invalid input', () => {
            expect(() => Validators.parseAmount('invalid')).toThrow();
        });

        it('should throw error for "todo" without balance', () => {
            expect(() => Validators.parseAmount('todo')).toThrow('Balance no disponible');
        });

        it('should handle numbers directly', () => {
            expect(Validators.parseAmount(100)).toBe(100);
        });
    });

    describe('validateDNI', () => {
        let mockSupabase;

        beforeEach(() => {
            mockSupabase = global.createMockSupabase();
        });

        it('should find DNI in citizens table', async () => {
            mockSupabase.from().maybeSingle.mockResolvedValueOnce({
                data: { dni_number: '12345678' },
                error: null
            });

            const result = await Validators.validateDNI(mockSupabase, 'user-123');

            expect(result.valid).toBe(true);
            expect(result.dni).toBe('12345678');
        });

        it('should fallback to citizen_dni table', async () => {
            // First call (citizens) returns null
            mockSupabase.from().maybeSingle
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValueOnce({ data: { dni_number: '87654321' }, error: null });

            const result = await Validators.validateDNI(mockSupabase, 'user-123');

            expect(result.valid).toBe(true);
            expect(result.dni).toBe('87654321');
        });

        it('should throw error if DNI not found', async () => {
            mockSupabase.from().maybeSingle.mockResolvedValue({ data: null, error: null });

            await expect(Validators.validateDNI(mockSupabase, 'user-123'))
                .rejects.toThrow('DNI');
        });
    });

    describe('validateRole', () => {
        let mockMember;

        beforeEach(() => {
            mockMember = {
                roles: {
                    cache: new Map([
                        ['role-1', { id: 'role-1' }],
                        ['role-2', { id: 'role-2' }],
                    ])
                }
            };
        });

        it('should return true if user has role', () => {
            expect(Validators.validateRole(mockMember, 'role-1')).toBe(true);
        });

        it('should return true if user has any of multiple roles', () => {
            expect(Validators.validateRole(mockMember, ['role-1', 'role-3'])).toBe(true);
        });

        it('should throw error if user lacks role', () => {
            expect(() => Validators.validateRole(mockMember, 'role-999'))
                .toThrow('rol necesario');
        });

        it('should return false without throwing if throwError is false', () => {
            expect(Validators.validateRole(mockMember, 'role-999', false)).toBe(false);
        });
    });

    describe('validateCooldown', () => {
        let cooldownMap;

        beforeEach(() => {
            cooldownMap = new Map();
        });

        it('should allow first use', () => {
            expect(Validators.validateCooldown(cooldownMap, 'user-1', 'test', 60)).toBe(true);
        });

        it('should reject rapid reuse', () => {
            Validators.validateCooldown(cooldownMap, 'user-1', 'test', 60);

            expect(() => Validators.validateCooldown(cooldownMap, 'user-1', 'test', 60))
                .toThrow('esperar');
        });

        it('should allow use after cooldown expires', () => {
            const now = Date.now();
            cooldownMap.set('user-1_test', now - 61000); // 61 seconds ago

            expect(Validators.validateCooldown(cooldownMap, 'user-1', 'test', 60)).toBe(true);
        });
    });

    describe('sanitizeString', () => {
        it('should trim whitespace', () => {
            expect(Validators.sanitizeString('  test  ')).toBe('test');
        });

        it('should remove newlines by default', () => {
            expect(Validators.sanitizeString('test\nline')).toBe('test line');
        });

        it('should preserve newlines if allowed', () => {
            const result = Validators.sanitizeString('test\nline', { allowNewlines: true });
            expect(result).toBe('test\nline');
        });

        it('should truncate long strings', () => {
            const long = 'a'.repeat(2000);
            const result = Validators.sanitizeString(long, { maxLength: 100 });

            expect(result.length).toBe(100);
        });

        it('should remove null bytes', () => {
            expect(Validators.sanitizeString('test\0null')).toBe('testnull');
        });
    });

    describe('validateDiscordId', () => {
        it('should accept valid Discord IDs', () => {
            expect(Validators.validateDiscordId('123456789012345678')).toBe(true);
            expect(Validators.validateDiscordId('1234567890123456789')).toBe(true);
        });

        it('should reject invalid IDs', () => {
            expect(() => Validators.validateDiscordId('123')).toThrow();
            expect(() => Validators.validateDiscordId('abc123')).toThrow();
            expect(() => Validators.validateDiscordId('')).toThrow();
        });
    });
});
