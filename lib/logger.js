/**
 * Shared Logger module for Zhihu-md extension
 * Provides consistent logging across content scripts, popup, and background worker
 */

// 日志级别：DEBUG < INFO < WARN < ERROR < NONE
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 默认日志级别：只显示 WARN 及以上（生产环境）
// 如需调试，可以改为 LOG_LEVELS.DEBUG
let currentLogLevel = LOG_LEVELS.WARN;

/**
 * Set the global log level
 * @param {string} level - 'DEBUG', 'INFO', 'WARN', 'ERROR', or 'NONE'
 */
function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLogLevel = LOG_LEVELS[level];
  }
}

/**
 * Create a logger instance with a specific prefix
 * @param {string} prefix - The prefix to use for log messages (e.g., '[Zhihu-MD Content]')
 * @returns {Object} Logger instance with logging methods
 */
function createLogger(prefix) {
  const STYLES = {
    info: 'color: #2196F3; font-weight: bold;',
    success: 'color: #4CAF50; font-weight: bold;',
    warn: 'color: #FF9800; font-weight: bold;',
    error: 'color: #F44336; font-weight: bold;',
    debug: 'color: #9C27B0; font-weight: bold;'
  };

  return {
    PREFIX: prefix,
    STYLES: STYLES,

    info: function(...args) {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.log(`%c${this.PREFIX} [INFO]`, this.STYLES.info, ...args);
      }
    },
    success: function(...args) {
      // success 总是显示（等同于 INFO 级别但强制显示）
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.log(`%c${this.PREFIX} [SUCCESS]`, this.STYLES.success, ...args);
      }
    },
    warn: function(...args) {
      if (currentLogLevel <= LOG_LEVELS.WARN) {
        console.warn(`%c${this.PREFIX} [WARN]`, this.STYLES.warn, ...args);
      }
    },
    error: function(...args) {
      if (currentLogLevel <= LOG_LEVELS.ERROR) {
        console.error(`%c${this.PREFIX} [ERROR]`, this.STYLES.error, ...args);
      }
    },
    debug: function(...args) {
      if (currentLogLevel <= LOG_LEVELS.DEBUG) {
        console.log(`%c${this.PREFIX} [DEBUG]`, this.STYLES.debug, ...args);
      }
    },
    group: function(label) {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.group(`${this.PREFIX} ${label}`);
      }
    },
    groupEnd: function() {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.groupEnd();
      }
    }
  };
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.createLogger = createLogger;
  window.setLogLevel = setLogLevel;
  window.LOG_LEVELS = LOG_LEVELS;
}
