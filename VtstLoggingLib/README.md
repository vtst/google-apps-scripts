# VtstLoggingLibgingLib

A simple and easy-to-use logging utility for Google Apps Script projects, designed to provide enhanced logging capabilities beyond `Logger.log()`.

## Features

*   **Multiple Log Levels**: Support for `DEBUG`, `INFO`, `WARN`, `ERROR`.
*   **Contextual Logging**: Easily add contextual information to your log messages.
*   **Simple API**: Designed for quick integration and use in any Apps Script project.

## Installation

To use the Library in your Google Apps Script project:

1. [Create](https://developers.google.com/apps-script/guides/projects#create-standalone) a new Google Apps Script project, or open an existing one.
2. [Add the library](https://developers.google.com/apps-script/guides/libraries#add_a_library_to_your_script_project) to your project using the following Library ID:  
   `1xPfojBL_kDhtj6DCmWpLPLEUOJRqWPRXph9Ni0owjjSH_4Ii1SyS1zRt`. Be sure to select the latest version.

## Usage

Here's how to get started with the library:

### Basic Logging

```javascript
function myFunction() {
  const logger = new VtstLoggingLib.ConsoleLogger({level: VtstLoggingLib.LogLevel.WARNING});

  logger.info('This is an informational message.');
  logger.warn('Something unexpected happened.');
  logger.error('An error occurred!', new Error('Example error'));
  logger.debug('Debugging information.');
}
```
