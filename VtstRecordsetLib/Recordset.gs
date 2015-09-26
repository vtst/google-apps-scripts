// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

// ********************************************************************************
// Class Recordset_

/**
An helper class to access sheets from Google Spreadsheets as record files.
@param {Range} range
@param {ColumnMap_} ColumnMap_
@constructor Foo
@class Foo
*/
function Recordset_(range, columnMap) {
  /** @private {Range} */
  this.range_ = range;
  /** @private {ColumnMap_} */
  this.columnMap_ = columnMap;
};

/**
@param {string} columnKey
@return {number}
*/
Recordset_.prototype.getColumnIndex_ = function(columnKey) {
  var columnIndex = this.columnMap_.get(columnKey);
  if (columnIndex === undefined)
    throw 'Unknown column key: ' + columnKey;  
  return columnIndex;
};

/**
@param {Array.<*>} cells
@return {Object.<string, *>}
*/
Recordset_.prototype.parseRow_ = function(cells) {
  var result = {};
  this.columnMap_.getKeys().forEach(function(key) {
    result[key] = cells[this.columnMap_.get(key)];
  }, this);
  return result;
};

/**
@param {number} index
@return {Object.<string, *>}
*/
Recordset_.prototype.getRecord = function(index) {
  var cells = this.range_.offset(index, 0, 1).getValues()[0];
  return this.parseRow_(cells);
};

/**
@return {Array.<Object.<string, *>>}
*/
Recordset_.prototype.getAllRecords = function() {
  if (this.range_.getNumRows() == 0) return [];
  var values = this.range_.getValues();
  var result = [];
  for (var i = 0; i < values.length; ++i) {
    result.push(this.parseRow_(values[i]));
  }
  return result;
};

/**
@param {number} index
@param {Object.<string, *>} record
*/
Recordset_.prototype.setRecord = function(index, record) {
  this.setRecords(index, [record]);
};

/**
@param {number} index
@param {Array.<Object.<string, *>>} records
*/
Recordset_.prototype.setRecords = function(index, records) {
  var n = this.range_.getNumColumns();
  var rows = [];
  if (index < 0 || index + records.length > this.range_.getNumRows()) throw 'Illegal index: ' + index;
  records.forEach(function(record) {
    var row = new Array(n);
    for (var i = 0; i < n; ++i) row[i] = null;
    for (var key in record) {
      row[this.getColumnIndex_(key)] = record[key];
    }
    rows.push(row);
  }, this);
  this.range_.offset(index, 0, records.length).setValues(rows);
};

/**
@param {number} index
@param {Object.<string, *>} record
*/
Recordset_.prototype.updateRecord = function(index, record) {
  if (index < 0 || index + 1 > this.range_.getNumRows()) throw 'Illegal index: ' + index;
  for (var key in record) {
    this.range_.getCell(index + 1, this.getColumnIndex_(key) + 1).setValue(record[key]);
  }
};

/**
@param {number} index
@param {Array.<Object.<string, *>>} records
*/
Recordset_.prototype.updateRecords = function(index, records) {
  for (var i = 0; i < records.length; ++i) {
    this.updateRecord(index + i, records[i]);
  }
};

/**
@param {number} index
@param {Object.<string, *>} record
*/
Recordset_.prototype.insertRecord = function(index, record) {
  this.insertRecords(index, [record]);
};

/**
@param {number} index
@param {Array.<Object.<string, *>>} records
*/
Recordset_.prototype.insertRecords = function(index, records) {
  this.range_.getSheet().insertRowsBefore(this.range_.getRow() + index, records.length);
  this.setRecords(index, records);
  this.range_ = this.range_.offset(0, 0, this.range_.getNumRows() + records.length);
};

/**
@param {number} index
*/
Recordset_.prototype.removeRecord = function(index) {
  this.removeRecords(index, 1);
};

/**
@param {number} index
@param {number} count
*/
Recordset_.prototype.removeRecords = function(index, count) {
  throw 'Not implemented';
  // TODO: Handle case where there is no more row, or all rows are frozen.
  this.range_.getSheet().deleteRows(this.range_.getRow() + index, count);
  this.range_ = this.range_.offset(0, 0, this.range_.getNumRows() - count);
};

/**
@param {Array.<Object.<string, *>>} records
*/
Recordset_.prototype.replaceAllRecords = function(records) {
  throw 'Not implemented';
};
