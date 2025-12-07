import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import OpenAI from 'openai'
import { js as beautifyJs } from 'js-beautify'
import { gzip } from 'zlib'
import { promisify } from 'util'
import { getCachedAnalysis, saveAnalysis, generateScriptHash } from '@/lib/models/scriptAnalysis'

const gzipAsync = promisify(gzip)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

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
      }
    })

    const scriptContent = response.data
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

    // Analyze with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing Adobe Launch/DTM tracking scripts. Analyze the provided JavaScript code and explain:

1. **Purpose**: What is this script doing? (e.g., tracking events, setting cookies, making API calls)
2. **Key Actions**: List the main operations it performs
3. **Data Collection**: What data is being collected or sent?
4. **External Services**: What third-party services or APIs does it interact with?
5. **Privacy Considerations**: Are there any privacy-related actions (cookies, tracking, PII)?

Provide a clear, concise summary that a non-technical person can understand, followed by technical details.`
        },
        {
          role: 'user',
          content: `Analyze this Adobe Launch action script:\n\n${truncatedScript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })

    const analysis = completion.choices[0]?.message?.content || 'No analysis generated'

    console.log('Analysis complete')

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
          scriptContent: beautifiedScript,
          originalContent: scriptContent,
          truncated: scriptContent.length > maxLength
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
