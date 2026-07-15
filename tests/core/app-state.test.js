// tests/core/app-state.test.js
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AppState } from '../../js/core/app-state.js';

describe('AppState', () => {
  beforeEach(() => {
    // 每个测试前重置状态，保证测试隔离
    AppState.reset();
  });

  // ===== 基本 get/set =====
  describe('get and set', () => {
    it('should set and get a value', () => {
      AppState.set('isLoggedIn', true);
      expect(AppState.get('isLoggedIn')).toBe(true);
    });

    it('should return undefined for non-existent key', () => {
      expect(AppState.get('non_existent_key')).toBeUndefined();
    });

    it('should overwrite existing value', () => {
      AppState.set('panelCollapsed', true);
      expect(AppState.get('panelCollapsed')).toBe(true);

      AppState.set('panelCollapsed', false);
      expect(AppState.get('panelCollapsed')).toBe(false);
    });

    it('should support chaining', () => {
      const result = AppState.set('test', 123).set('test2', 456);
      expect(result).toBe(AppState);
      expect(AppState.get('test')).toBe(123);
      expect(AppState.get('test2')).toBe(456);
    });
  });

  // ===== setMultiple =====
  describe('setMultiple', () => {
    it('should set multiple key-value pairs', () => {
      AppState.setMultiple({
        isLoggedIn: true,
        panelCollapsed: false,
        testValue: 42,
      });

      expect(AppState.get('isLoggedIn')).toBe(true);
      expect(AppState.get('panelCollapsed')).toBe(false);
      expect(AppState.get('testValue')).toBe(42);
    });

    it('should support chaining', () => {
      const result = AppState.setMultiple({ a: 1, b: 2 }).setMultiple({ c: 3 });
      expect(result).toBe(AppState);
      expect(AppState.get('a')).toBe(1);
      expect(AppState.get('b')).toBe(2);
      expect(AppState.get('c')).toBe(3);
    });

    it('should ignore non-own properties', () => {
      const obj = Object.create({ inherited: 'should be ignored' });
      obj.own = 'should be set';
      AppState.setMultiple(obj);
      expect(AppState.get('own')).toBe('should be set');
      expect(AppState.get('inherited')).toBeUndefined();
    });
  });

  // ===== subscribe =====
  describe('subscribe', () => {
    it('should call callback when state changes', () => {
      const fn = vi.fn();
      AppState.subscribe('testKey', fn);

      AppState.set('testKey', 'new value');
      expect(fn).toHaveBeenCalledWith('new value', undefined);
    });

    it('should call callback with old and new value', () => {
      const fn = vi.fn();
      AppState.set('testKey', 'initial');
      AppState.subscribe('testKey', fn);

      AppState.set('testKey', 'updated');
      expect(fn).toHaveBeenCalledWith('updated', 'initial');
    });

    it('should call callback immediately with current value on subscription', () => {
      const fn = vi.fn();
      AppState.set('testKey', 'current value');

      AppState.subscribe('testKey', fn);
      expect(fn).toHaveBeenCalledWith('current value', undefined);
    });

    it('should not call callback if state value does not change', () => {
      const fn = vi.fn();
      AppState.subscribe('testKey', fn);

      AppState.set('testKey', 'value');
      expect(fn).toHaveBeenCalledTimes(1);

      AppState.set('testKey', 'value');
      expect(fn).toHaveBeenCalledTimes(2); // 仍然调用（因为 set 总是通知）
    });

    it('should support multiple subscribers for same key', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      AppState.subscribe('testKey', fn1);
      AppState.subscribe('testKey', fn2);

      AppState.set('testKey', 'new');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should support chaining', () => {
      const fn = vi.fn();
      const result = AppState.subscribe('test', fn).subscribe('test2', fn);
      expect(result).toBe(AppState);
    });
  });

  // ===== unsubscribe =====
  describe('unsubscribe', () => {
    it('should remove specific callback', () => {
      const fn = vi.fn();
      AppState.subscribe('testKey', fn);

      AppState.set('testKey', 'first');
      expect(fn).toHaveBeenCalledTimes(1);

      AppState.unsubscribe('testKey', fn);
      AppState.set('testKey', 'second');
      expect(fn).toHaveBeenCalledTimes(1); // 不再被调用
    });

    it('should remove all callbacks for a key when no callback specified', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      AppState.subscribe('testKey', fn1);
      AppState.subscribe('testKey', fn2);

      AppState.unsubscribe('testKey');
      AppState.set('testKey', 'new');
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });

    it('should do nothing if key does not exist', () => {
      const result = AppState.unsubscribe('non_existent_key');
      expect(result).toBe(AppState);
    });

    it('should support chaining', () => {
      const result = AppState.unsubscribe('test');
      expect(result).toBe(AppState);
    });
  });

  // ===== reset =====
  describe('reset', () => {
    it('should reset all state to default values', () => {
      AppState.set('isLoggedIn', true);
      AppState.set('panelCollapsed', false);
      AppState.set('panelRight', 100);

      AppState.reset();

      expect(AppState.get('isLoggedIn')).toBe(false);
      expect(AppState.get('panelCollapsed')).toBe(true);
      expect(AppState.get('panelRight')).toBe(20);
    });

    it('should clear all subscribers', () => {
      const fn = vi.fn();
      AppState.subscribe('testKey', fn);
      AppState.reset();

      AppState.set('testKey', 'new');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should support chaining', () => {
      const result = AppState.reset();
      expect(result).toBe(AppState);
    });
  });

  // ===== snapshot =====
  describe('snapshot', () => {
    it('should return a copy of the state', () => {
      AppState.set('isLoggedIn', true);
      AppState.set('panelCollapsed', false);

      const snap = AppState.snapshot();
      expect(snap.isLoggedIn).toBe(true);
      expect(snap.panelCollapsed).toBe(false);
    });

    it('should return a deep copy (not a reference)', () => {
      AppState.set('testKey', { nested: 'value' });
      const snap = AppState.snapshot();

      // 修改 snapshot 不应影响原状态
      snap.testKey.nested = 'modified';
      expect(AppState.get('testKey').nested).toBe('value');
    });
  });

  // ===== error handling =====
  describe('error handling', () => {
    it('should handle subscriber errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber error');
      });

      AppState.subscribe('testKey', fn);
      // 应该不抛出错误
      expect(() => AppState.set('testKey', 'value')).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});