import { getCollection } from '../mongodb'
import crypto from 'crypto'

export interface ExternalServiceInfo {
  name: string
  description: string
  purpose: string
  category: string // e.g., "Analytics", "Advertising", "Social Media", "Tag Management", etc.
  website?: string
  documentationUrl?: string
  privacyPolicyUrl?: string
}

export interface AdobeAnalyticsInfo {
  hasAdobeAnalytics: boolean
  variableModifications?: string[]
  trackingCalls?: string[]
  customLinks?: string[]
  eventsSet?: string[]
  eVarsSet?: string[]
  propsSet?: string[]
  productsString?: string
  details?: string
}

export interface EddlDataLayerInfo {
  hasEddlProcessing: boolean
  operations?: string[]
  dataLayerVariables?: string[]
  eventListeners?: string[]
  details?: string
}

export interface AnalysisSections {
  summary?: string
  purpose?: string
  keyActions?: string[]
  dataCollection?: string
  privacyConsiderations?: string
}

export interface ScriptAnalysisDocument {
  _id?: string
  scriptUrl: string
  scriptHash: string // Hash of script content for cache invalidation
  scriptLength: number
  gzippedSize: number
  analysis: string // Full markdown analysis for display
  analysisSections?: AnalysisSections // Individual sections for export
  externalServices: string[] // List of external services/APIs detected
  externalServicesDetails?: ExternalServiceInfo[] // Detailed info about each service
  loadsScripts: boolean // Whether the script dynamically loads other scripts
  hasPathBasedConfig: boolean // Whether script has path-based configuration logic
  pathConfigDetails?: string // Details about path-based configuration
  adobeAnalytics: AdobeAnalyticsInfo | null // Adobe Analytics specific analysis
  eddlDataLayer: EddlDataLayerInfo | null // EDDL/Data Layer specific analysis
  scriptContent: string // Beautified version
  originalContent: string // Original minified version
  truncated: boolean
  triggeredByEvent?: string // Event type that triggers this script
  triggeredByRule?: string // Rule name that contains this script
  createdAt: Date
  updatedAt: Date
}

const COLLECTION_NAME = 'script-analyses'

// Generate hash of script content for cache key
export function generateScriptHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

// Get cached analysis by URL and script hash
export async function getCachedAnalysis(
  scriptUrl: string,
  scriptHash: string
): Promise<ScriptAnalysisDocument | null> {
  try {
    const collection = await getCollection(COLLECTION_NAME)
    if (!collection) {
      return null // MongoDB not configured
    }
    const result = await collection.findOne({
      scriptUrl,
      scriptHash
    })
    return result as ScriptAnalysisDocument | null
  } catch (error) {
    console.error('Error getting cached analysis:', error)
    return null
  }
}

// Save or update analysis result
export async function saveAnalysis(
  data: Omit<ScriptAnalysisDocument, '_id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  try {
    const collection = await getCollection(COLLECTION_NAME)
    if (!collection) {
      console.log('MongoDB not configured, skipping cache save')
      return // MongoDB not configured, skip silently
    }
    const now = new Date()

    await collection.updateOne(
      {
        scriptUrl: data.scriptUrl,
        scriptHash: data.scriptHash
      },
      {
        $set: {
          ...data,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    )

    console.log(`Analysis saved for ${data.scriptUrl}`)
  } catch (error) {
    console.error('Error saving analysis:', error)
    throw error
  }
}

// Create index on scriptUrl and scriptHash for fast lookups
export async function createIndexes(): Promise<void> {
  try {
    const collection = await getCollection(COLLECTION_NAME)
    if (!collection) {
      console.log('MongoDB not configured, skipping index creation')
      return
    }
    await collection.createIndex({ scriptUrl: 1, scriptHash: 1 }, { unique: true })
    await collection.createIndex({ createdAt: -1 })
    console.log('Indexes created for script-analyses collection')
  } catch (error) {
    console.error('Error creating indexes:', error)
  }
}

// Get analysis statistics
export async function getAnalysisStats(): Promise<{
  totalAnalyses: number
  uniqueScripts: number
}> {
  try {
    const collection = await getCollection(COLLECTION_NAME)
    if (!collection) {
      return {
        totalAnalyses: 0,
        uniqueScripts: 0
      }
    }
    const totalAnalyses = await collection.countDocuments()
    const uniqueScripts = (await collection.distinct('scriptUrl')).length

    return {
      totalAnalyses,
      uniqueScripts
    }
  } catch (error) {
    console.error('Error getting analysis stats:', error)
    return {
      totalAnalyses: 0,
      uniqueScripts: 0
    }
  }
}

// Get all analyses for export
export async function getAllAnalyses(): Promise<ScriptAnalysisDocument[]> {
  try {
    const collection = await getCollection(COLLECTION_NAME)
    if (!collection) {
      return []
    }
    const analyses = await collection.find({}).sort({ createdAt: -1 }).toArray()
    return analyses as unknown as ScriptAnalysisDocument[]
  } catch (error) {
    console.error('Error getting all analyses:', error)
    return []
  }
}

// Update analysis with trigger info
export async function updateAnalysisTriggerInfo(
  scriptUrl: string,
  triggeredByEvent?: string,
  triggeredByRule?: string
): Promise<void> {
  try {
    const collection = await getCollection(COLLECTION_NAME)
    if (!collection) {
      return
    }
    await collection.updateMany(
      { scriptUrl },
      {
        $set: {
          triggeredByEvent,
          triggeredByRule,
          updatedAt: new Date()
        }
      }
    )
  } catch (error) {
    console.error('Error updating trigger info:', error)
  }
}
