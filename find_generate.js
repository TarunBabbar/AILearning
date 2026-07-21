const fs = require('fs');
const c = fs.readFileSync(
  'C:\\Users\\Tarun Babbar\\AppData\\Local\\nvm\\v22.22.3\\node_modules\\command-code\\dist\\cli.mjs',
  'utf8'
);

// Find how /alpha/generate is called
const idx = c.indexOf('/alpha/generate');
if (idx >= 0) {
  const start = Math.max(0, idx - 300);
  const end = Math.min(c.length, idx + 600);
  console.log('=== /alpha/generate context ===');
  console.log(c.substring(start, end));
}

// Find the auth header setup
const authIdx = c.indexOf('COMMANDCODE_API_KEY');
if (authIdx >= 0) {
  console.log('\n=== COMMANDCODE_API_KEY context ===');
  console.log(c.substring(authIdx - 100, authIdx + 400));
}
