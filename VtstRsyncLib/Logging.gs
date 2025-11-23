var $M = $M || {};
$M.logging = {};

$M.logging.Level = {
  INFO: 0,
  WARNING: 1,
  ERROR: 2
};

$M.logging.VoidLogger = class {

  constructor(opt_level) {
    this.level = opt_level || 0;
  }

  _log(level, message) {};
  log(level, message) {
    if (level >= this.level) this._log(level, message);
  }
  info(message) { this.log($M.logging.Level.INFO, message); }
  warning(message) { this.log($M.logging.Level.WARNING, message); }
  error(message) { this.log($M.logging.Level.ERROR, message); }

};

$M.logging.ConsoleLogger = class extends $M.logging.VoidLogger {
  _log(level, message) { console.log(message); }
};
