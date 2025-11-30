var $M = $M || {};
$M.queue = {};

$M.queue.forEach2 = (arr1, arr2, fn, opt_obj) => {
  const n = Math.max(arr1.length, arr2.length);
  for (let i = 0; i < n; ++i) {
    fn.call(opt_obj, arr1[i], arr2[i]);
  }
}

var Pager = class {
  // Return the request for the next page, or null if there is no next page.
  // Note that request can be modified for efficiency reasons.
  getNextPageRequest(request, response) { throw new Error('Not implemented'); }

  // Return the merge of response into mergedResponse.
  // Note that response and mergedResponse can be modified for efficiency reasons.
  mergeResponseInto(response, mergedResponse) { throw new Error('Not implemented'); }
};

$M.batch.groupCallback = (response, index, group) => {
  group.responses[index] = response;
  --group.missingResponses;
  if (group.missingResponses === 0 && group.fn) group.fn.call(null, group.responses, ...group.args);
};

// A FIFO queue to run requests using the batch API and process response.
// Salient features include:
// * New requests can be pushed in the callback function for requests,
//   allowing recursive API calls.
// * Support for paging answers.
var Queue = class {

  // @param {string} batchUrl 
  // @param {number} batchSize
  // @param {object} opt_options  Same options as for batchRequest. 
  constructor(batchUrl, batchSize, opt_options) {
    this._batchUrl = batchUrl;
    this._entries = [];
    this._index = 0;
    this._nextPageEntries = [];
    this._batchSize = batchSize || 100;
    this._options = opt_options || {};
  }

  // Add a new request to the queue. The request will enventually be executed.
  // The callback function fn will be called with the response as first argument
  // and args as following arguments.
  push(request, fn, ...args) { this._entries.push({ request, fn, args }); }

  // Add several requests to the queue. When *all* requests of the group will
  // have been executed, fn will be called with the array of responses as first
  // argument and args as following arguments.
  // Note this is a pure convenience function, it could be implemented outside
  // of the class.
  pushGroup(requests, fn, ...args) {
    const group = {
      missingResponses: requests.length,
      responses: Array(requests.length).fill(null),
      fn, args
    };
    requests.forEach((request, index) => {
      this.push(request, $M.batch.groupCallback, index, group);
    });
  }

  // Push an entry to get the next page of a response. These entries are prioritized.
  _pushNextPage(entry) { this._nextPageEntries.push(entry); }

  // Pop the next batch of entries to run.
  _popBatch() {
    if (this._nextPageEntries.length > 0) {
      this._entries.splice(this._index, 0, ... this._nextPageEntries);
      this._nextPageEntries.length = 0;
    }
    const startIndex = this._index;
    this._index = Math.min(this._entries.length, startIndex + this._batchSize);
    return this._entries.slice(startIndex, this._index);
  }

  _isNotDone() {
    return this._index < this._entries.length || this._nextPageEntries.length > 0;
  }

  // Run all requests in the queue until the queue is empty.
  run() {
    while (this._isNotDone()) {
      const entries = this._popBatch();
      const responses = batchRequest(this._batchUrl, entries.map(entry => entry.request), this._options);
      $M.queue.forEach2(entries, responses, (entry, response) => {
        if (entry.pager) {
          if (entry.pager.hasNextPage(entry, response)) {
            this._pushNextPage(entry);
            return;
          } else {
            response = entry.mergedResponse;
          }
        }
        entry.fn?.call(null, response, ...entry.args);
      });
    }
  }

};
