// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

function myFunction() {
  var view = {
    'a': 'aaa',
    'b': 'bbb',
    'short_url': 'short-file-url:Doc A'
  };
  var folder = DriveApp.getFolderById('0Bz1giwzBwaikWUUxcndPRUZHODQ');
  var dest = DriveApp.getFolderById('0Bz1giwzBwaikfjNkdE1xT1FMNVBWZWZOeVRTMWtrV09ZblNsdUhZb1V1UEFYWUFBYWI5dlk');
  instantiate(view, folder, dest);
}

// How copy of forms work
// * Copy of a standalone form: the new form has no destination
// * Copy of a spreadsheet which is a form destination: new form created automatically
// * Copy of a spreadsheet which has a form: new form created automatically (in the parent folder)
// QUESTION: Where is the new form created when the parent folder cannot be edited

function testForm() {
  var view = {'a': 'COPY'};
  var cloner = new DriveCloner_(view);
  
  var out = DriveApp.getFolderById('0Bz1giwzBwaikfjNkdE1xT1FMNVBWZWZOeVRTMWtrV09ZblNsdUhZb1V1UEFYWUFBYWI5dlk');
  var id = '1k8m8woPFNBmXZy4UsjC1CVfRxoQHVTzoHwK34yFQc24';
  var file = DriveApp.getFileById(id);
  var fileCopy = cloner.copy(file, out);
  
  var spreadsheet = SpreadsheetApp.openById(id);
  var spreadsheetCopy = SpreadsheetApp.openById(fileCopy.getId());
  Logger.log(spreadsheet.getFormUrl());
  Logger.log(spreadsheetCopy.getFormUrl());
  
  /*
  var form = FormApp.openById(file.getId());
  var formCopy = FormApp.openById(fileCopy.getId());
  formCopy.setDescription('Foo');
  Logger.log(getFormDestinationId_(form));
  Logger.log(getFormDestinationId_(formCopy));
  */
};