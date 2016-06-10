const fs = require('fs');
const ProgressBar = require('progress');
const http = require('http');
const through2 = require('through2');

const destination = `${__dirname}/static/test-vid.mp4`;

try {
  fs.accessSync(destination);
  // already got the video
  process.exit();
} catch(e) {}

const out = fs.createWriteStream(destination);

const req = http.request({
  host: 'download.blender.org',
  port: 80,
  path: '/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4'
});

req.on('error', err => {
  console.log(`Error fetching test video: Couldn't connect to server`);
  fs.unlinkSync(destination);
  process.exit(1);
});

req.on('response', res => {
  if (res.statusCode != 200) {
    console.log(`Error fetching test video: Response status ${res.statusCode}`);
    fs.unlinkSync(destination);
    process.exit(1);
  }

  if (res.headers['content-type'] != 'video/mp4') {
    console.log(`Error fetching test video: Unexpected content-type ${res.headers['content-type']}`);
    fs.unlinkSync(destination);
    process.exit(1);
  }

  const len = parseFloat(res.headers['content-length']);

  const bar = new ProgressBar('Fetching test video [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: len
  });

  const stream = res.pipe(through2(function(chunk, enc, callback) {
    bar.tick(chunk.length);
    this.push(chunk);
    callback();
  })).pipe(out);

  stream.on('error', err => {
    console.log(`Error fetching test video: ${err.message}`);
    fs.unlinkSync(destination);
    process.exit(1);
  });

  stream.on('end', () => console.log('\n'));
});

req.end();