# VtstRsyncLib

A Google Apps Script library designed to provide `rsync`-like functionality for Google Drive. It is implemented 
using the [Google Drive v3 API](https://developers.google.com/workspace/drive/api/reference/rest/v3)
with [batched requests](https://developers.google.com/drive/api/guides/batch) for maximum efficiency.

## Features

*   **Efficient Synchronization**: Minimize data transfer by only copying changed or new files.
*   **Directory Traversal**: Recursively process folders and their contents.
*   **File Hashing/Metadata Comparison**: Determine changes based on modified times (and mime types).
*   **Dry Run Mode**: Simulate synchronization without making actual changes.
*   **Error Handling and Logging**: Robust error management and detailed logging of operations.

## Installation

To use the Library in your Google Apps Script project:

1. [Create](https://developers.google.com/apps-script/guides/projects#create-standalone) a new Google Apps Script project, or open an existing one.
2. [Add the library](https://developers.google.com/apps-script/guides/libraries#add_a_library_to_your_script_project) to your project using the following Library ID:  
   `1niG3vaGornVFn8kE9hqKg9sbf9FlcECCDsWo2i_cPzwnGAGt-xJE8UOO`. Be sure to select the latest version.

## Scopes

The library needs the following scopes `https://www.googleapis.com/auth/script.external_request`.

Additionally, if the manifest file of your project specifies an URL fetch whitelist, you need to add the Google Drive API URL to the list. Here is an extract of manifest file:

```json
{
  ...
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "urlFetchWhitelist": [
    ...
    "https://www.googleapis.com/batch/drive/v3"
  ]
}
```


## API Reference

### Methods

```javascript
VtstRsyncLib.sync(syncEntries, options)
```

***Parameters***:
* `syncEntries`: An array of objects, each containing `sourceId` and `targetId` properties, and an optional `name` property:
  * `sourceId` is the ID of the source folder (or shared drive) to synchronize,
  * `targetId` is the ID of the target folder (or shared drive) to synchronize to,
  * `name` is the name of the sync entry, which is used for logging purposes.
  In the case you have a single syncEntry, you can omit the array and pass the syncEntry directly.
* `options`: An object containing additional options (see [Options](#options) below).

### Options

The `options` argument is an object with the following properties:

| Name          | Type           | Default Value | Description                                                                                                                              |
| :------------ | :------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `dryRun`      | `boolean`      | `false`       | If `true`, runs the diff but does not perform any changes.                                                                               |
| `rename`      | `boolean`      | `false`       | If `true`, renames files in targets when they are to be replaced by a folder, and similarly for folders replaced by files, instead of deleting them. |
| `delete`      | `boolean`      | `false`       | If `true`, deletes files and folders in the target that do not exist in the source.                                                      |
| `logging.level` | `string`       | `"info"`      | Controls the logging verbosity. Possible values: `"error"`, `"warning"`, `"info"`.                                                        |
| `verbose`     | `boolean`      | `false`       | If `true`, includes all nodes of the file tree, including intermediate nodes and nodes with no changes.                                   |
| `abortIfScanError` | `boolean`      | `false`       | If `true`, aborts sync for an entry if the full scan can't be performed. Otherwise, syncs what could be scanned.                          |
