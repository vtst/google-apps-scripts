var $M = $M || {};
$M.logging = {};

$M.logging.Level = {
  INFO: 0,
  WARNING: 1,
  ERROR: 2
};

$M.logging.levelToString = (level) => {
  switch (level) {
    case $M.logging.Level.INFO: return 'INFO';
    case $M.logging.Level.WARNING: return 'WARNING';
    case $M.logging.Level.ERROR: return 'ERROR';
    default: return 'UNKNOWN';
  }
}

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
  _log(level, message) { console.log(`[${$M.logging.levelToString(level)}] ${message}`); }
};
