const http = require('node:http');
const crypto = require('node:crypto');

const originalEmit = http.Server.prototype.emit;

http.Server.prototype.emit = function (type, req, res) {
  if (type === 'request') {
    let correlationId = req.headers['x-correlation-id'];

    if (!correlationId) {
      correlationId = crypto.randomUUID();
      req.headers['x-correlation-id'] = correlationId;
    }

    // Set the cloud trace context so AFFiNE's native request ID extractor uses it
    req.headers['x-cloud-trace-context'] = correlationId;

    // Ensure the correlation ID is returned in the response
    res.setHeader('X-Correlation-ID', correlationId);
  }

  return originalEmit.apply(this, arguments);
};
