const _PROPERTY_KEY_PREFIX = 'VtstRealtimeProgressLib:';

class _Reporter {

  constructor(key, pushIntervalInMs) {
    this._key = key;
    this._pushIntervalInMs = pushIntervalInMs || 1000;
    this._lastMessageTimestampInMs = 0;
    this._lastMessage = null;
    this._propertiesService = PropertiesService.getUserProperties();
  }

  send(message) {
    if (this._pushIntervalInMs <= 0) return;
    const now = Date.now();
    if (message !== this._lastMessage && now - this._lastMessageTimestampInMs > this._pushIntervalInMs) {
      this._lastMessage = message;
      this._lastMessageTimestampInMs = now;
      this._propertiesService.setProperty(this._key, message);
    }
  }

  _end() {
    this._propertiesService.deleteProperty(this._key);
  }

}