# Realtime Progress Library for Google Apps Script

A lightweight library that provides real-time progress reporting capabilities for Google Apps Script projects. This library allows you to show progress updates to users during long-running operations. It can be used either directly from a backend script (.gs) for simple use cases, or integrated in large user interfaces defined in HTML files.

## Overview

The Realtime Progress Library enables you to run an arbitrary Google Apps Script function while showing progress to the user in a modal dialog with customized messages.

As there is no built-in support for communication between the frontend and the backend in Google Apps Script, the library uses the Properties Service to create an asynchronous
(and somehow slow) communication channel.

## Usage

### Adding the Library to Your Google Apps Script Project

1. [Create](https://developers.google.com/apps-script/guides/projects#create-standalone) a new Google Apps Script project, or open an existing one.
2. [Add the library](https://developers.google.com/apps-script/guides/libraries#add_a_library_to_your_script_project) to your project using the following Library ID:  
   `1DDJBuj2QOtYRrlJ4-o0Z-E6Yw-A0TsEBKA_b5WnVPZQycN_EBr463kiA`. Pick the latest version (currently version 3).
3. Add the following function to any `.gs` file in your project:

```javascript
function vtstRealtimeProgressLibCallback() { return VtstRealtimeProgressLib.callback.apply(globalThis, arguments); }
```

This function acts as a bridge, allowing your frontend code to invoke backend functions from the library. 
It must be present in your project, as frontend code cannot directly call library functions.

### OAuth Scopes

The library requires the scope `https://www.googleapis.com/auth/script.container.ui` to run. You need to add it to your manifest file (`appsscript.json`) if you specify the
scopes manually. The library also needs one of the following scopes, which you should already have:
* ` https://www.googleapis.com/auth/documents.currentonly`
* ` https://www.googleapis.com/auth/documents`
* ` https://www.googleapis.com/auth/spreadsheets.currentonly`
* ` https://www.googleapis.com/auth/spreadsheets`

### Method 1: Using the Library Directly in Backend Code

For backend operations that don’t require a custom user interface, you can use the Realtime Progress Library directly from your backend script.

Begin by defining a **top-level** function to encapsulate your long-running operation. This function must be defined at the top level so it can be referenced by its name (as a string) and called from the frontend. Its first parameter should be a _reporter_ object, which you use to send real-time progress messages. You may define any additional parameters needed for your operation. The function should return a string to be shown in the UI upon successful completion, and can throw exceptions if errors occur—these will be displayed to the user as well.

For more complex jobs, you can further modularize your code by calling helper functions from within your top-level function, passing along the reporter object as needed to continue progress updates throughout the process.

```javascript
function myLongRunningFunction(reporter, param1, param2, ..., paramN) {
  reporter.send("Starting process...");
  // Perform some operations here.
  reporter.send("Processing data...");
  // More computation...
  reporter.send("Almost done...");
  // ...
  return "Operation completed successfully";
}
```

To initiate your long-running job, call `VtstRealtimeProgressLib.runWithProgressDialog` and provide:
* An options object. For basic use, this can simply be `{}`. See the “Options” section below for details on available options.
* The name of your top-level function, as a string.
* Any desired arguments to pass to your function.

Example:

```javascript
function runMyOperation() {
  const options = {};
  VtstRealtimeProgressLib.runWithProgressDialog(options, 'myLongRunningFunction', param1, param2, ..., paramN);
}
```

### Method 2: Using the Library in Front-End (HTML/JavaScript) Code

If you want more control over the user interface or wish to integrate real-time progress reporting with a custom HTML UI, you can use this library directly from JavaScript code in your HTML file.

You are free to design your HTML as you like. However, to use the progress component, you must:
* Add an empty `<div>` element that will serve as the container for the progress UI, and
* Insert a special template tag at the end of the `<body>` to include the library’s frontend component.

Example HTML:

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
  </head>
  <body>
    <div id="progress-container"></div>
    <button onclick="startCustomProgress()">Start Operation</button>
    <button id="close-button" onclick="google.script.host.close()" disabled>Close</button>
  
    <?!= VtstRealtimeProgressLib.includeProgressComponent() ?>
  </body>
</html>
```

> 💡 **Tip:** The `<?!= ... ?>` tag injects the required JavaScript and HTML for the progress component into your UI. Place it just before the closing `</body>` tag.


To trigger a backend function and show real-time progress, use the provided `vrpl.run` object in your frontend JS code. This API works similarly to [`google.script.run`](https://developers.google.com/apps-script/guides/html/reference#google.script.run), but enables progress reporting.

Example usage:

```javascript
// In your HTML file
function startCustomProgress() {
  const options = {};

  // Optionally, you can define handlers for success or failure
  const enableClose = () => { document.getElementById('close-button').disabled = false; };

  vrpl.run
    .inElement('progress-container')
    .withOptions(options)
    .withSuccessHandler(() => { document.getElementById('close-button).disabled = false; })
    .withFailureHandler(() => { document.getElementById('close-button).disabled = false; })
    .myLongRunningFunction(param1, param2, ..., paramn);
}
```

In this example:
- `myLongRunningFunction` is a backend Apps Script function, which must take a `reporter` object as its first argument, followed by any parameters (e.g. `param1`, `param2`, etc.).  
- The backend function is written in the same way as described in *Method 1* above.  
- The return value of your backend function (if any) will be passed to your success handler.

The `vrpl.run` object supports a chainable API with four methods:
* `.inElement(element)` — Specify the HTML element to contain the progress UI. You may pass a string (ID) or an actual Element.
* `.withOptions(options)` — Provide custom options (see the [Options section](#options) below).
* `.withSuccessHandler(fn)` — Set a callback for successful completion (like `google.script.run.withSuccessHandler`).
* `.withFailureHandler(fn)` — Set a callback for failure (like `google.script.run.withFailureHandler`).

The callback functions for `.withSuccessHandler` and `.withFailureHandler` receive two arguments:
* The return value from `myLongRunningFunction` (or the exception message, in case of failure)—just like with `google.script.run`,
* A `runner` object, which lets you call `runner.update(title, message)` within your callback if you want to modify the progress messages shown to the user.

## Options

You can customize the library’s behavior by passing an `options` object, either from the backend or the frontend. The following table describes the available options:

| Option           | Type    | Default                                         | Description                                                                                  |
|------------------|---------|-------------------------------------------------|----------------------------------------------------------------------------------------------|
| `pullInterval`   | number  | 1000                                            | How often (in ms) the frontend polls for progress updates. Set to `0` to disable polling.    |
| `pushInterval`   | number  | 1000                                            | Minimum interval (in ms) between updates written to Properties Service. Set to `0` to disable pushing. |
| `progressTitle`  | string  | "Work in progress"                              | Title displayed while the operation is in progress.                                          |
| `errorTitle`     | string  | "Oups! An error happened :("                    | Title shown if an error occurs.                                                              |
| `successTitle`   | string  | "Successfully completed"                        | Title displayed upon successful completion.                                                  |
| `successMessage` | string  | "Click on the 'Close' button below to continue."| Message shown on success (if the backend function does not return a string).                 |
| `closeOnSuccess` | boolean | false                                           | If `true`, the dialog will automatically close on success.                                   |
| `callbackName`   | string  | "vtstRealtimeProgressLibCallback"               | Name of the callback function (typically left as default; rarely needs to be changed).       |

These options let you tailor the progress UI and operation flow to suit your needs.

## Full Example

You can see a full example using the library in [this Google Document](https://docs.google.com/document/d/1fL8-I1uMZNYYOO3BtbjdWYqjfAKYe3EaIbvfRyPWYnU/edit?tab=t.0).
The code of the Apps Script project attached to this document is available in the example subdirectory of this repository.


## Known Limitations

1. **Properties Service Quotas**: The library uses Google Apps Script's Properties Service for communication. There is a [quota](https://developers.google.com/apps-script/guides/services/quotas) of 50,000 read/writes per day (500,000 for Google Workspace accounts.)

2. **Latency**: The communication channel established with the property service has some latency, which can be somehow irregular. This makes the progress reporting
relevant for jobs that take 10 seconds or more, but not very relevant for shorter jobs.

3. **Error Handling**: If your backend function throws an unhandled exception, the progress will show an error state, but the specific error message may be limited.

4. **Browser Compatibility**: The frontend components use modern JavaScript features and may not work in older browsers.

## License

This project released under the MIT license. Please check the license file for details.
