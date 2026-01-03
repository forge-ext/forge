import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '../../../lib/shared/logger.js';

describe('Logger', () => {
  let logSpy;
  let mockSettings;

  beforeEach(() => {
    // Mock the global log function
    global.log = vi.fn();
    logSpy = vi.spyOn(global, 'log');

    // Create mock settings
    mockSettings = {
      get_boolean: vi.fn(),
      get_uint: vi.fn()
    };

    // Default: logging enabled, level ALL
    mockSettings.get_boolean.mockReturnValue(true);
    mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ALL);

    // Initialize logger with mock settings
    Logger.init(mockSettings);
  });

  afterEach(() => {
    logSpy.mockRestore();
    delete global.log;
  });

  describe('LOG_LEVELS', () => {
    it('should define all log levels', () => {
      expect(Logger.LOG_LEVELS.OFF).toBe(0);
      expect(Logger.LOG_LEVELS.FATAL).toBe(1);
      expect(Logger.LOG_LEVELS.ERROR).toBe(2);
      expect(Logger.LOG_LEVELS.WARN).toBe(3);
      expect(Logger.LOG_LEVELS.INFO).toBe(4);
      expect(Logger.LOG_LEVELS.DEBUG).toBe(5);
      expect(Logger.LOG_LEVELS.TRACE).toBe(6);
      expect(Logger.LOG_LEVELS.ALL).toBe(7);
    });

    it('should have ascending level values', () => {
      expect(Logger.LOG_LEVELS.FATAL).toBeGreaterThan(Logger.LOG_LEVELS.OFF);
      expect(Logger.LOG_LEVELS.ERROR).toBeGreaterThan(Logger.LOG_LEVELS.FATAL);
      expect(Logger.LOG_LEVELS.WARN).toBeGreaterThan(Logger.LOG_LEVELS.ERROR);
      expect(Logger.LOG_LEVELS.INFO).toBeGreaterThan(Logger.LOG_LEVELS.WARN);
      expect(Logger.LOG_LEVELS.DEBUG).toBeGreaterThan(Logger.LOG_LEVELS.INFO);
      expect(Logger.LOG_LEVELS.TRACE).toBeGreaterThan(Logger.LOG_LEVELS.DEBUG);
      expect(Logger.LOG_LEVELS.ALL).toBeGreaterThan(Logger.LOG_LEVELS.TRACE);
    });
  });

  describe('format', () => {
    it('should replace single placeholder', () => {
      const result = Logger.format('Hello {}', 'World');
      expect(result).toBe('Hello World');
    });

    it('should replace multiple placeholders', () => {
      const result = Logger.format('{} + {} = {}', 1, 2, 3);
      expect(result).toBe('1 + 2 = 3');
    });

    it('should replace placeholders in order', () => {
      const result = Logger.format('{} {} {}', 'a', 'b', 'c');
      expect(result).toBe('a b c');
    });

    it('should handle no placeholders', () => {
      const result = Logger.format('No placeholders');
      expect(result).toBe('No placeholders');
    });

    it('should handle more params than placeholders', () => {
      const result = Logger.format('Only {}', 'one', 'two', 'three');
      expect(result).toBe('Only one');
    });

    it('should handle empty string', () => {
      const result = Logger.format('');
      expect(result).toBe('');
    });
  });

  describe('fatal', () => {
    it('should log when logging is enabled', () => {
      Logger.fatal('test message');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [FATAL]', 'test message');
    });

    it('should not log when logging is disabled', () => {
      mockSettings.get_boolean.mockReturnValue(false);
      Logger.init(mockSettings);

      Logger.fatal('test message');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log with multiple arguments', () => {
      Logger.fatal('error', 'code', 123);
      expect(logSpy).toHaveBeenCalledWith('[Forge] [FATAL]', 'error', 'code', 123);
    });

    it('should always log when level is ALL', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ALL);
      Logger.init(mockSettings);

      Logger.fatal('message');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log when level is ERROR or higher', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ERROR);
      Logger.init(mockSettings);

      Logger.error('test error');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [ERROR]', 'test error');
    });

    it('should not log when level is FATAL', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.FATAL);
      Logger.init(mockSettings);

      Logger.error('test error');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log when level is higher than ERROR', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.WARN);
      Logger.init(mockSettings);

      Logger.error('test error');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log when level is WARN or higher', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.WARN);
      Logger.init(mockSettings);

      Logger.warn('test warning');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [WARN]', 'test warning');
    });

    it('should not log when level is ERROR', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ERROR);
      Logger.init(mockSettings);

      Logger.warn('test warning');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log when level is INFO', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.INFO);
      Logger.init(mockSettings);

      Logger.warn('test warning');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log when level is INFO or higher', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.INFO);
      Logger.init(mockSettings);

      Logger.info('test info');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [INFO]', 'test info');
    });

    it('should not log when level is WARN', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.WARN);
      Logger.init(mockSettings);

      Logger.info('test info');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log when level is DEBUG', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.DEBUG);
      Logger.init(mockSettings);

      Logger.info('test info');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log when level is DEBUG or higher', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.DEBUG);
      Logger.init(mockSettings);

      Logger.debug('test debug');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [DEBUG]', 'test debug');
    });

    it('should not log when level is INFO', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.INFO);
      Logger.init(mockSettings);

      Logger.debug('test debug');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log when level is TRACE', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.TRACE);
      Logger.init(mockSettings);

      Logger.debug('test debug');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('trace', () => {
    it('should log when level is TRACE or higher', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.TRACE);
      Logger.init(mockSettings);

      Logger.trace('test trace');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [TRACE]', 'test trace');
    });

    it('should not log when level is DEBUG', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.DEBUG);
      Logger.init(mockSettings);

      Logger.trace('test trace');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log when level is ALL', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ALL);
      Logger.init(mockSettings);

      Logger.trace('test trace');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should log when logging is enabled', () => {
      Logger.log('generic message');
      expect(logSpy).toHaveBeenCalledWith('[Forge] [LOG]', 'generic message');
    });

    it('should not log when level is OFF', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.OFF);
      Logger.init(mockSettings);

      Logger.log('generic message');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log at any level above OFF', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.FATAL);
      Logger.init(mockSettings);

      Logger.log('generic message');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('log level filtering', () => {
    beforeEach(() => {
      logSpy.mockClear();
    });

    it('should only log fatal when level is FATAL', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.FATAL);
      Logger.init(mockSettings);

      Logger.fatal('fatal');
      Logger.error('error');
      Logger.warn('warn');
      Logger.info('info');
      Logger.debug('debug');
      Logger.trace('trace');

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('[Forge] [FATAL]', 'fatal');
    });

    it('should log fatal and error when level is ERROR', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ERROR);
      Logger.init(mockSettings);

      Logger.fatal('fatal');
      Logger.error('error');
      Logger.warn('warn');
      Logger.info('info');

      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('should log all messages when level is ALL', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.ALL);
      Logger.init(mockSettings);

      Logger.fatal('fatal');
      Logger.error('error');
      Logger.warn('warn');
      Logger.info('info');
      Logger.debug('debug');
      Logger.trace('trace');
      Logger.log('log');

      expect(logSpy).toHaveBeenCalledTimes(7);
    });

    it('should not log anything when level is OFF', () => {
      mockSettings.get_uint.mockReturnValue(Logger.LOG_LEVELS.OFF);
      Logger.init(mockSettings);

      Logger.fatal('fatal');
      Logger.error('error');
      Logger.warn('warn');
      Logger.info('info');
      Logger.debug('debug');
      Logger.trace('trace');
      Logger.log('log');

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('without initialization', () => {
    it('should not log when settings is not initialized', () => {
      // Create a new Logger instance without init
      const UninitLogger = class extends Logger {};

      UninitLogger.fatal('test');
      UninitLogger.error('test');
      UninitLogger.warn('test');

      // Should not throw, just not log
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
