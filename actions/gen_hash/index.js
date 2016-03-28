var Promise = require('bluebird');
var config = require('config');
var crypto = require('crypto');

function createHashPromise(params) {
  if (!params.url) return Promise.reject('404 not found');
  return new Promise(function(resolve, reject) {
    // prepare for hmac
    var hmac = crypto.createHmac(config.get('Config.crypto.digestAlgo'), config.get('Config.crypto.salt'));
    hmac.write(params.url);
    hmac.end();
    hmac.on('readable', function() {
      var data = hmac.read();
      if (data) {
        hash = data.toString('base64')
        resolve(hash);
      } else {
        reject();
      }
    });
  })
}

exports.handler = function (event, context) {
  var params = {};
  if(!event.queryParameters) event.queryParameters = {};
  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    params.url = event.queryParameters.url;
  } else {
    params.url = 'http://img2.gifmagazine.net/gifmagazine/images/693846/medium.gif';
  }

  createHashPromise(params).then(function(hash) {
    context.succeed({value: hash});
  }).catch(function(e) {
    context.succeed({value: e});
  });
};
