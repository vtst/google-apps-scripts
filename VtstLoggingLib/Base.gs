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

// Interface for logger.
class LoggerInterface {

  // Methods for adding messages to the log with a given level.
  log(level, ...messages) {}
  info(...messages) {}
  warn(...messages) {}
  error(...messages) {}

  // Some implementations of Logger may have a buffer. The client can call flush() at any time
  // to suggest to the logger to permanently store its current state. The client must call
  // close() at the end of processing to tell the logger it's time to store permanently the log.
  flush() {}
  close() {}

}

// Abstract class for implementing loggers. Sub-classes need to implement the _log method.
class BaseLogger extends LoggerInterface {

  constructor(options) {
    super();
    this.level = typeof options.level === 'number' ? options.level : LogLevel.INFO;
  }

  _log(level, ...messages) { throw 'Not implemented'; };
  log(level, ...messages) {
    if (level >= this.level) this._log(level, ...messages);
  }
  info(...messages) { this.log(LogLevel.INFO, ...messages); }
  warn(...messages) { this.log(LogLevel.WARNING, ...messages); }
  error(...messages) { this.log(LogLevel.ERROR, ...messages); }

  flush() {}
  console() {}

};

// Logger doing nothing.
class VoidLogger extends LoggerInterface {

  constructor(options) {
    super(options);
  }

  _log(level, ...messages) {}

}

// Logger outputting to the console.
class ConsoleLogger extends BaseLogger {
  _log(level, ...messages) { Logger.log(`[${logLevelToString(level)}] ${messages.join(' ')}`); }
};
