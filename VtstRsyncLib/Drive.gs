var $M = $M || {};
$M.drive = {};

// ********************************************************************************
// Utilities

$M.drive.FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
$M.drive.isFolder = (file) => (file.mimeType === $M.drive.FOLDER_MIME_TYPE);

$M.drive.BATCH_URL = 'https://www.googleapis.com/batch/drive/v3';
$M.drive.BATCH_SIZE = 50;
$M.drive.PAGE_SIZE = 100;
$M.drive.FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// ********************************************************************************
// Batch request handling

$M.drive.newBatchRequestQueue = () => {
  return new VtstBatchHttpRequestsLib.Queue($M.drive.BATCH_URL, $M.drive.BATCH_SIZE, {
    returnOnlyJson: true,
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    }
  });
};

$M.drive.Pager = class extends VtstBatchHttpRequestsLib.Pager {

  getNextPageRequest(request, response) {
    if (response.nextPageToken) {
      request.params.pageToken = response.nextPageToken;
      return request;
    }
  }

  mergeResponseInto(response, mergedResponse) {
    for (const key of mergedResponse) {
      const mergedValue = mergedResponse[key];
      const value = response[key];
      if (value) {
        if (Array.isArray(value) && Array.isArray(mergedValue)) {
          mergedValue.push(...value);
          response[key] = mergedValue;
        }
      } else {
        response[key] = mergedValue;
      }
    }
    return response;
  }

};

$M.drive.PAGER = new $M.drive.Pager;

// ********************************************************************************
// Requests

$M.drive.FILE_FIELDS = 'id,name,parents,size,modifiedTime,mimeType,trashed';

$M.drive.getFileRequest = (fileId) => ({
  method: 'GET',
  path: '/drive/v3/files/' + fileId,
  params: {
    fields: $M.drive.FILE_FIELDS,
    supportsAllDrives: true
  },
  fileId: fileId
});

$M.drive.getChildrenRequest = (fileId) => ({
  method: 'GET',
  path: '/drive/v3/files',
  params: {
    q: `'${fileId}' in parents and trashed = false`,
    fields: `nextPageToken,files(${$M.drive.FILE_FIELDS})`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: $M.drive.PAGE_SIZE
  },
  fileId: fileId,
  pager: $M.drive.PAGER
});

$M.drive.removeFileRequest = (fileId) => {
  return {
    method: 'PATCH',
    path: '/drive/v3/files/' + fileId,
    params: {
      supportsAllDrives: true,
      fields: 'id'
    },
    body: {
      trashed: true
    }
  };
};

$M.drive.renameFileRequest = (fileId, newName) => {
  return {
    method: 'PATCH',
    path: '/drive/v3/files/' + fileId,
    params: {
      supportsAllDrives: true,
      fields: 'id',
    },
    body: {
      name: newName
    }
  };
};

$M.drive.copyFileRequest = (sourceFile, targetParentId) => {
  return {
    method: 'POST',
    path: '/drive/v3/files/' + sourceFile.id + '/copy',
    params: {
      supportsAllDrives: true,
      fields: 'id'
    },
    body: {
      parents: [targetParentId],
      name: sourceFile.name,
      modifiedTime: sourceFile.modifiedTime
    }
  };
};

$M.drive.createFolderRequest = (targetParentId, name) => {
  return {
    method: 'POST',
    path: '/drive/v3/files',
    params: {
      supportsAllDrives: true,
      fields: 'id'
    },
    body: {
      name: name,
      mimeType: $M.drive.FOLDER_MIME_TYPE,
      parents: [targetParentId]
    }
  };
};

