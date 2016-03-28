var Promise = require('bluebird');
var config = require('config');
var crypto = require('crypto');
var request = require('request');
var fs = require('fs');
var im = require('imagemagick');
var child_process = require('child_process');
var util = require('util');

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

function splitImagePromise(params) {
  return new Promise(function(resolve, reject) {
    var fileDir = params.tmp_file_dir;
    if (!fs.existsSync) {
      fs.mkdirSync(fileDir);
    }
    var command = ['-coalesce', params.tmp_image_path, fileDir + "/%06d.jpg"];
    im.convert(command, function(err, stdout) {
      resolve(fileDir);
    });
  });
}

function getFpsPromise(params) {
  return new Promise(function(resolve, reject) {
    im.identify(["-format", "%T,", params.tmp_image_path], function(err, output) {
      delay = Number(output.split(',')[0]) || 10;
      params.fps = Math.round( (1/(delay/100)) );
      if (params.fps < 1) {
        params.fps = 10;
      }
      resolve();
    });
  });
}

function getFrameCountPromise(params) {
  return new Promise(function(resolve, reject) {
    fs.readdir(params.tmp_file_dir, function(err, items) {
      params.frameCount = items.length;
      resolve();
    });
  });
}

function getWidthPromise(params) {
  return new Promise(function(resolve, reject) {
    im.identify(["-format", "%w,", params.tmp_image_path], function(err, output) {
      tmpWidth = Number(output.split(',')[0]) || 500;
      params.width = (tmpWidth / 2) * 2;
      resolve();
    });
  });
}

function getHeightPromise(params) {
  return new Promise(function(resolve, reject) {
    im.identify(["-format", "%h,", params.tmp_image_path], function(err, output) {
      tmpHeight = Number(output.split(',')[0]) || 500;
      params.height = (tmpHeight / 2) * 2;
      resolve();
    });
  });
}

function createMp4Promise(params) {
  return new Promise(function(resolve, reject) {
    if (params.playbacktime < 3.0) {
      console.log("Playbacktime < 3.0");
      // increase frame files to increase playbacktime
      var loopCount = Math.round( (3.0 / params.playbacktime) );
      for (var i = 0;i < loopCount;i++) {
        var files = fs.readdirSync(params.tmp_file_dir);
        files.forEach(function(file) {
          zero_padding_num = Number(file.match(/(\d+)\.jpg/)[1])
          plus = params.frameCount * (i+1);
          fileDir = params.tmp_file_dir + '/';
          filePath = fileDir + ('000000'+(zero_padding_num + plus)).slice(-6) + '.jpg';
          fs.createReadStream(fileDir + file).pipe(fs.createWriteStream(filePath));
        });
      }

      child_process.execFile(
        params.ffmpeg,
        [
          '-r', params.fps,
          '-i', params.tmp_file_dir + '/%06d.jpg',
          '-vf', 'scale=' + params.width + ':' + params.height,
          '-vcodec', 'libx264',
          '-y', params.complete_path
        ],
        function(err, stdout, stderr) {
          resolve();
        }
      );

    } else if(params.playbacktime > 15.0) {
      console.log("Playbacktime > 15.0");
      child_process.execFile(
        params.ffmpeg,
        [
          '-r', (params.frameCount / 14.0),
          '-i', params.tmp_file_dir + '/%06d.jpg',
          '-vf', 'scale=' + params.width + ':' + params.height,
          '-vcodec', 'libx264',
          '-y', params.complete_path
        ],
        function(err, stdout, stderr) {
          resolve();
        }
      );
    } else {
      console.log("Playbacktime is during 3.0 and 15.0");
      child_process.execFile(
        params.ffmpeg,
        [
          '-r', params.fps,
          '-i', params.tmp_file_dir + '/%06d.jpg',
          '-vf', 'scale=' + params.width + ':' + params.height,
          '-vcodec', 'libx264',
          '-y', params.complete_path
        ],
        function(err, stdout, stderr) {
          resolve();
        }
      );
    }
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
  var files = fs.readdirSync(params.tmp_file_dir);
  for (var i = 0;i < files.length;i++) {
    fs.unlinkSync(params.tmp_file_dir + "/" + files[i]);
  }
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
  params.tmp_file_dir = config.get('Config.path.tmpFileDir');
  params.complete_path = config.get('Config.path.completePath');

  createHashPromise(params).then(function(hash) {
    // check hash
    if (params.hash_value != hash) {
      return Promise.reject('400 invalid request');
    }
  }).then(function() {
    // download image
    return downloadImagePromise(params);
  }).then(function() {
    // split image
    return splitImagePromise(params);
  }).then(function() {
    // get fps
    return getFpsPromise(params);
  }).then(function() {
    // get frame counts
    return getFrameCountPromise(params);
  }).then(function() {
    // get playbacktime
    params.playbacktime = (1/params.fps) * params.frameCount;
  }).then(function() {
    // get width
    return getWidthPromise(params);
  }).then(function() {
    // get height
    return getHeightPromise(params);
  }).then(function() {
    // create mp4 file from images
    return createMp4Promise(params);
  }).then(function() {
    // read mp4 data
    return readMp4Promise(params);
  }).then(function(movieData) {
    deleteFilesSync(params);
    context.succeed(movieData);
  }).catch(function(err) {
     context.succeed(err);
  });
};
