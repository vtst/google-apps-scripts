# VtstRsyncLib

A Google Apps Script library designed to provide `rsync`-like functionality for Google Drive.

## Features (Planned/Conceptual)

*   **Efficient Synchronization**: Minimize data transfer by only copying changed or new files.
*   **Directory Traversal**: Recursively process folders and their contents.
*   **File Hashing/Metadata Comparison**: Determine changes based on content hashes, modification times, or other metadata.
*   **Dry Run Mode**: Simulate synchronization without making actual changes.
*   **Error Handling and Logging**: Robust error management and detailed logging of operations.
*   **Flexible Filters**: Include/exclude files based on patterns or criteria.

## Installation

To use the Library in your Google Apps Script project:

1. [Create](https://developers.google.com/apps-script/guides/projects#create-standalone) a new Google Apps Script project, or open an existing one.
2. [Add the library](https://developers.google.com/apps-script/guides/libraries#add_a_library_to_your_script_project) to your project using the following Library ID:  
   `1niG3vaGornVFn8kE9hqKg9sbf9FlcECCDsWo2i_cPzwnGAGt-xJE8UOO`. Be sure to select the latest version.

## Scopes

The library needs the following scopes:
* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/script.external_request`

## API Reference

### Methods

```javascript
VtstRsyncLib.syncFolders(sourceFolderId, targetFolderId, options)
```

This method synchronizes the contents of a source folder to a target folder.

***Parameters***:
*   `sourceFolderId`: The ID of the source folder.
*   `targetFolderId`: The ID of the target folder.
*   `options`: An object containing additional options (see [Options](#options)below).

```javascript
VtstRsyncLib.multipleSyncFolders(syncPairs, options)
```

This method synchronizes the contents of multiple source folders to their corresponding target folders.

***Parameters***:
* `syncPairs`: An array of objects, each containing `sourceFolderId` and `targetFolderId` properties.
* `options`: An object containing additional options (see [Options](#options) below).

### Options

The `options` argument is an object with the following properties:

| Name          | Type           | Default Value | Description                                                                                                                              |
| :------------ | :------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `dryRun`      | `boolean`      | `false`       | If `true`, runs the diff but does not perform any changes.                                                                               |
| `rename`      | `boolean`      | `false`       | If `true`, renames files in targets when they are to be replaced by a folder, and similarly for folders replaced by files, instead of deleting them. |
| `delete`      | `boolean`      | `false`       | If `true`, deletes files and folders in the target that do not exist in the source.                                                      |
| `logging.level` | `string`       | `"info"`      | Controls the logging verbosity. Possible values: `"error"`, `"warning"`, `"info"`.                                                        |
| `muteExceptions` | `boolean`      | `false`       | If `true`, prevents throwing an error at the end of the sync if it's not complete. In this case, the function returns the number of errors. |
| `useBatchApi` | `boolean`      | `true`        | If `true`, uses the batch API of Google Drive (recommended as faster and more reliable).                                                 |

### Google Drive API

The library uses the Google Drive API to perform the synchronization. It can call the API in two different ways:
* Using the [Advanced Drive Service](https://developers.google.com/apps-script/advanced/drive) for Google Apps Script (when the option `useBatchApi` is `false`), or
* Calling directly the Google Drive v3 API using the [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app) service (when the option `useBatchApi` is `true`).

The second option is recommended as it is faster and more reliable. However, it requires the scope `https://www.googleapis.com/auth/script.external_request` to be added to the manifest file (`appsscript.json`) with the following `urlFetchWhitelist`:

```json
{
  ...
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "urlFetchWhitelist": [
    "https://www.googleapis.com/batch/drive/v3"
  ]
}
```

## Known Limitations

* Scanning of directories will fail if some folders are deleted during the process.
