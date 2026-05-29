import { describe, it, expect } from 'vitest';
import { formatCurrency, cleanMerchantName, getCategoryEmoji } from './formatting';

describe('Formatting Utilities', () => {
  describe('formatCurrency', () => {
    it('formats positive currency values correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats negative currency values correctly', () => {
      expect(formatCurrency(-500)).toContain('$500.00');
    });

    it('formats zero values correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('cleanMerchantName', () => {
    it('strips card provider prefixes like SQ* and SP*', () => {
      expect(cleanMerchantName('SQ *COFFEE SHOP')).toBe('COFFEE SHOP');
      expect(cleanMerchantName('SP *STORE')).toBe('STORE');
    });

    it('strips Amazon marketplace and Paypal prefixes', () => {
      expect(cleanMerchantName('AMZN MKTP US*1A2B3C')).toBe('1A2B3C');
      expect(cleanMerchantName('PAYPAL *UBER')).toBe('UBER');
    });

    it('removes address/shop hashes and phone numbers', () => {
      expect(cleanMerchantName('GAS STATION #1234')).toBe('GAS STATION');
      expect(cleanMerchantName('MERCHANT 800-555-0199')).toBe('MERCHANT');
    });

    it('handles null/undefined descriptions gracefully', () => {
      expect(cleanMerchantName(null)).toBe('');
      expect(cleanMerchantName('')).toBe('');
    });
  });

  describe('getCategoryEmoji', () => {
    it('resolves paycheck/salary categories to emoji 💸', () => {
      expect(getCategoryEmoji('Paycheck')).toBe('💸');
    });

    it('resolves grocery/costco categories to emoji 🛒', () => {
      expect(getCategoryEmoji('Groceries')).toBe('🛒');
    });

    it('resolves kids/daycare categories to emoji 👶', () => {
      expect(getCategoryEmoji('Babysitter & Daycare')).toBe('👶');
    });

    it('falls back to default label tag emoji', () => {
      expect(getCategoryEmoji('unknown_cat_custom')).toBe('🏷️');
    });
  });
});
