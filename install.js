const fs = require('fs');
const ProgressBar = require('progress');
const https = require('https');
const through2 = require('through2');

const destination = `${__dirname}/static/test.wav`;

try {
  fs.accessSync(destination);
  // already got the video
  process.exit();
} catch(e) {}

const out = fs.createWriteStream(destination);
const req = https.request('https://upload.wikimedia.org/wikipedia/commons/0/01/Higher_Intelligent_Probes.wav');

req.on('error', err => {
  console.log(`Error fetching test audio: Couldn't connect to server`);
  fs.unlinkSync(destination);
  process.exit(1);
});

req.on('response', res => {
  if (res.statusCode != 200) {
    console.log(`Error fetching test audio: Response status ${res.statusCode}`);
    fs.unlinkSync(destination);
    process.exit(1);
  }

  if (res.headers['content-type'] != 'audio/x-wav') {
    console.log(`Error fetching test audio: Unexpected content-type ${res.headers['content-type']}`);
    fs.unlinkSync(destination);
    process.exit(1);
  }

  const len = parseFloat(res.headers['content-length']);

  const bar = new ProgressBar('Fetching test audio [:bar] :percent :etas', {
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
    console.log(`Error fetching test audio: ${err.message}`);
    fs.unlinkSync(destination);
    process.exit(1);
  });

  stream.on('end', () => console.log('\n'));
});

req.end();