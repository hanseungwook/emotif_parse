  //==================Server Setup==================//
//================================================//

var express = require('express'),
    app = express(),
    ParseServer = require('parse-server').ParseServer,
    port = process.env.PORT || 1337,
    bodyParser = require('body-parser'),
    S3Adapter = require('parse-server').S3Adapter,
    dotenv = require('dotenv').config();

var api = new ParseServer({
  databaseURI: process.env.MONGODB_URI,
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID,
  masterKey: process.env.MASTER_KEY,
  serverURL: process.env.SERVER_URL,
  filesAdapter: new S3Adapter(
    process.env.AWS_ACCESS_KEY_ID,
    process.env.AWS_SECRET_ACCESS_KEY,
    process.env.BUCKET_NAME,
    {region: process.env.AWS_REGION,
      directAccess: true}
  )
});

app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());
app.use('/parse', api);

// Chat app shell (vanilla JS, no build step). Served from /app/.
app.use('/app', express.static(__dirname + '/frontend'));

// Tetris rendering subsystem — browser bundle generated from CommonJS source.
var buildTetrisBundle = require('./tetris/rendering/browserBundle').buildBrowserBundle;
app.get('/tetris/rendering.bundle.js', function(req, res) {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.send(buildTetrisBundle());
});

// Modern Snake — core-workflow standalone engine demo. The product shell
// mount below also serves this file at /snake/core/web/index.html.
app.use('/snake-engine', express.static(__dirname + '/snake/core/web'));

app.get('/', function(req, res) {
  res.status(200).send('Routing working');
});

app.listen(port, function() {
    console.log('Emotif backend with parse running on ' + port + '.');
});


