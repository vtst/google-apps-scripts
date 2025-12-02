/**
Run a synchronization job.
@param {Array.<{
    sourceId: string,
    targetId: string,
    name: string
  }>} syncEntries  The list of synchronization entries to run. For a single one, you can omit the array.
@param{{
  rename: boolean,  // rename files in targets when they are to be replaced by a folder rather than deleting
                    // them, and similarly for folders replaced by files
  remove: boolean,  // delete files and folders in target that do not exist in source
  logging.level: string,  // error, warning or info
  dryRun: boolean,  // run the diff but does not perform changes.
  verbose: boolean,  // include all nodes of the file tree, including intermediate nodes and nodes with no changes.
  corpora: string,  // see https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
  driveId: string
}}
*/
function sync(syncEntries, options) {
  $M.sync.sync(Array.isArray(syncEntries) ? syncEntries : [syncEntries], options);
}