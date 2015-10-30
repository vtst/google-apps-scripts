# VtstTemplatingLib

A Google Apps Script library for templating files in Google Drive.

© Vincent Simonet, 2015.

* * *

## Overview

This library allows to instantiate files and folders in Google Drive
with variables. For instance, you can create a Google Document for a
letter, and put the string '{{first_name}}' as a place holder for the
first name of the recipient of the letter. This library will be able
to programatically copy this document and replace {{first_name}} by
the actual first name you specify.

The current version of the library can instantiate any hierarchy of
files and folders in Google Drive. Variables (of the form {{name}})
are substituted in:

* file and folder names,
* Google Documents,
* Google Forms.

In addition, links in Google Documents that point to files of the
template are updated to point to files of the instance.

## How to use in your project?

You may add the library in your Google Apps Script project following
the procedure described here. The library project key is
`My93PhalcS_uZ9RkDLiXns_YB2d3K7A2c`. You should select the latest
available version.

## Tutorial

First, create a folder in Google Drive containing documents. You may
include variables like {{foo}} and {{bar}} in the names of the
folder and files as well as in the body of documents.

Then, you can call the method instantiate:

    var templateFolder = DriveApp.getFolderById(...); 
    var view = {
      first_name: 'Vincent',
      last_name: 'Simonet'
    };
    var cloner = VtstTemplatingLib.instantiate(view, templateFolder);
    cloner.getInstance(templateFolder);

## Reference

    instantiate(view, source, destination)

* `view`: a JavaScript dictionary, mapping variable names to values.
* `source`: a file or folder.
* `destination` (optional): the folder in which the instantiated file
  or folder should be stored. If no destination is specified, the
  instantiated file or folder is store in your root folder.

  This method returns a DriveCloner object, which allows to access the
  instantiated folders and files.

 

    DriveCloner.getInstance(file or folder or fileId or folderId)

## License

This library is distributed under the terms of the GNU LGPL, version 2.1.
