const LogLevel = {
  INFO: 0,
  WARNING: 1,
  ERROR: 2,
  NONE: 99
};

function logLevelToString(level) {
  switch (level) {
    case LogLevel.INFO: return 'INFO';
    case LogLevel.WARNING: return 'WARNING';
    case LogLevel.ERROR: return 'ERROR';
    case LogLevel.NONE: return 'NONE';
    default: return 'UNKNOWN';
  }
}

function parseLogLevel(name) {
  switch (name.toLowerCase()) {
    case 'info': return LogLevel.INFO;
    case 'warn': case 'warning': return LogLevel.WARNING;
    case 'error': return LogLevel.ERROR;
    case 'none': return LogLevel.NONE;
  }
}

class VoidLogger {

  constructor(options) {
    this.level = typeof options.level === 'number' || LogLevel.INFO;
  }

  _log(level, message) {};
  log(level, message) {
    if (level >= this.level) this._log(level, message);
  }
  info(message) { this.log(LogLevel.INFO, message); }
  warn(message) { this.log(LogLevel.WARNING, message); }
  error(message) { this.log(LogLevel.ERROR, message); }

  flush() {}

};

class ConsoleLogger extends VoidLogger {
  _log(level, message) { console.log(`[${logLevelToString(level)}] ${message}`); }
};
