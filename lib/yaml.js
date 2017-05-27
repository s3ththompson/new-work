const yaml = require('js-yaml');
const fs = require('fs');

module.exports = {
  read: read,
  write: write
};

function read(filename, cb) {
  fs.readFile(filename, 'utf8', (err, data) => {
    if (err) return cb(err, null);
    try {
      var obj = yaml.safeLoad(data);
      cb(null, obj);
    } catch (err) {
      cb(err, null);
    }
  });
}

function write(filename, data, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};

  var preamble = opts.preamble || '';

  try {
    var text = preamble + yaml.safeDump(data);
    fs.writeFile(filename, text, 'utf8', cb);
  } catch (err) {
    cb(err);
  }
}
