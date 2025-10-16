# VtstDrivePickerGrantLib

Easily prompt users to grant access to files in Google Drive.

## Overview

When using the [`drive.file`](https://developers.google.com/workspace/drive/api/guides/api-specific-auth#benefits) OAuth scope in Google Apps Script applications or add-ons, it is required to
prompt the user to explicitely grant access to each file or folder the script needs to access. This library
provides a ready to use way to do this.

## Usage

### Adding the Library to Your Google Apps Script Project

1. [Create](https://developers.google.com/apps-script/guides/projects#create-standalone) a new Google Apps Script project, or open an existing one.
2. [Add the library](https://developers.google.com/apps-script/guides/libraries#add_a_library_to_your_script_project) to your project using the following Library ID:  
   `1Igag6GkWHNos3HX-Rqb4zOMK0k4zqj-wvSwhOp_-rjBkScSsXJU0nn0h`. Be sure to select the latest version (currently version 3).

### Configure your Google Apps Script project

* Create a [standard Google Cloud projet](https://developers.google.com/apps-script/guides/cloud-platform-projects#standard) for your Google Apps Script project.
* Enable the Google Drive API in this Cloud project.
* Note the numeric ID of the Google Cloud project, it will be used as "application ID" later.
* Make sure your Google Apps Script project has the OAuth scope `https://www.googleapis.com/auth/drive.file` in
its manifest.

### Usage from backend code

```javascript

function grantAccessToFiles() {
  const fileIds = ['...'];
  VtstDrivePickerGrantLib.grantFileAccess(
    globalThis,
    {appId: '...'},
    fileIds,
    'grantAccessToFilesContinuation',
    'arg1', 'arg2'
  );
}

function grantAccessToFilesContinuation(remainingFileIds, arg1, arg2) {
  if (remainingFileIds.length === 0) {
    // Code to execute if access to all files was granted
  } else {
    // Code to execute if access to some files was not granted
  }
}
```

### Usage from frontend code

```html
<script type="application/javascript">
  async function grantAccess() {
    const fileIds = ['...'];
    const remainingFileIds = await vdpg.grantAccessToFiles({appId: '...'}, fileIds);
    if (remainingFileIds.length === 0) {
      // Code to execute if access to all files was granted
    } else {
      // Code to execute if access to some files was not granted
    }
  }
</script>

<?!= VtstDrivePickerGrantLib.includeComponent() ?>
```
