const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Driver Service  ', dir: 'services/driver-service', cmd: 'npm', args: ['start'] },
  { name: 'Order Service   ', dir: 'services/order-service', cmd: 'npm', args: ['start'] },
  { name: 'Delivery Service', dir: 'services/delivery-service', cmd: 'npm', args: ['start'] },
  { name: 'API Gateway     ', dir: 'api-gateway', cmd: 'npm', args: ['start'] }
];

const children = [];

console.log('=== Starting All Microservices ===\n');

services.forEach((service) => {
  const isWin = process.platform === 'win32';
  const cmd = isWin && service.cmd === 'npm' ? 'npm.cmd' : service.cmd;
  
  const child = spawn(`${cmd} ${service.args.join(' ')}`, [], {
    cwd: path.join(__dirname, service.dir),
    shell: true,
    env: {
      ...process.env,
      KAFKAJS_NO_PARTITIONER_WARNING: '1',
      NODE_NO_WARNINGS: '1'
    }
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`[${service.name}] ${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`[${service.name}] [STDERR] ${line}`);
      }
    });
  });

  child.on('close', (code) => {
    console.log(`[${service.name}] Process exited with code ${code}`);
  });

  children.push(child);
});

// Handle graceful shutdown
const shutdown = () => {
  console.log('\nStopping all services...');
  children.forEach(child => {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
