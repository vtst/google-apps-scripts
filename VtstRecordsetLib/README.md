# VtstRecordsetLib

A Google Apps Script library for easily accessing contents of Google Spreadsheets as sets of records.

© Vincent Simonet, 2015.

* * *

## Overview

This library allows to access the contents of a sheet (or a range) in a Google Spreadsheet as a set of records.
Every row in the sheet represents a record.  Every record is represented by a JavaScript object (key/values).
Columns in the sheet are automaticaly mapped to object fields.

## How to use in your project?

You may add the library in your Google Apps Script project following the procedure described
[here](https://developers.google.com/apps-script/guide_libraries).  The library project key is
`MbnnZc09j8WUkQ35tumDhj_YB2d3K7A2c`.  You should select the latest available version.

## Tutorial

Let's assume you have the following sheet:

| First Name        | Age    | Gender |
|-------------------|--------|--------|
| Alice             | 5      | F      |
| Bob               | 7      | M      |
| Charlie           | 3      | M      |

You can create the recordset object as follows:

    var recordset = VtstTemplatingLib.createWithHeaderRow(sheet, {
        first_name: 'First Name',
        age: 'Age',
        gender: 'Gender'
    });

The passed dictionary maps the JavaScript field names to the column titles in the sheet.

You could also use an index based approach:

    var recordset = VtstTemplatingLib.create(sheet.FOO, {
        first_name: 0,
        age: 1,
        gender: 2
    });

Once the recordset object is created, you can use all its methods to easily access the records.
Record are identified by the 0-based numeric index.  For instance,

    recordset.getRecord(1);

will return the JavaScript object:

    {first_name: 'Bob', age: 7, gender: 'M'}

You can set a record as follows:

    recordset.setRecord(1, {first_name: 'Bobby', age: 8, gender: 'M'});

You also have update methods that modify only the value of the provided fields, and keep other fields unchanged:

    recordset.updateRecord(1, {age: 9});

Plural versions of the methods provide the same functionality on a series of record.  For instance, one may write:

    recordset.updateRecords(0, [{age: 6}, {age: 8}, {age: 4}])

to add one year to every person in the recordset.

## Reference

### Creators

    VtstRecordsetLib.createWithHeaderRow(sheet_or_range, column_titles)
    VtstRecordsetLib.create(sheet_or_range, column_indices)

### Object Recordset

    Recordset.getRecord(index)
    Recordset.getAllRecords()
    Recordset.setRecord(index, record)
    Recordset.setRecords(index, records)
    Recordset.updateRecord(index, record)
    Recordset.updateRecords(index, records)
    Recordset.insertRecord(index, record)
    Recordset.insertRecords(index, records)
    Recordset.removeRecord(index)
    Recordset.removeRecords(index, count)

## License

This library is distributed under the terms of the [GNU LGPL, version 2.1](http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html).