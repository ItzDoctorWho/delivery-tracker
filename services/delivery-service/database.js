const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');

const deliverySchema = {
  title: 'delivery schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    order_id: { type: 'string' },
    driver_id: { type: 'string' },
    status: { type: 'string' }, // ASSIGNED, PICKED_UP, DELIVERED, CANCELLED
    assigned_at: { type: 'string' },
    picked_up_at: { type: 'string' },
    delivered_at: { type: 'string' }
  },
  required: ['id', 'order_id', 'driver_id', 'status', 'assigned_at', 'picked_up_at', 'delivered_at']
};

let dbPromise = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase({
        name: 'deliverydb',
        storage: getRxStorageMemory()
      });
      await db.addCollections({
        deliveries: {
          schema: deliverySchema
        }
      });
      return db;
    })();
  }
  return dbPromise;
}

module.exports = { getDB };
