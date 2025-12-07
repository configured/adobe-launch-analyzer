import { MongoClient, Db } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Please add MONGODB_URI to .env.local')
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

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

// Export a module-scoped MongoClient promise
export default clientPromise

// Helper function to get database
export async function getDatabase(dbName: string = 'adobe-launch-dashboard'): Promise<Db> {
  const client = await clientPromise
  return client.db(dbName)
}

// Helper function to get collection
export async function getCollection(collectionName: string, dbName: string = 'adobe-launch-dashboard') {
  const db = await getDatabase(dbName)
  return db.collection(collectionName)
}
