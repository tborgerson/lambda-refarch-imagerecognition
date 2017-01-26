// dependencies
const AWS = require('aws-sdk');
const gm = require('gm').subClass({imageMagick: true}); // Enable ImageMagick integration.
const util = require('util');

// constants
const MAX_WIDTH = 250;
const MAX_HEIGHT = 250;

// get reference to S3 client
const s3 = new AWS.S3();

exports.handler = (event, context, callback) => {
    const s3Bucket = event.eventData.s3Bucket;
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(event.eventData.s3Key.replace(/\+/g, " "));

    const getObjectPromise = s3.getObject({
        Bucket: s3Bucket,
        Key: srcKey
    }).promise();

    const size = event.eventData.size;
    const scalingFactor = Math.min(
        MAX_WIDTH / size.width,
        MAX_HEIGHT / size.height
    );
    const width = scalingFactor * size.width;
    const height = scalingFactor * size.height;

    var resizePromise = new Promise((resolve) => {
        getObjectPromise.then((getObjectResponse) => {
            gm(getObjectResponse.Body).resize(width, height).toBuffer(event.eventData.format, (err, buffer) => {
                if (err) {
                    callback(err);
                } else {
                    resolve(buffer);
                }
            });
        }).catch(function (err) {
            callback(err);
        });
    })

    const destKey = "Thumbnail/" + event.eventData.objectID;

    const s3PutParams = {
        Bucket: s3Bucket,
        Key: destKey,
        ContentType: "image/" + event.eventData.format.toLowerCase()
    };

    resizePromise.then(function (buffer) {
        s3PutParams.Body = buffer;
        s3.upload(s3PutParams).promise().then((data) => {
            event.eventData.thumbNailS3Key = destKey;
            callback(null, event);
        }).catch(function (err) {
            callback(err);
        })
    }).catch(function (err) {
        callback(err);
    })
}