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

## API Reference

To be written.

## Known Limitations

* Scanning of directories will fail if some folders are deleted during the process.
