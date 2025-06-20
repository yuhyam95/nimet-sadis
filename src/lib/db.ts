
import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import type { UserDocument } from '@/types';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'nimet_sadis_db'; // You can set a default DB name or use an env var

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function setupInitialUser(db: Db) {
    const usersCollection = db.collection<UserDocument>('users');
    const userCount = await usersCollection.countDocuments();

    if (userCount === 0) {
        console.log("No users found. Creating default admin user...");
        const defaultPassword = "password123"; // Simple password for initial setup
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const defaultAdmin: UserDocument = {
            username: 'admin',
            email: 'admin@nimet.gov.ng',
            hashedPassword: hashedPassword,
            roles: ['admin'],
            station: 'Headquarters',
            createdAt: new Date(),
            status: 'active',
        };

        await usersCollection.insertOne(defaultAdmin);
        console.log("==========================================");
        console.log("Default admin user created successfully.");
        console.log(`Username: ${defaultAdmin.username}`);
        console.log(`Password: ${defaultPassword}`);
        console.log("Please change this password after initial login.");
        console.log("==========================================");
    }
}


export async function connectToDatabase(): Promise<{ client: MongoClient, db: Db }> {
  if (cachedClient && cachedDb) {
    try {
      // Ping the database to check if connection is still alive
      await cachedClient.db('admin').command({ ping: 1 });
      return { client: cachedClient, db: cachedDb };
    } catch (e) {
      // Connection might have been lost, clear cache and reconnect
      cachedClient = null;
      cachedDb = null;
    }
  }

  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    cachedClient = client;
    cachedDb = db;
    console.log("Successfully connected to MongoDB and database: " + DB_NAME);

    // Run initial setup to ensure a default user exists
    await setupInitialUser(db);

    return { client, db };
  } catch (e) {
    console.error("Failed to connect to MongoDB", e);
    throw e; // Rethrow error after logging
  }
}
