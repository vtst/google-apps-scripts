// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

function test_() {
  var sheet = SpreadsheetApp.openById('19IjRpOjCYMKIStnstymfJ7aEZMJYZPz04vvh-D5edJ0').getSheets()[0];
  var rs = createWithHeaderRow(sheet, {a: 'A', b: 'B', c: 'C'});
  Logger.log(rs.getAllRecords());
}
