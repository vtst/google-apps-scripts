# Addon Trigger Library for Google Apps Script

A Google Apps Script library for managing time-based triggers in Google Workspace addons with advanced scheduling capabilities.

## Overview

In editor add-ons for Google Docs and Google Sheets, time-based triggers are normally attached to the *script* itself, even though it is often preferable to associate them with individual *documents* or *spreadsheets*. This library provides a solution to that limitation by enabling document-specific scheduling and management.

The main approach is as follows:
* Each trigger's configuration is stored as a *document property*, along with the email address of the user who owns the trigger.
* The trigger configuration is also stored as a *user property*—a property unique to a given script and user combination, but shared across all documents and spreadsheets using the script. This user property is a dictionary indexed by document ID, allowing it to manage trigger settings for multiple files per user.
* Only a single time-based trigger is actually created per user. This trigger is responsible for handling all configured documents and spreadsheets for that user.

This design ensures efficient scheduling, flexible configuration per file, and proper association of triggers with the intended documents or spreadsheets.

## Usage

### Adding the Library to Your Google Apps Script Project

1. [Create](https://developers.google.com/apps-script/guides/projects#create-standalone) a new Google Apps Script project, or open an existing one.
2. [Add the library](https://developers.google.com/apps-script/guides/libraries#add_a_library_to_your_script_project) to your project using the following Library ID:  
   `1lKIhGvHszbKcvFJsusmo0uN4muAYpoUW9HTJFODy132Znr0jVVBkrr3g`. Be sure to select the latest version (currently version 4).

### OAuth Scopes

This library requires certain OAuth scopes to function correctly. If you manually specify scopes in your `appsscript.json` manifest, ensure you include the following:
* `https://www.googleapis.com/auth/script.scriptapp`
* `https://www.googleapis.com/auth/userinfo.email`

To setup the trigger, the library requires access to at least one of these scopes, depending on whether your add-on is for Google Docs or Google Sheets:
* `https://www.googleapis.com/auth/documents`
* `https://www.googleapis.com/auth/documents.currentonly`
* `https://www.googleapis.com/auth/spreadsheets`
* `https://www.googleapis.com/auth/spreadsheets.currentonly`

Finally, you must ensure that your manifest includes any additional OAuth scopes required by your trigger code. If your trigger needs to access or modify a document or spreadsheet, you have a few possible approaches:

* **Full Document or Spreadsheet Access:**  
  Use the scope `https://www.googleapis.com/auth/documents` (for Docs) or `https://www.googleapis.com/auth/spreadsheets` (for Sheets). This allows your trigger code to directly open files using `DocumentApp.openById()` or `SpreadsheetApp.openById()`. This is the simplest approach for development and internal use. However, when publishing your add-on to the Google Workspace Marketplace, these broad scopes may be rejected in favor of tighter permission policies, so this method is generally only suitable for private or unlisted add-ons.

* **Granular File Access via Drive Picker:**  
  For public add-ons, a recommended alternative is to use the `https://www.googleapis.com/auth/drive.file` scope in combination with the [Google Picker](https://developers.google.com/workspace/drive/api/guides/picker). This allows users to explicitly grant your add-on access only to selected files. Note that with this approach you cannot use `DocumentApp` or `SpreadsheetApp` to open the files. Instead, you should use the advanced [Docs](https://developers.google.com/apps-script/advanced/docs) and [Sheets](https://developers.google.com/apps-script/advanced/sheets) services, which work with files authorized by the user via the Drive Picker.

* **Fetching File Content Directly:**  
  If your use-case only requires reading the file content (for example, reading a document as plain text or a spreadsheet as a CSV), you can use the [`UrlFetchApp`](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app) service to download the file directly—again, provided the user has granted access via the Drive Picker.

Choose the approach that best aligns with your add-on's publishing goals and security requirements.

### Usage Example

Below is a sample illustrating how to use the Addon Trigger Library in your Google Apps Script project.

#### Configuring Triggers

```javascript
// Create a trigger to run every 2 hours
function setupHourlyTrigger() {
  const config = {
    scheduling: {
      everyHours: 2
    },
    settings: {
      // Add any custom settings you want to persist with the trigger, for example:
      notificationEnabled: true,
      backupLocation: 'Drive'
    }
  };
  
  // For a Google Docs add-on:
  AddonTriggerLib.setConfigForActiveDocument(config);

  // For a Google Sheets add-on, use:
  // AddonTriggerLib.setConfigForActiveSpreadsheet(config);
}
```

The `settings` property is a custom object you can define to store any relevant configuration to accompany your trigger. This object is saved with the trigger and passed as an argument to your trigger function, allowing you to customize its runtime behavior based on user preferences or contextual settings.

You can also retrieve the trigger configuration for the current document or spreadsheet by using `AddonTriggerLib.getConfigForActiveDocument()` or `AddonTriggerLib.getConfigForActiveSpreadsheet()`. Both functions return the original configuration object (as passed to `setConfig...` methods) plus an additional `userEmail` property, which identifies the user who created the trigger. This can be useful to avoid duplicate triggers or show ownership information:

```javascript
const config = AddonTriggerLib.getConfigForActiveDocument();
if (config && config.userEmail !== Session.getActiveUser().getEmail()) {
  throw 'Trigger already defined by ' + config.userEmail;
}
```

#### Writing the Trigger Function

Your trigger handler function should be named `managedAddonTriggerFunction` by default. (You can customize this name using the [global configuration options](#global-configuration-options) if desired.) This function is automatically invoked by the Addon Trigger Library and receives two arguments:

* `docId`: The ID of the Google Document or Spreadsheet the trigger is running for.
* `settings`: The custom settings object you previously passed to `AddonTriggerLib.setConfigForActiveDocument` (or `setConfigForActiveSpreadsheet`).

A typical trigger function looks like:

```javascript
function managedAddonTriggerFunction(docId, settings) {
  const doc = DocumentApp.openById(docId);
  // Your trigger logic goes here
}
```

You can now implement any operations you want to be performed when the trigger fires. The `settings` parameter allows you to tailor the behavior based on the user-configured options you saved earlier.


### Trigger Configuration Options

The trigger configuration object supports the following properties:

- **`scheduling`** (object): Specifies when the trigger should run.
  - `everyHours` (number): Run every N hours. Must be a positive integer.
  - `everyDays` (number): Run every N days. Must be a positive integer.
  - `atHour` (number): Specific hour to run (0–23). Only valid when used with `everyDays`.
- **`settings`** (object): Custom settings that are passed to your trigger function.

**Rules for `scheduling` properties:**

- You must specify either `everyHours` or `everyDays`.
- `atHour` is only applicable when using `everyDays`.
- Multiple documents can share a single trigger through optimized scheduling. The library automatically computes the greatest common divisor (GCD) to manage triggers efficiently.

### Global Configuration Options

The library defines a global configuration object with the following default values:

```javascript
{
  user_property_key: 'user:TriggerManager:Config',
  document_property_key: 'script:TriggerManager:Config',
  triggerFunctionName: 'managedAddonTriggerFunction'
}
```

You can override these defaults by calling `VtstAddonTriggerLib.setConfig` at the top level of your script. For example:

```javascript
VtstAddonTriggerLib.setConfig({
  triggerFunctionName: 'myCustomTriggerFunction'
});
```

This lets you customize the property keys used to store trigger configurations, as well as the name of the trigger function the library will invoke.

### Error Handling

If an error occurs during the execution of a trigger for a particular document or spreadsheet:
* The error will be recorded in the error log.
* Trigger execution will continue for the remaining documents or spreadsheets.

### Dialog for showing triggers

The library provides a dialog to show a list of the documents on which the trigger is installed by the current user. This dialog is especially useful to clean up the configuration of deleted documents.

Here is a code snippet for displaying the dialog:

```javascript
function vtstAddonTriggerLibCallback() { return VtstAddonTriggerLib.callback.apply(globalThis, arguments); }
function showTriggerConfigDialog() {
  VtstAddonTriggerLib.showTriggersDialog('Your custom title (optional)');
}
```

## Limitations

Please note the following limitations of this approach:
* Only the user who created a trigger for a given document or spreadsheet can modify its configuration. The library prevents multiple users from setting triggers on the same document or spreadsheet, as this could cause inconsistent behavior.
* All triggers configured by a single user for a given add-on are executed within a single Apps Script trigger. As a result, the combined execution time for all these triggers is limited by the maximum allowed duration for one trigger event.
* The trigger function accesses documents or spreadsheets using `DocumentApp.openById` or `SpreadsheetApp.openById`, requiring the full `documents` or `spreadsheets` authorization scopes. The more restricted `documents.currentonly` and `spreadsheets.currentonly` scopes—typically used in editor add-ons—are not sufficient. However, this has not posed problems for add-on publication on the Google Workspace Marketplace.
* Triggers are scheduled based on the script's time zone, as specified in `appsscript.json`.
* The library supports only hourly and daily scheduling frequencies; other intervals are not supported.

## License

This project released under the MIT license. Please check the license file for details.
