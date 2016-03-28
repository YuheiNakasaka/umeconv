var Promise = require('bluebird');
var config = require('config');
var crypto = require('crypto');
var request = require('request');
var fs = require('fs');
var child_process = require('child_process');

process.env.PATH = process.env.PATH + ':/tmp/:' + process.env.LAMBDA_TASK_ROOT;

function createHashPromise(params) {
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

function downloadImagePromise(params) {
  return new Promise(function(resolve, reject) {
    request
    .get(params.url)
    .on('error', function(err) {
      return new Promise.reject('404 not found');
    })
    .on('response', function(response) {
      console.log(response.statusCode);
    })
    .pipe(fs.createWriteStream(params.tmp_image_path, {"mode": 0777}))
    .on('finish', function() {
      resolve(params.tmp_image_path);
    });
  });
}

function createMp4Promise(params) {
  return new Promise(function(resolve, reject) {
    child_process.execFile(
      params.ffmpeg,
      [
        '-y',
        '-i', params.tmp_image_path,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        params.complete_path
      ],
      function(err, stdout, stderr) {
        console.log(err, stdout, stderr);
        resolve();
      }
    );
  });
}

function readMp4Promise(params) {
  return new Promise(function(resolve, reject) {
    fs.readFile(params.complete_path, function(err, data) {
      resolve(data);
    });
  });
}

function deleteFilesSync(params) {
  fs.unlinkSync(params.complete_path);
  fs.unlinkSync(params.tmp_image_path);
}

exports.handler = function (event, context) {
  var params = {};
  if(!event.queryParameters) event.queryParameters = {};
  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    params.ffmpeg = './bin/ffmpeg';
    params.url = event.queryParameters.url;
    params.hash_value = event.queryParameters.hval;
  } else {
    params.ffmpeg = 'ffmpeg';
    params.url = 'http://img2.gifmagazine.net/gifmagazine/images/693846/medium.gif';
    params.hash_value = '1NUohyZozMFMFE2q3qsMsSMHaZE=';
  }
  params.tmp_dir = 'tmp';
  params.tmp_image_path = config.get('Config.path.tmpImagePath');
  params.complete_path = config.get('Config.path.completePath');

  createHashPromise(params).then(function(hash) {
    // check hash
    console.log('Check hash');
    if (params.hash_value != hash) {
      return Promise.reject('400 invalid request');
    }
  }).then(function() {
    // download image
    console.log('Download image');
    return downloadImagePromise(params);
  }).then(function() {
    // create mp4 file from images
    console.log('Create mp4 file from images');
    return createMp4Promise(params);
  }).then(function() {
    // read mp4 data
    console.log('Read mp4 data');
    return readMp4Promise(params);
  }).then(function(movieData) {
    console.log('Remove files');
    deleteFilesSync(params);
    context.succeed(movieData);
  });
};
