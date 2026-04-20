const { exec } = require('child_process');
const path = require('path');

const frontendPath = path.join(__dirname, 'frontend');

console.log('Starting frontend dev server...');

const child = exec('npm run dev', {
  cwd: frontendPath,
  windowsHide: false
}, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});

child.unref();

console.log('Frontend server started on http://localhost:5173');
console.log('Press Ctrl+C to stop');

// Keep the script running
setInterval(() => {}, 1000);
