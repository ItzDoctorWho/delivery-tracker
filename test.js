const http = require('http');

const API_URL = 'http://localhost:4000/api';

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`POST ${path} failed (${res.statusCode}): ${body}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function put(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(`${API_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`PUT ${path} failed (${res.statusCode}): ${body}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_URL}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GET ${path} failed (${res.statusCode}): ${body}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    }).on('error', reject);
  });
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log('=== starting end-to-end delivery microservices test ===');

  try {
    // 1. Create a Driver
    console.log('\n[Step 1] Creating a driver...');
    const driver = await post('/drivers', { name: 'John Doe', vehicle: 'Scooter' });
    console.log('Driver Created:', driver);

    // 2. Create an Order (this should trigger Kafka auto-assignment)
    console.log('\n[Step 2] Creating an order (triggers Kafka event for assignment)...');
    const order = await post('/orders', {
      customer_id: 'cust_9876',
      pickup_address: '123 Pizza Street',
      delivery_address: '456 Hungry Avenue',
      items: '1x Large Pepperoni Pizza, 1x Soda',
      price: 24.99
    });
    console.log('Order Created:', order);

    // Give Kafka some time to propagate and auto-assign
    console.log('Waiting 3 seconds for Kafka consumer to assign driver...');
    await delay(3000);

    // 3. Verify Delivery was created and Driver status is BUSY
    console.log('\n[Step 3] Verifying delivery record and driver status...');
    const deliveries = await get('/deliveries');
    console.log('All Deliveries:', deliveries);

    const delivery = deliveries.find(d => d.order_id === order.id);
    if (!delivery) {
      throw new Error('No delivery record found for this order! Auto-assignment might have failed or Kafka is offline.');
    }
    console.log('Assigned Delivery:', delivery);

    const drivers = await get('/drivers');
    const updatedDriver = drivers.find(d => d.id === driver.id);
    console.log('Driver current status (should be BUSY):', updatedDriver.status);

    // 4. Driver updates delivery status to PICKED_UP
    console.log('\n[Step 4] Simulating driver picking up the package...');
    const pickedUp = await put(`/deliveries/${delivery.id}/status`, { status: 'PICKED_UP' });
    console.log('Updated Delivery:', pickedUp);

    // Verify order status updated
    const orderAfterPickup = await get(`/orders/${order.id}`);
    console.log('Order status after pickup (should be PICKED_UP):', orderAfterPickup.status);

    // 5. Driver updates delivery status to DELIVERED
    console.log('\n[Step 5] Simulating delivery completion...');
    const delivered = await put(`/deliveries/${delivery.id}/status`, { status: 'DELIVERED' });
    console.log('Updated Delivery:', delivered);

    // Verify driver is AVAILABLE again and order is DELIVERED
    const finalDrivers = await get('/drivers');
    const finalDriver = finalDrivers.find(d => d.id === driver.id);
    console.log('Driver status after delivery (should be AVAILABLE):', finalDriver.status);

    const finalOrder = await get(`/orders/${order.id}`);
    console.log('Order status after delivery (should be DELIVERED):', finalOrder.status);

    console.log('\n=== All tests passed successfully! ===');
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
}

runTests();
