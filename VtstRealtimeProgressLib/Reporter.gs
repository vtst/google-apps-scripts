const _PROPERTY_KEY_PREFIX = 'VtstRealtimeProgressLib:';

class _Reporter {

  constructor(key, pushIntervalInMs) {
    this._key = key;
    this._pushIntervalInMs = pushIntervalInMs || 1000;
    this._lastMessageTimestampInMs = 0;
    this._lastMessage = null;
    this._section = null;
    this._propertiesService = PropertiesService.getUserProperties();
  }

  _shouldSend(now, message, opt_section) {
    if (message === this._lastMessage) {
      return false;
    } else if (opt_section === true) {
      return true;
    } else if (opt_section && opt_section !== this._section) {
      this._section = opt_section;
      return true;
    } else {
      return now - this._lastMessageTimestampInMs > this._pushIntervalInMs;
    }
  }

  send(message, opt_section) {
    if (this._pushIntervalInMs <= 0) return;
    const now = Date.now();
    if (this._shouldSend(now, message, opt_section)) {
      this._lastMessage = message;
      this._lastMessageTimestampInMs = now;
      this._propertiesService.setProperty(this._key, message);
    }
  }

  _end() {
    this._propertiesService.deleteProperty(this._key);
  }

}

class _VoidReporter {
  send(message, opt_isMajor) {}
};

class _ConsoleReporter {
  send(message, opt_isMajor) {
    Logger.log(`[progress] ${message}`);
  }
};
