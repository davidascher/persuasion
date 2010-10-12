// server.js

// move all redis error handling to a specific handler, as we expect them _never_.
// implement appropriate auth checking everywhere (commenting, reading, saving, etc.)
// move session storage to redis for persistence across restarts
var path = require('path');
require.paths.unshift(path.join(__dirname, './support'));
var app = require('./app').app;
app.listen(3000);
console.log('Persuasion started on port 3000');
