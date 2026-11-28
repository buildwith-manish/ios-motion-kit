import {describe, expect, it} from 'vitest';
import {formatNumber as f, monthYear, quarter} from './format';

const M = '\u2212';
describe('formatNumber', () => {
  it('rounds half away from zero', () => {
    expect(f(1.005, {decimals: 2})).toBe('1.01');
    expect(f(2.5, 'int')).toBe('3');
    expect(f(-2.5, 'int')).toBe(`${M}3`);
    expect(f(0.285, 'decimal2')).toBe('0.29');
  });
  it('negatives, zero, negative zero', () => {
    expect(f(-1234, 'usd')).toBe(`${M}$1,234`);
    expect(f(0, 'delta')).toBe('0');
    expect(f(-0.004, {decimals: 2, sign: 'always'})).toBe('0.00');
    expect(f(-0, 'int')).toBe('0');
  });
  it('very large and small', () => {
    expect(f(1234567890123, 'usd')).toBe('$1,234,567,890,123');
    expect(f(1e-7, 'decimal2')).toBe('0.00');
    expect(f(NaN)).toBe('\u2014');
    expect(f(-Infinity, 'int')).toBe(`${M}\u221E`);
  });
  it('pct vs pp', () => {
    expect(f(0.123, 'pct')).toBe('12.3%');
    expect(f(1.2, 'pp')).toBe('+1.2 pp');
    expect(f(-1.2, 'pp')).toBe(`${M}1.2 pp`);
    expect(f(25, 'bps')).toBe('25 bps');
  });
  it('compact boundaries', () => {
    expect(f(999, 'usdCompact')).toBe('$999');
    expect(f(999.6, 'usdCompact')).toBe('$1.0K');
    expect(f(1000, 'usdCompact')).toBe('$1.0K');
    expect(f(999_499, 'usdCompact')).toBe('$999K');
    expect(f(999_500, 'usdCompact')).toBe('$1.0M');
    expect(f(999_950, 'usdCompact')).toBe('$1.0M');
    expect(f(12_345_678, 'usdCompact')).toBe('$12.3M');
    expect(f(123_456_789, 'usdCompact')).toBe('$123M');
    expect(f(2.5e9, 'usdCompact')).toBe('$2.5B');
    expect(f(7e12, 'usdCompact')).toBe('$7.0T');
    expect(f(-1_500_000, 'usdCompact')).toBe(`${M}$1.5M`);
  });
  it('consistent decimals', () => {
    expect(f(123_456_789, {preset: 'usdCompact', consistentDecimals: true})).toBe('$123.5M');
    expect(f(1500, {preset: 'usdCompact', consistentDecimals: true, decimals: 2})).toBe('$1.50K');
    expect(f(3, 'decimal2')).toBe('3.00');
  });
  it('accounting and explicit plus', () => {
    expect(f(-1234, {preset: 'usd', sign: 'accounting'})).toBe('($1,234)');
    expect(f(1234, {preset: 'usd', sign: 'accounting'})).toBe('$1,234');
    expect(f(0, {preset: 'usd', sign: 'accounting'})).toBe('$0');
    expect(f(5, 'delta')).toBe('+5');
    expect(f(5, {preset: 'usd', sign: 'always'})).toBe('+$5');
  });
});
describe('dates', () => {
  it('quarter', () => {
    expect(quarter('2026-09-15T00:00:00Z')).toBe("Q3 '26");
    expect(quarter(new Date(Date.UTC(2027, 0, 1)))).toBe("Q1 '27");
    expect(quarter('2009-12-31T00:00:00Z')).toBe("Q4 '09");
  });
  it('monthYear', () => {
    expect(monthYear('2026-09-15T00:00:00Z')).toBe('Sep 2026');
  });
});
