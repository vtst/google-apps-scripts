// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

// ********************************************************************************
// Interface ColumnMap_

/**
@interface
*/
function ColumnMap_() {};

/**
@param {string} key
@return {number}
*/
ColumnMap_.prototype.get;

/**
@return {Array.<string>}
*/
ColumnMap_.prototype.getKeys;

// ********************************************************************************
// Class ColumnTitleMap__

/**
@param {Range|null} range
@param {Object.<string, string|number>} columnTitles Dictionary mapping symbolic names to
  column titles or column indexes.
@private
*/
function ColumnTitleMap_(range, columnTitles) {
  this.map_ = this.buildMap_(range, columnTitles);
  this.keys_ = [];
  for (var key in columnTitles) this.keys_.push(key);
};

/**
@param {Range|null} range
@param {Object.<string, string|number>} columnTitles Dictionary mapping symbolic names to
  column titles or column indexes.
@private
*/
ColumnTitleMap_.prototype.buildMap_ = function(range, columnTitles) {
  if (range.getNumRows() != 1) throw 'Range is not a single row';
  var firstRowDict = {};
  if (range) {
    var firstRow = range.offset(0, 0, 1).getValues()[0];
    firstRow.forEach(function(columnTitle, index) {
      firstRowDict[columnTitle] = index;
    });
  }
  var map = {};
  for (var key in columnTitles) {
    var spec = columnTitles[key];
    if (typeof spec == 'number') {
      if (spec < 0 || spec >= firstRow.length) throw 'Invalid column index for key ' + key + ': ' + spec;
      map[key] = spec;
    } else if (typeof spec == 'string') {
      var columnIndex = firstRowDict[spec];
      if (columnIndex === undefined) throw 'Column title for key ' + key + ' not found: ' + spec;
      map[key] = columnIndex;
    } else {
      throw 'Invalid value for key ' + key + ': ' + spec;
    }
  }
  return map;
};

ColumnTitleMap_.prototype.get = function(key) {
  return this.map_[key];
};

ColumnTitleMap_.prototype.getKeys = function() {
  return this.keys_;
};
