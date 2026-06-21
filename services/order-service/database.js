const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');

const orderSchema = {
  title: 'order schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    customer_id: { type: 'string' },
    pickup_address: { type: 'string' },
    delivery_address: { type: 'string' },
    status: { type: 'string' },
    items: { type: 'string' },
    price: { type: 'number' },
    created_at: { type: 'string' }
  },
  required: ['id', 'customer_id', 'pickup_address', 'delivery_address', 'status', 'items', 'price', 'created_at']
};

let dbPromise = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase({
        name: 'orderdb',
        storage: getRxStorageMemory()
      });
      await db.addCollections({
        orders: {
          schema: orderSchema
        }
      });
      return db;
    })();
  }
  return dbPromise;
}

module.exports = { getDB };
