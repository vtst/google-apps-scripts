const _DEFAULT_CONFIG = {
  user_property_key: 'user:TriggerManager:Config',
  document_property_key: 'script:TriggerManager:Config',
  triggerFunctionName: 'managedAddonTriggerFunction'
};

class TriggerManager {

  constructor(config, docId) {
    this.config = {... _DEFAULT_CONFIG, ... config};
    this.docId = docId;
  }

  clean() {
    PropertiesService.getUserProperties().deleteProperty(this.config.user_property_key);
    PropertiesService.getDocumentProperties().deleteProperty(this.config.document_property_key);
  }

  /* The object stored in UserProperties has the following schema:
     {
       documents: {
         <docId>: {
           lastRun: number,
           config: DocumentConfig (see below)
         }
       } 
     }
  */

  _getUserConfig() {
    try {
      return JSON.parse(PropertiesService.getUserProperties().getProperty(this.config.user_property_key)) || {documents: {}};
    } catch {
      return {documents: {}};
    }
  }

  _setUserConfig(config) {
    PropertiesService.getUserProperties().setProperty(this.config.user_property_key, JSON.stringify(config));
  }

  /* The object stored in DocumentProperties has the following schema:
     {
       settings: Object,
       userEmail: string,
       scheduling: {
         everyHours: number,
         everyDays: number,
         atHour: number
     }
  */

  getConfigForActiveDocument() {
    try {
      return JSON.parse(PropertiesService.getDocumentProperties().getProperty(this.config.document_property_key)) || {};
    } catch {
      return {};
    }
  }

  _checkConfig(config) {
    if (!config.scheduling) return;
    const scheduling = config.scheduling;
    if (scheduling.everyHours && (!Number.isInteger(scheduling.everyHours) || scheduling.everyHours <= 0 || !Number.isInteger(scheduling.everyHours))) 
      throw 'Invalid .scheduling.everyHours value.';
    if (scheduling.everyDays && (!Number.isInteger(scheduling.everyDays) || scheduling.everyDays <= 0))
      throw 'Invalid .scheduling.everyDays value.';
    if (scheduling.atHour && (!Number.isInteger(scheduling.atHour) || scheduling.atHour < 0 || scheduling.atHour > 23))
      throw 'Invalid .scheduling.atHour value.';
    if (!scheduling.everyHours && !scheduling.everyDays) throw 'Either .scheduling.everyHours or .scheduling.everyDays must be set.';
  }

  setConfigForActiveDocument(config) {
    this._checkConfig(config);
    const userEmail = Session.getActiveUser().getEmail();
    const currentConfig = this.getConfigForActiveDocument();
    if (currentConfig.userEmail && currentConfig.userEmail !== userEmail) {
      throw 'Another user already set a trigger for the current document: ' + currentConfig.userEmail + 
        '. They need to remove the trigger before you can setup one.';
    }
    if (config.scheduling) config.userEmail = userEmail; else delete config.userEmail;
    PropertiesService.getDocumentProperties().setProperty(this.config.document_property_key, JSON.stringify(config));
    // Update the user config and the trigger configuration.
    if (!_deepEquals(currentConfig.scheduling, config.scheduling)) {
      const userConfig = this._getUserConfig();
      if (config.scheduling) userConfig.documents[this.docId] = config; else delete userConfig.documents[this.docId];
      this._setUserConfig(userConfig);
      this._configureTrigger(userConfig);
    }
  }

  _getPeriodInHours(docEntries) {
    if (Array.isArray(docEntries)) {
      let period = 0;
      for (const docEntry of docEntries) {
        if (docEntry.scheduling?.everyHours) period = _gcd(period, docEntry.scheduling.everyHours);
        else if (docEntry.scheduling?.everyDays) period = _gcd(period, docEntry.scheduling.everyDays * 24);
      }
      return period;
    } else {
      let docEntry = docEntries;
      if (docEntry.scheduling.everyHours) return docEntry.scheduling.everyHours;
      if (docEntry.scheduling.everyDays) return docEntry.scheduling.everyDays * 24;
      return 0;
    }
  }

  // Return the common atHour of all docEntries which have one. Return -1 if there is none. Return -2 if there are several.
  _getAtHour(docEntries) {
    let hour = -1;
    for (const docEntry of docEntries) {
      if (docEntry.scheduling?.everyDays && typeof docEntry.scheduling?.atHour === 'number') {
        if (hour !== -1 && hour !== docEntry.scheduling.atHour) return -2;
        hour = docEntry.scheduling.atHour;
      }
    }
    return hour;
  }

  // Create the script trigger from the userConfig.  If userConfig.documents is empty, the current trigger is just
  // deleted.  If there are one or several entries in userConfig.documents, a single time-based trigger is configured.
  _configureTrigger(userConfig) {
    const docEntries = Object.values(userConfig.documents);
    const periodInHours = this._getPeriodInHours(docEntries);
    // Delete existing triggers.
    for (let trigger of ScriptApp.getProjectTriggers()) {
      if (trigger.getHandlerFunction() === this.config.triggerFunctionName) ScriptApp.deleteTrigger(trigger);
    }
    if (periodInHours > 0) {
      // Setup a new trigger.
      const triggerBuilder = ScriptApp.newTrigger(this.config.triggerFunctionName).timeBased();
      let atHour = this._getAtHour(docEntries);
      if (periodInHours % 24 === 0 && atHour >= -1) {
        triggerBuilder.everyDays(periodInHours / 24);
        if (atHour >= 0) triggerBuilder.atHour(atHour);
      } else {
        triggerBuilder.everyHours(periodInHours);
      }
      triggerBuilder.create();
    }
  }

  // Trigger function. Calls the handler function fn on the configured documents as needed.
  runTrigger(fn, opt_context) {
    const userConfig = this._getUserConfig();
    const now = new Date;
    for (let docId in userConfig.documents) {
      let docEntry = userConfig.documents[docId];
      if (!docEntry.scheduling) continue;
      if ('atHour' in docEntry.scheduling && docEntry.scheduling.atHour !== now.getHours()) continue;
      let period = this._getPeriodInHours(docEntry);
      if (period === 0) continue;
      if (docEntry.lastRun && (now.getTime() - docEntry.lastRun) < ((period * 3600 - 1000) * 1000)) continue;
      try {
        // Decide if we should run the trigger.
        fn.call(opt_context, docId, docEntry.config.settings);
        docEntry.lastRun = now.getTime();
      } catch (e) {
        Logger.log('Trigger failed for doc ' + docId + ': ' + e);
      }
    }
    this._setUserConfig(userConfig);
  }  
}
