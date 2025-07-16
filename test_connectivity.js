const http = require('http');

const testUrl = 'http://192.168.1.9:3000/debug/state';

console.log('Testing connectivity to:', testUrl);

const req = http.get(testUrl, (res) => {
  console.log('✅ SUCCESS: Server is accessible!');
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.log('❌ ERROR: Cannot connect to server');
  console.log('Error:', err.message);
  console.log('');
  console.log('Possible solutions:');
  console.log('1. Check if Windows Firewall is blocking port 3000');
  console.log('2. Make sure both devices are on the same network');
  console.log('3. Try using a different port');
  console.log('4. Check if antivirus software is blocking the connection');
});

req.setTimeout(5000, () => {
  console.log('❌ TIMEOUT: Connection timed out');
  req.destroy();
}); 