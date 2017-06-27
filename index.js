const fs = require('fs');
const {promisify} = require('util');

const stat = promisify(fs.stat);

const Throttle = require('stream-throttle').Throttle;
const express = require('express');
const app = express();
const port = 3000;


function promiseCall(obj, name, ...args) {
  return new Promise((resolve, reject) => {
    obj[name](...args, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    })
  });
}

function parseRange(totalSize, rangeVal) {
  rangeVal = rangeVal.replace(/^bytes=/i, '');

  if (!rangeVal) {
    throw Error('No range given');
  }

  const rangeParts = rangeVal.split('-').map(s => s.trim());
  const result = {start: 0, end: 0};

  if (!rangeParts[0] && !rangeParts[1]) throw Error('Invalid range');

  if (rangeParts[0] === '') {
    result.start = totalSize - parseFloat(rangeParts[1]);
    result.end = totalSize - 1;
  }
  else if (rangeParts[1] === '') {
    result.start = parseFloat(rangeParts[0]);
    result.end = totalSize - 1;
  }
  else {
    result.start = parseFloat(rangeParts[0]);
    result.end = parseFloat(rangeParts[1]);
  }
  
  if (isNaN(result.start) || isNaN(result.end)) throw Error('Invalid range (NaN)');
  if (result.end < result.start) throw Error('Invalid range (start before end)');

  return result;
}

function createContentRange(start, end, total) {
  return `bytes ${start}-${end}/${total}`;
}

function getFileStream(opts = {}) {
  return fs.createReadStream(`${__dirname}/static/test.wav`, opts)
    .pipe(new Throttle({ rate: opts.rate }));
}

app.use('/', (req, res, next) => {
  const rangeVal = req.get('Range');
  let str = `${req.method} - ${req.path}`;

  if (rangeVal) {
    str += ` - range ${rangeVal}`;
  }
  else {
    str += ` - no range`;
  }
  console.log(str);
  res.on('finish', () => console.log(`${req.path} - done`));
  res.on('close', () => console.log(`${req.path} - aborted`));
  next();
});

app.use('/', express.static(`${__dirname}/static/`));

async function serve200(req, res) {
  console.log(`${req.path} - serving whole audio`);
  const stream = getFileStream({
    rate: Number(req.query.rate)
  });

  res.set('Content-Type', 'audio/x-wav');
  res.set('Cache-Control', 'no-cache');

  const statResult = await stat(`${__dirname}/static/test.wav`);
  res.set('Content-Length', statResult.size);
  res.status(200);
  stream.pipe(res);
}

app.get('/200.wav', serve200);

app.get('/200-chunked.wav', (req, res) => {
  console.log(`${req.path} - serving whole audio chunked`);
  const stream = getFileStream({
    rate: Number(req.query.rate)
  });

  res.set('Content-Type', 'audio/x-wav');
  res.set('Cache-Control', 'no-cache');
  res.status(200);
  stream.pipe(res);
});

app.get('/range.wav', async (req, res) => {
  res.set('Content-Type', 'audio/x-wav');
  res.set('Cache-Control', 'no-cache');

  try {
    const statResult = await stat(`${__dirname}/static/test.wav`);
    const rangeVal = req.get('Range') && req.get('Range').trim();
    res.set('Accept-Ranges', 'bytes');
    if (!rangeVal) return serve200(req, res);

    const range = parseRange(statResult.size, rangeVal);

    const stream = getFileStream({
      rate: Number(req.query.rate),
      start: range.start,
      end: range.end
    });

    console.log(`${req.path} - serving range ${range.start}-${range.end}/${statResult.size}`);
    res.set('Content-Length', (range.end - range.start) + 1);
    res.set('Content-Range', createContentRange(range.start, range.end, statResult.size));
    res.status(206);
    stream.pipe(res);
  }
  catch (err) {
    res.status(500).send(err.message);
    console.error(err.message);
  }

});

app.get('/less-range.wav', async (req, res) => {
  res.set('Content-Type', 'audio/x-wav');
  res.set('Cache-Control', 'no-cache');

  try {
    const statResult = await stat(`${__dirname}/static/test.wav`);
    const rangeVal = req.get('Range') && req.get('Range').trim();
    res.set('Accept-Ranges', 'bytes');
    if (!rangeVal) return serve200(req, res);

    const range = parseRange(statResult.size, rangeVal);
    
    if (range.end - range.start > 50000) {
      range.end = Math.round(Math.max(range.start, range.end - ((range.end - range.start) * 0.8)));
    }

    const stream = getFileStream({
      rate: Number(req.query.rate),
      start: range.start,
      end: range.end
    });

    console.log(`${req.path} - serving less range ${range.start}-${range.end}/${statResult.size}`);
    res.set('Content-Length', (range.end - range.start) + 1);
    res.set('Content-Range', createContentRange(range.start, range.end, statResult.size));
    res.status(206);
    stream.pipe(res);
  }
  catch (err) {
    res.status(500).send(err.message);
    console.error(err.message);
  }
});

app.get('/more-range.wav', async (req, res) => {
  res.set('Content-Type', 'audio/x-wav');
  res.set('Cache-Control', 'no-cache');

  try {
    const statResult = await stat(`${__dirname}/static/test.wav`);
    const rangeVal = req.get('Range') && req.get('Range').trim();
    res.set('Accept-Ranges', 'bytes');
    if (!rangeVal) return serve200(req, res);

    const range = parseRange(statResult.size, rangeVal);
    
    range.start = Math.max(0, range.start - 100000);
    range.end = Math.min(range.end, range.end + 100000);

    const stream = getFileStream({
      rate: Number(req.query.rate),
      start: range.start,
      end: range.end
    });

    console.log(`${req.path} - serving more range ${range.start}-${range.end}/${statResult.size}`);
    res.set('Content-Length', (range.end - range.start) + 1);
    res.set('Content-Range', createContentRange(range.start, range.end, statResult.size));
    res.status(206);
    stream.pipe(res);
  }
  catch (err) {
    res.status(500).send(err.message);
    console.error(err.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});