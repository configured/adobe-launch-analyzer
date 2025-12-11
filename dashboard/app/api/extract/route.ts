import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import vm from 'vm'

interface ExtractResult {
  success: boolean
  url: string
  timestamp: string
  metadata?: {
    extractedAt: string
    sourceUrl: string
    ruleCount: number
    dataElementCount: number
    extensionCount: number
    scriptSize: number
  }
  rules?: any[]
  dataElements?: Record<string, any>
  extensions?: Record<string, any>
  buildInfo?: any
  error?: string
}

function serializeContainer(container: any): any {
  return JSON.parse(JSON.stringify(container, (key, value) => {
    if (typeof value === 'function') {
      return {
        __isFunction: true,
        source: value.toString()
      }
    }
    return value
  }))
}

function extractBalancedBraces(str: string, startIndex: number): string | null {
  let braceCount = 0
  let inString = false
  let stringChar = ''
  let escaped = false

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (!inString) {
      if (char === '"' || char === "'" || char === '`') {
        inString = true
        stringChar = char
      } else if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          return str.substring(startIndex, i + 1)
        }
      }
    } else {
      if (char === stringChar) {
        inString = false
        stringChar = ''
      }
    }
  }

  return null
}

function extractViaSandbox(scriptContent: string): any {
  try {
    const sandbox: Record<string, any> = {
      window: { _satellite: {} },
      _satellite: {},
      console: { log: () => {}, warn: () => {}, error: () => {} },
      document: {},
      navigator: {},
      location: {},
      setTimeout: () => {},
      setInterval: () => {},
      clearTimeout: () => {},
      clearInterval: () => {}
    }

    const context = vm.createContext(sandbox)
    vm.runInContext(scriptContent, context, {
      timeout: 10000,
      displayErrors: false
    })

    const container = sandbox.window._satellite?.container || sandbox._satellite?.container

    if (container) {
      console.log('Container found via sandbox! Rules:', Array.isArray(container.rules) ? container.rules.length : Object.keys(container.rules || {}).length)
      return serializeContainer(container)
    }

    console.log('No container found in sandbox')
    return null
  } catch (error: any) {
    console.log('Sandbox execution failed:', error.message)
    return null
  }
}

function safeEval(objectString: string): any {
  try {
    const sandbox = {
      window: {},
      _satellite: {},
      undefined: undefined,
      null: null,
      true: true,
      false: false
    }

    const code = `(function() { return ${objectString}; })()`
    const context = vm.createContext(sandbox)
    const result = vm.runInContext(code, context, {
      timeout: 5000,
      displayErrors: true
    })

    return result
  } catch (error) {
    console.log('Safe eval failed:', error)
    return null
  }
}

function extractContainer(scriptContent: string): any {
  try {
    // Method 1: Execute in sandbox (most reliable)
    const sandboxResult = extractViaSandbox(scriptContent)
    if (sandboxResult) {
      return sandboxResult
    }

    // Method 2: Pattern matching for window._satellite.container={...}
    const pattern = /window\._satellite\.container\s*=\s*\{/
    const startMatch = scriptContent.match(pattern)

    if (startMatch && startMatch.index !== undefined) {
      const startIndex = startMatch.index + startMatch[0].length - 1
      const containerStr = extractBalancedBraces(scriptContent, startIndex)
      if (containerStr) {
        const result = safeEval(containerStr)
        if (result) {
          return serializeContainer(result)
        }
      }
    }

    // Method 3: Alternative pattern _satellite.container={...}
    const altPattern = /_satellite\.container\s*=\s*\{/
    const altMatch = scriptContent.match(altPattern)

    if (altMatch && altMatch.index !== undefined) {
      const startIndex = altMatch.index + altMatch[0].length - 1
      const containerStr = extractBalancedBraces(scriptContent, startIndex)
      if (containerStr) {
        const result = safeEval(containerStr)
        if (result) {
          return serializeContainer(result)
        }
      }
    }

    throw new Error('Could not extract container from script')
  } catch (error) {
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    console.log('Fetching URL:', url)

    // Fetch the script
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Adobe-DTM-Extractor/1.0)'
      }
    })

    const scriptContent = response.data
    console.log('Script fetched, length:', scriptContent.length)
    console.log('Script preview:', scriptContent.substring(0, 200))

    // Extract container
    const container = extractContainer(scriptContent)

    const rules = container.rules || []
    const dataElements = container.dataElements || {}
    const extensions = container.extensions || {}

    const result: ExtractResult = {
      success: true,
      url,
      timestamp: new Date().toISOString(),
      metadata: {
        extractedAt: new Date().toISOString(),
        sourceUrl: url,
        ruleCount: rules.length,
        dataElementCount: Object.keys(dataElements).length,
        extensionCount: Object.keys(extensions).length,
        scriptSize: scriptContent.length
      },
      rules,
      dataElements,
      extensions,
      buildInfo: container.buildInfo
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Extraction error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to extract data from URL'
      },
      { status: 500 }
    )
  }
}
