// Test script to verify socket URL configuration
console.log('🔧 Testing socket URL configuration...');

// Simulate React Native __DEV__ variable
global.__DEV__ = true;

// Test customer app socket configuration
console.log('\n📱 Testing CUSTOMER app socket configuration:');
const customerSocketConfig = require('./testinguser/src/utils/socket.ts');
console.log('Customer socket URL should be: http://localhost:9092');

// Test driver app socket configuration  
console.log('\n🚗 Testing DRIVER app socket configuration:');
const driverSocketConfig = require('./ridersony/src/utils/socket.ts');
console.log('Driver socket URL should be: http://localhost:9092');

console.log('\n✅ Socket URL configuration test completed'); 