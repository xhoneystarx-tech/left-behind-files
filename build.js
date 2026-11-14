/* Writes prompt.txt, the instructions the public AI server downloads. Run: node build.js */
global.LBF = {}; global.window = { LBF: global.LBF };
const LBF = require('./data.js');
require('fs').writeFileSync(__dirname + '/prompt.txt', LBF.buildPrompt());
console.log('prompt.txt written,', LBF.buildPrompt().length, 'characters');
