// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

/**
@param {Sheet|Range} sheet_or_range
@param {Object.<string, number|string>} columnTitles
@return {Recordset_}
*/
function create(sheet_or_range, columnIndexes) {
  var range = getRange_(sheet_or_range);
  var colummMap = new ColumnTitleMap_(null, columnIndexes);  
  return new Recordset_(range, colummMap);
};

/**
@param {Sheet|Range} sheet_or_range
@param {Object.<string, number|string>} columnTitles
@return {Recordset_}
*/
function createWithHeaderRow(sheet_or_range, columnTitles) {
  var range = getRange_(sheet_or_range);
  var colummMap = new ColumnTitleMap_(range.offset(0, 0, 1), columnTitles);
  return new Recordset_(range.offset(1, 0, range.getNumRows() - 1), colummMap);
};

/**
@param {Sheet|Range} sheet_or_range
@return {Range}
@private
*/
function getRange_(sheet_or_range) {
  if (sheet_or_range.getSheetName) {
    return sheet_or_range.getDataRange();
  } else {
    return sheet_or_range;
  }
};
