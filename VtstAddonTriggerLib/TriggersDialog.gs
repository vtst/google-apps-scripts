/**
Show the modal dialog that allows to configure all trigers for the current add-on owned by the current user.
 */
function showTriggersDialog(opt_title) {
  // Using null as document ID because it's not used by getUserConfig, though it's extremely hacky.
  const userConfig = _getTriggerManager(null).getUserConfig();
  const template = HtmlService.createTemplateFromFile('TriggersDialogUI');
  template.data = {
    userConfig: userConfig,
    activeUserEmail: Session.getActiveUser().getEmail()
  };
  const html = template.evaluate().setWidth(800).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, opt_title || 'Add-on triggers');

}

function _schedulingToString(scheduling) {
  if (scheduling.everyHours) {
    return `Every ${scheduling.everyHours} hour${scheduling.everyHours > 1 ? 's' : ''}`
  } else {
    return `Every ${scheduling.everyDays} day${scheduling.everyDays > 1 ? 's' : ''}` +
      ('atHour' in scheduling ? ` at ${scheduling.atHour}:00` : '');
  }
}

function callback(method, arg) {
  const manager = _getTriggerManager(null);
  const userConfig = manager.getUserConfig();
  switch(method) {
    case 'removeAll':
      userConfig.documents = {};
      break;
    case 'removeSelection':
      const selectedDocuments = arg;
      for (const docId of selectedDocuments) delete userConfig.documents[docId];
      break;
  }
  manager.setUserConfig(userConfig);
  manager.configureTrigger(userConfig);
}
