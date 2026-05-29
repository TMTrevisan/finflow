import { describe, it, expect } from 'vitest';
import { filterTransactionsByDateRange, getDateRangeLabel } from './dateFilters';

describe('Date Filters', () => {
  const mockTxns = [
    { id: '1', date: '2026-05-15T12:00:00.000Z', amount: 100 },
    { id: '2', date: '2026-05-01T12:00:00.000Z', amount: 50 },
    { id: '3', date: '2026-04-15T12:00:00.000Z', amount: 200 },
    { id: '4', date: '2026-01-10T12:00:00.000Z', amount: 120 }
  ];

  describe('filterTransactionsByDateRange', () => {
    it('returns all transactions when preset is all', () => {
      const result = filterTransactionsByDateRange(mockTxns, 'all');
      expect(result.length).toBe(4);
    });

    it('filters correctly for this_month based on latest txn refDate (May 2026)', () => {
      const result = filterTransactionsByDateRange(mockTxns, 'this_month');
      expect(result.map(t => t.id)).toContain('1');
      expect(result.map(t => t.id)).toContain('2');
      expect(result.map(t => t.id)).not.toContain('3');
    });

    it('filters correctly for custom range limits', () => {
      const result = filterTransactionsByDateRange(mockTxns, 'custom', '2026-04-01', '2026-04-30');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('3');
    });
  });

  describe('getDateRangeLabel', () => {
    it('returns custom date limits appropriately', () => {
      const label = getDateRangeLabel('custom', '2026-04-01T00:00:00', '2026-04-30T00:00:00', mockTxns);
      expect(label).toContain('Apr 1, 2026');
      expect(label).toContain('Apr 30, 2026');
    });

    it('returns All Time for all filterType', () => {
      expect(getDateRangeLabel('all', null, null)).toBe('All Time');
    });
  });
});
