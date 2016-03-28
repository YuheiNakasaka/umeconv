# umeconv

This is a server written in nodejs to convert a gif animation to a movie data dynamically.

It uses aws lambda + api gateway.

If you request a url like **https://example.execute-api.us-east-1.amazonaws.com/production/gif_to_mp4?url=http://img.example.com/sample.gif&hval=VdpDJHCUuKX8VN1FO23zp4HpV4o=**, the gif animation is converted to mp4 file, and the server returns mp4 data as response.

## Requirements

- AWS account
- IAM role
- node
- fluct
- imagemagick
- ffmpeg

FFmpeg and Imagemagick create movie data from gif animation.

## Set up with package.json.sample

```
{
  "name": "umeconv",
  "private": true,
  "fluct": {
    "accountId": "my_account_id", // 0123456789
    "restapiId": null,
    "roleName": "my_iam_role_name", // lambda_basic_execution
  },
  "dependencies": {
    "bluebird": "3.3.4",
    "config": "^1.19.0",
    "imagemagick": "^0.1.3",
    "request": "^2.69.0"
  }
}
```

and rename package.json.sample to package.json

## Set up with config/default.json

```
{
  "Config": {
    "crypto": {
      "salt": "secret", // change your original salt
      "digestAlgo": "sha1"
    },
    "path": {
      "tmpImagePath": "/tmp/tmp.gif",
      "tmpFileDir": "/tmp/files",
      "completePath": "/tmp/complete.mp4"
    }
  }
}
```

## Install

```
npm install --save
```

## Start a local server

```
fluct server
```

## Request

[http://localhost:3000/gif_to_mp4](http://localhost:3000/gif_to_mp4)

generate mp4 data.

## Deploy

First, create config/production.json.

```
{
  "Config": {
    "crypto": {
      "salt": "your_production_secret",
      "digestAlgo": "sha1"
    },
    "path": {
      "tmpImagePath": "/tmp/tmp.gif",
      "tmpFileDir": "/tmp/files",
      "completePath": "/tmp/complete.mp4"
    }
  }
}
```

and deploy all.

```
fluct deploy
```

## Endpoint

### GET /gif_to_mp4

It returns mp4 data.

#### Params

- url
  - gif image url
- hval
  - set a value that created by /gen_hash

### GET /gif_to_mp4_insta

It returns mp4 data.

Playback time of the generated mp4 is during 3 seconds and 15 seconds.

It's a format to be able to upload to instagram.

#### Params

- url
  - gif image url
- hval
  - set a value that created by /gen_hash

### GET /gen_hash

generates a unique value from a given url.

This value is used as an identifier to confirm that the url is valid.

#### Params

- url
  - gif image url