import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const options = {}

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// Only initialize MongoDB if URI is provided
if (uri) {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable to preserve the MongoClient across hot reloads
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    // In production mode, create a new MongoClient
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

// Export a module-scoped MongoClient promise (may be null if no URI provided)
export default clientPromise

// Helper function to get database
export async function getDatabase(dbName: string = 'adobe-launch-dashboard'): Promise<Db | null> {
  if (!clientPromise) {
    console.warn('MongoDB not configured - MONGODB_URI not set')
    return null
  }
  const client = await clientPromise
  return client.db(dbName)
}

// Helper function to get collection
export async function getCollection(collectionName: string, dbName: string = 'adobe-launch-dashboard') {
  const db = await getDatabase(dbName)
  if (!db) {
    return null
  }
  return db.collection(collectionName)
}
