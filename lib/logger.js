/**
 * Shared Logger module for Zhihu-md extension
 * Provides consistent logging across content scripts, popup, and background worker
 */

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
      console.log(`%c${this.PREFIX} [INFO]`, this.STYLES.info, ...args);
    },
    success: function(...args) {
      console.log(`%c${this.PREFIX} [SUCCESS]`, this.STYLES.success, ...args);
    },
    warn: function(...args) {
      console.warn(`%c${this.PREFIX} [WARN]`, this.STYLES.warn, ...args);
    },
    error: function(...args) {
      console.error(`%c${this.PREFIX} [ERROR]`, this.STYLES.error, ...args);
    },
    debug: function(...args) {
      console.log(`%c${this.PREFIX} [DEBUG]`, this.STYLES.debug, ...args);
    },
    group: function(label) {
      console.group(`${this.PREFIX} ${label}`);
    },
    groupEnd: function() {
      console.groupEnd();
    }
  };
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.createLogger = createLogger;
}
