import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import OpenAI from 'openai'
import { js as beautifyJs } from 'js-beautify'
import { gzip } from 'zlib'
import { promisify } from 'util'
import { getCachedAnalysis, saveAnalysis, generateScriptHash } from '@/lib/models/scriptAnalysis'

const gzipAsync = promisify(gzip)

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { url, triggeredByEvent, triggeredByRule } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-api-key-here') {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    console.log('Fetching script:', url)

    // Fetch the script
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Adobe-DTM-Analyzer/1.0)'
      },
      validateStatus: (status) => status >= 200 && status < 300
    })

    const scriptContent = response.data

    // Validate that we received JavaScript, not HTML
    if (typeof scriptContent !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid response: expected text content' },
        { status: 400 }
      )
    }

    // Check if response is HTML instead of JavaScript
    if (scriptContent.trim().toLowerCase().startsWith('<!doctype') ||
        scriptContent.trim().toLowerCase().startsWith('<html')) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL returned HTML instead of JavaScript. Please verify the script URL is correct.'
        },
        { status: 400 }
      )
    }

    // Check content type if available
    const contentType = response.headers['content-type'] || ''
    if (contentType.includes('text/html')) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL returned HTML (text/html) instead of JavaScript. Please verify the script URL.'
        },
        { status: 400 }
      )
    }

    console.log('Script fetched, length:', scriptContent.length)

    // Generate hash of script content for cache lookup
    const scriptHash = generateScriptHash(scriptContent)

    // Check if we have a cached analysis for this script (only if MongoDB is configured)
    if (process.env.MONGODB_URI) {
      try {
        const cached = await getCachedAnalysis(url, scriptHash)
        if (cached) {
          console.log('Returning cached analysis for:', url)
          return NextResponse.json({
            success: true,
            url,
            scriptLength: cached.scriptLength,
            scriptContent: cached.scriptContent,
            originalContent: cached.originalContent,
            gzippedSize: cached.gzippedSize,
            analysis: cached.analysis,
            externalServices: cached.externalServices || [],
            loadsScripts: cached.loadsScripts || false,
            hasPathBasedConfig: cached.hasPathBasedConfig || false,
            pathConfigDetails: cached.pathConfigDetails || '',
            adobeAnalytics: cached.adobeAnalytics || null,
            eddlDataLayer: cached.eddlDataLayer || null,
            truncated: cached.truncated,
            cached: true
          })
        }
      } catch (error) {
        console.warn('MongoDB cache check failed, continuing with fresh analysis:', error)
      }
    }

    // Extract code from _satellite.__registerScript if present
    let extractedCode = scriptContent
    let wasExtracted = false

    // Look for _satellite.__registerScript pattern
    const registerScriptIndex = scriptContent.indexOf('_satellite.__registerScript(')

    if (registerScriptIndex !== -1) {
      // Find the start of the code string (after the first comma and quote)
      const afterRegister = scriptContent.substring(registerScriptIndex)
      const firstQuoteMatch = afterRegister.match(/,\s*["']/)

      if (firstQuoteMatch && firstQuoteMatch.index !== undefined) {
        const quoteChar = firstQuoteMatch[0].slice(-1) // Get " or '
        const codeStart = registerScriptIndex + firstQuoteMatch.index + firstQuoteMatch[0].length

        // Find the matching closing quote + );
        let codeEnd = -1
        let escaped = false

        for (let i = codeStart; i < scriptContent.length; i++) {
          const char = scriptContent[i]

          if (escaped) {
            escaped = false
            continue
          }

          if (char === '\\') {
            escaped = true
            continue
          }

          if (char === quoteChar) {
            // Check if this is followed by );
            const remaining = scriptContent.substring(i)
            if (remaining.match(/^["']\s*\)\s*;?\s*$/)) {
              codeEnd = i
              break
            }
          }
        }

        if (codeEnd !== -1) {
          const rawCode = scriptContent.substring(codeStart, codeEnd)
          // Unescape the string
          extractedCode = rawCode
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\')

          wasExtracted = true
          console.log('Successfully extracted __registerScript content')
        }
      }
    }

    if (!wasExtracted) {
      console.log('No __registerScript found, using full script')
    }

    console.log('Code length:', extractedCode.length, 'Was extracted:', wasExtracted)

    // Beautify the extracted code for better readability
    let beautifiedScript: string
    try {
      beautifiedScript = beautifyJs(extractedCode, {
        indent_size: 2,
        space_in_empty_paren: true,
        jslint_happy: true,
        max_preserve_newlines: 2,
        preserve_newlines: true,
        keep_array_indentation: false,
        break_chained_methods: false,
        brace_style: 'collapse',
        space_before_conditional: true,
        unescape_strings: false,
        wrap_line_length: 0,
        end_with_newline: true
      })
      console.log('Script beautified successfully')
    } catch (beautifyError) {
      console.log('Beautification failed, using original:', beautifyError)
      beautifiedScript = extractedCode
    }

    // Truncate if too long (OpenAI has token limits)
    const maxLength = 50000 // Roughly 12-13K tokens
    const truncatedScript = extractedCode.length > maxLength
      ? extractedCode.substring(0, maxLength) + '\n\n// ... (script truncated for analysis)'
      : extractedCode

    console.log('Sending to OpenAI for analysis...')

    // Analyze with OpenAI using structured output
    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing Adobe Launch/DTM tracking scripts. Analyze the provided JavaScript code and return a JSON object with the following structure:

{
  "summary": "Brief summary of what this script does",
  "purpose": "What is this script doing? (e.g., tracking events, setting cookies, making API calls)",
  "keyActions": ["List", "of", "main", "operations"],
  "dataCollection": "What data is being collected or sent?",
  "externalServices": ["List", "of", "third-party", "services", "or", "APIs"],
  "loadsScripts": true/false (whether it dynamically loads other scripts via createElement, insertBefore, appendChild, etc.),
  "privacyConsiderations": "Privacy-related actions (cookies, tracking, PII)",
  "hasPathBasedConfig": true/false (whether the script has logic to manage different configurations or behaviors based on URL paths, pathnames, or page types),
  "pathConfigDetails": "Description of path-based configuration logic if found (e.g., 'Loads different tracking IDs for /checkout vs /homepage', 'Applies different rules based on window.location.pathname'). Empty string if none.",
  "adobeAnalytics": {
    "hasAdobeAnalytics": true/false (whether script interacts with Adobe Analytics),
    "variableModifications": ["List of s.* or _satellite variable modifications like 's.pageName', 's.eVar1', 's.prop1', 's.events', etc."],
    "trackingCalls": ["List of tracking calls like 's.t()', 's.tl()', 's.clearVars()', '_satellite.track()', etc."],
    "customLinks": ["Any custom link tracking identified"],
    "eventsSet": ["List of events being set like 'event1', 'purchase', 'prodView', etc."],
    "eVarsSet": ["List of eVars being set like 'eVar1', 'eVar2', etc."],
    "propsSet": ["List of props being set like 'prop1', 'prop2', etc."],
    "productsString": "Description of products string manipulation if found, empty string if none",
    "details": "Additional details about Adobe Analytics implementation"
  },
  "eddlDataLayer": {
    "hasEddlProcessing": true/false (whether script reads from or writes to eddlDataLayer, digitalData, dataLayer, or similar data layer objects),
    "operations": ["List of operations like 'read', 'write', 'push', 'event listener', etc."],
    "dataLayerVariables": ["List of data layer paths accessed like 'eddlDataLayer.page.pageInfo', 'digitalData.user', 'dataLayer.push()', etc."],
    "eventListeners": ["Any adobeDataLayer.push or addEventListener patterns for data layer events"],
    "details": "Description of how the script interacts with the data layer"
  }
}

Be thorough in identifying external services - look for domain names, API endpoints, CDN URLs, and third-party service names.
For path-based configuration, look for patterns like: pathname checks, URL path conditionals, page type detection, route-based logic, location.pathname usage, regex path matching, or path-to-config mappings.
For Adobe Analytics, look for: s.pageName, s.channel, s.eVar*, s.prop*, s.events, s.products, s.t(), s.tl(), s.clearVars(), _satellite.getVar(), _satellite.setVar(), and any AppMeasurement patterns.
For EDDL/Data Layer, look for: eddlDataLayer, digitalData, dataLayer, adobeDataLayer, window.digitalData, window.dataLayer, .push() calls on data layers, getState(), addEventListener for data layer events, and any XDM object manipulation.`
        },
        {
          role: 'user',
          content: `Analyze this Adobe Launch action script:\n\n${truncatedScript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    let parsedAnalysis: any
    let externalServices: string[] = []
    let loadsScripts = false
    let hasPathBasedConfig = false
    let pathConfigDetails = ''
    let adobeAnalytics: any = null
    let eddlDataLayer: any = null

    try {
      parsedAnalysis = JSON.parse(responseText)
      externalServices = parsedAnalysis.externalServices || []
      loadsScripts = parsedAnalysis.loadsScripts || false
      hasPathBasedConfig = parsedAnalysis.hasPathBasedConfig || false
      pathConfigDetails = parsedAnalysis.pathConfigDetails || ''
      adobeAnalytics = parsedAnalysis.adobeAnalytics || null
      eddlDataLayer = parsedAnalysis.eddlDataLayer || null
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError)
      parsedAnalysis = { summary: responseText }
    }

    // Also check script content directly for script loading patterns
    const scriptLoadingPatterns = [
      /createElement\s*\(\s*['"]script['"]/i,
      /\.src\s*=/i,
      /insertBefore\s*\(/i,
      /appendChild\s*\(/i,
      /document\.write\s*\(\s*['"]<script/i,
      /\.async\s*=/i
    ]

    const hasScriptLoadingCode = scriptLoadingPatterns.some(pattern => pattern.test(extractedCode))
    if (hasScriptLoadingCode && !loadsScripts) {
      console.log('Script loading detected in code analysis')
      loadsScripts = true
    }

    // Also check script content directly for path-based config patterns
    const pathConfigPatterns = [
      /location\.pathname/i,
      /window\.location\.pathname/i,
      /\.pathname\s*[=!]==?\s*['"]/i,
      /pathname\.match\s*\(/i,
      /pathname\.indexOf\s*\(/i,
      /pathname\.includes\s*\(/i,
      /pathname\.startsWith\s*\(/i,
      /\/checkout|\/cart|\/product|\/home/i
    ]

    const hasPathConfigCode = pathConfigPatterns.some(pattern => pattern.test(extractedCode))
    if (hasPathConfigCode && !hasPathBasedConfig) {
      console.log('Path-based configuration detected in code analysis')
      hasPathBasedConfig = true
    }

    // Also check script content directly for Adobe Analytics patterns
    const adobeAnalyticsPatterns = [
      /\bs\.(pageName|channel|server|pageType)\s*=/i,
      /\bs\.(eVar\d+|prop\d+|events)\s*=/i,
      /\bs\.(t|tl|clearVars)\s*\(/i,
      /\bs\.products\s*=/i,
      /_satellite\.(track|getVar|setVar)\s*\(/i,
      /AppMeasurement/i
    ]

    const hasAdobeAnalyticsCode = adobeAnalyticsPatterns.some(pattern => pattern.test(extractedCode))
    if (hasAdobeAnalyticsCode && (!adobeAnalytics || !adobeAnalytics.hasAdobeAnalytics)) {
      console.log('Adobe Analytics patterns detected in code analysis')
      if (!adobeAnalytics) {
        adobeAnalytics = { hasAdobeAnalytics: true }
      } else {
        adobeAnalytics.hasAdobeAnalytics = true
      }
    }

    // Also check script content directly for EDDL/Data Layer patterns
    const eddlDataLayerPatterns = [
      /eddlDataLayer/i,
      /digitalData\s*[.\[]/i,
      /window\.digitalData/i,
      /dataLayer\s*\.\s*push\s*\(/i,
      /adobeDataLayer/i,
      /window\.adobeDataLayer/i,
      /\.getState\s*\(/i,
      /addEventListener\s*\(\s*['"]adobeDataLayer/i,
      /xdm\s*[.:]/i,
      /window\.xdm/i
    ]

    const hasEddlCode = eddlDataLayerPatterns.some(pattern => pattern.test(extractedCode))
    if (hasEddlCode && (!eddlDataLayer || !eddlDataLayer.hasEddlProcessing)) {
      console.log('EDDL/Data Layer patterns detected in code analysis')
      if (!eddlDataLayer) {
        eddlDataLayer = { hasEddlProcessing: true }
      } else {
        eddlDataLayer.hasEddlProcessing = true
      }
    }

    // Format Adobe Analytics section
    const adobeAnalyticsSection = adobeAnalytics?.hasAdobeAnalytics ? `## Adobe Analytics Integration
✓ This script interacts with Adobe Analytics

${adobeAnalytics.variableModifications?.length > 0 ? `### Variable Modifications
${adobeAnalytics.variableModifications.map((v: string) => `- ${v}`).join('\n')}` : ''}

${adobeAnalytics.trackingCalls?.length > 0 ? `### Tracking Calls
${adobeAnalytics.trackingCalls.map((t: string) => `- ${t}`).join('\n')}` : ''}

${adobeAnalytics.eventsSet?.length > 0 ? `### Events Set
${adobeAnalytics.eventsSet.map((e: string) => `- ${e}`).join('\n')}` : ''}

${adobeAnalytics.eVarsSet?.length > 0 ? `### eVars Set
${adobeAnalytics.eVarsSet.map((e: string) => `- ${e}`).join('\n')}` : ''}

${adobeAnalytics.propsSet?.length > 0 ? `### Props Set
${adobeAnalytics.propsSet.map((p: string) => `- ${p}`).join('\n')}` : ''}

${adobeAnalytics.productsString ? `### Products String
${adobeAnalytics.productsString}` : ''}

${adobeAnalytics.details ? `### Additional Details
${adobeAnalytics.details}` : ''}` : `## Adobe Analytics Integration
✗ No Adobe Analytics interactions detected`

    // Format EDDL/Data Layer section
    const eddlDataLayerSection = eddlDataLayer?.hasEddlProcessing ? `## EDDL/Data Layer Processing
✓ This script interacts with the Experience Data Layer

${eddlDataLayer.operations?.length > 0 ? `### Operations
${eddlDataLayer.operations.map((o: string) => `- ${o}`).join('\n')}` : ''}

${eddlDataLayer.dataLayerVariables?.length > 0 ? `### Data Layer Variables Accessed
${eddlDataLayer.dataLayerVariables.map((v: string) => `- ${v}`).join('\n')}` : ''}

${eddlDataLayer.eventListeners?.length > 0 ? `### Event Listeners
${eddlDataLayer.eventListeners.map((e: string) => `- ${e}`).join('\n')}` : ''}

${eddlDataLayer.details ? `### Details
${eddlDataLayer.details}` : ''}` : `## EDDL/Data Layer Processing
✗ No Data Layer interactions detected`

    // Format the analysis as markdown for display
    const analysis = `## Summary
${parsedAnalysis.summary || 'No summary available'}

## Purpose
${parsedAnalysis.purpose || 'Not analyzed'}

## Key Actions
${Array.isArray(parsedAnalysis.keyActions)
  ? parsedAnalysis.keyActions.map((action: string) => `- ${action}`).join('\n')
  : parsedAnalysis.keyActions || 'None identified'}

## Data Collection
${parsedAnalysis.dataCollection || 'No data collection identified'}

## External Services
${externalServices.length > 0
  ? externalServices.map((service: string) => `- ${service}`).join('\n')
  : 'None identified'}

## Dynamically Loads Scripts
${loadsScripts ? '✓ Yes - This script dynamically loads other scripts' : '✗ No - Does not load external scripts'}

## Path-Based Configuration
${hasPathBasedConfig ? `✓ Yes - This script manages configuration per path/page type${pathConfigDetails ? `\n${pathConfigDetails}` : ''}` : '✗ No - Does not have path-specific logic'}

${adobeAnalyticsSection}

${eddlDataLayerSection}

## Privacy Considerations
${parsedAnalysis.privacyConsiderations || 'No specific privacy concerns identified'}`

    console.log('Analysis complete:', {
      externalServices: externalServices.length,
      loadsScripts,
      hasPathBasedConfig,
      hasAdobeAnalytics: adobeAnalytics?.hasAdobeAnalytics || false,
      hasEddlProcessing: eddlDataLayer?.hasEddlProcessing || false
    })

    // Calculate gzipped size
    let gzippedSize = 0
    try {
      const gzipped = await gzipAsync(Buffer.from(scriptContent))
      gzippedSize = gzipped.length
      console.log('Gzipped size:', gzippedSize)
    } catch (gzipError) {
      console.error('Failed to calculate gzipped size:', gzipError)
    }

    // Save to MongoDB cache (only if MongoDB is configured)
    if (process.env.MONGODB_URI) {
      try {
        await saveAnalysis({
          scriptUrl: url,
          scriptHash,
          scriptLength: scriptContent.length,
          gzippedSize,
          analysis,
          externalServices,
          loadsScripts,
          hasPathBasedConfig,
          pathConfigDetails,
          adobeAnalytics,
          eddlDataLayer,
          scriptContent: beautifiedScript,
          originalContent: scriptContent,
          truncated: scriptContent.length > maxLength,
          triggeredByEvent,
          triggeredByRule
        })
        console.log('Analysis saved to MongoDB cache')
      } catch (saveError) {
        console.error('Failed to save to MongoDB cache:', saveError)
        // Continue anyway - cache failure shouldn't break the response
      }
    }

    return NextResponse.json({
      success: true,
      url,
      scriptLength: scriptContent.length,
      scriptContent: beautifiedScript, // Include beautified source code
      originalContent: scriptContent, // Include original minified version
      gzippedSize, // Include gzipped size
      analysis,
      externalServices, // List of external services detected
      loadsScripts, // Whether it loads scripts dynamically
      hasPathBasedConfig, // Whether it has path-based configuration logic
      pathConfigDetails, // Details about path-based configuration
      adobeAnalytics, // Adobe Analytics specific analysis
      eddlDataLayer, // EDDL/Data Layer specific analysis
      truncated: scriptContent.length > maxLength,
      cached: false
    })

  } catch (error: any) {
    console.error('Script analysis error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to analyze script'
      },
      { status: 500 }
    )
  }
}
