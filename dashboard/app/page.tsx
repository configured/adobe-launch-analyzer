'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AdobeData {
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
}

interface ScriptAnalysis {
  [url: string]: {
    loading: boolean
    analysis?: string
    scriptContent?: string
    originalContent?: string
    scriptLength?: number
    gzippedSize?: number
    error?: string
    showOriginal?: boolean
  }
}

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper function to extract event type from modulePath
function getEventTypeFromPath(modulePath: string): string {
  if (!modulePath) return 'unknown'

  // Extract the event type from paths like "core/src/lib/events/windowLoaded.js"
  const match = modulePath.match(/events\/([^.]+)\.js/)
  if (match) {
    return match[1]
  }

  return 'unknown'
}

// Helper function to create human-readable event type labels
function formatEventType(eventType: string): string {
  if (!eventType || eventType === 'unknown') return 'Unknown'

  // Convert camelCase to Title Case with spaces
  return eventType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

export default function Home() {
  const [data, setData] = useState<AdobeData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scriptAnalyses, setScriptAnalyses] = useState<ScriptAnalysis>({})
  const [selectedEventType, setSelectedEventType] = useState<string>('all')

  const handleUrlExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Failed to extract data')
        return
      }

      setData(result)
      setUrl('')
    } catch (error: any) {
      console.error('Error extracting from URL:', error)
      setError(error.message || 'Failed to extract data from URL')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const jsonData = JSON.parse(text)
      setData(jsonData)
    } catch (error) {
      console.error('Error parsing JSON:', error)
      setError('Error parsing JSON file. Please ensure it is a valid JSON file.')
    } finally {
      setLoading(false)
    }
  }

  const analyzeScript = async (scriptUrl: string) => {
    // Set loading state
    setScriptAnalyses(prev => ({
      ...prev,
      [scriptUrl]: { loading: true }
    }))

    try {
      const response = await fetch('/api/analyze-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: scriptUrl }),
      })

      const result = await response.json()

      if (!result.success) {
        setScriptAnalyses(prev => ({
          ...prev,
          [scriptUrl]: {
            loading: false,
            error: result.error || 'Failed to analyze script'
          }
        }))
        return
      }

      setScriptAnalyses(prev => ({
        ...prev,
        [scriptUrl]: {
          loading: false,
          analysis: result.analysis,
          scriptContent: result.scriptContent,
          originalContent: result.originalContent,
          scriptLength: result.scriptLength,
          gzippedSize: result.gzippedSize,
          showOriginal: false
        }
      }))
    } catch (error: any) {
      console.error('Error analyzing script:', error)
      setScriptAnalyses(prev => ({
        ...prev,
        [scriptUrl]: {
          loading: false,
          error: error.message || 'Failed to analyze script'
        }
      }))
    }
  }

  // Extract all unique event types from rules
  const eventTypes = useMemo(() => {
    if (!data?.rules) return []

    const types = new Set<string>()

    data.rules.forEach(rule => {
      rule.events?.forEach((event: any) => {
        if (event.modulePath) {
          const eventType = getEventTypeFromPath(event.modulePath)
          types.add(eventType)
        }
      })
    })

    return Array.from(types).sort()
  }, [data?.rules])

  // Filter rules by search term and event type
  const filteredRules = useMemo(() => {
    if (!data?.rules) return []

    return data.rules.filter(rule => {
      // Filter by search term
      const matchesSearch = !searchTerm ||
        rule.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.id?.toLowerCase().includes(searchTerm.toLowerCase())

      // Filter by event type
      const matchesEventType = selectedEventType === 'all' ||
        rule.events?.some((event: any) => {
          const eventType = getEventTypeFromPath(event.modulePath)
          return eventType === selectedEventType
        })

      return matchesSearch && matchesEventType
    })
  }, [data?.rules, searchTerm, selectedEventType])

  const filteredDataElements = data?.dataElements
    ? Object.entries(data.dataElements).filter(([key, value]) =>
        key.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  const filteredExtensions = data?.extensions
    ? Object.entries(data.extensions).filter(([key, value]) =>
        key.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  // Helper to get module name from path
  const getModuleName = (modulePath: string): string => {
    if (!modulePath) return 'Unknown'
    const match = modulePath.match(/([^/]+)\.js$/)
    if (match) {
      const name = match[1]
      return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    }
    return modulePath
  }

  // Helper to calculate complexity score
  const calculateComplexity = (settings: any): number => {
    if (!settings) return 0
    let complexity = 0

    const analyze = (obj: any): void => {
      if (Array.isArray(obj)) {
        complexity += obj.length
        obj.forEach(item => analyze(item))
      } else if (obj && typeof obj === 'object') {
        const keys = Object.keys(obj)
        complexity += keys.length
        keys.forEach(key => analyze(obj[key]))
      } else if (typeof obj === 'string' && obj.length > 100) {
        complexity += 2 // Long strings are more complex
      }
    }

    analyze(settings)
    return complexity
  }

  const renderValue = (value: any, depth = 0, parentKey?: string): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">null</span>
    }

    if (typeof value === 'boolean') {
      return <span className="text-blue-600">{value.toString()}</span>
    }

    if (typeof value === 'number') {
      return <span className="text-green-600">{value}</span>
    }

    if (typeof value === 'string') {
      // Check if this is an external script URL
      const isExternalScript = parentKey === 'source' && value.startsWith('http')

      if (isExternalScript) {
        const analysis = scriptAnalyses[value]

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:underline break-all"
              >
                "{value}"
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => analyzeScript(value)}
                disabled={analysis?.loading}
              >
                {analysis?.loading ? 'Analyzing...' : 'Analyze Script'}
              </Button>
            </div>

            {analysis && !analysis.loading && (
              <div className="mt-2 space-y-4">
                {analysis.error ? (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {analysis.error}
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-muted rounded-md">
                      <div className="text-sm font-semibold mb-3">AI Analysis:</div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {analysis.analysis}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {analysis.scriptContent && (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="source">
                          <AccordionTrigger>
                            <div className="flex flex-col items-start gap-1 w-full">
                              <span className="font-medium">View Source Code</span>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  Actual: {formatBytes(analysis.scriptLength || 0)}
                                </span>
                                {analysis.gzippedSize && analysis.gzippedSize > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      Gzipped: {formatBytes(analysis.gzippedSize)}
                                    </span>
                                    <span>•</span>
                                    <span className="text-green-600 dark:text-green-400">
                                      Compression: {((1 - analysis.gzippedSize / (analysis.scriptLength || 1)) * 100).toFixed(1)}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              {analysis.originalContent && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={!analysis.showOriginal ? "default" : "outline"}
                                    onClick={() => {
                                      const scriptUrl = value as string
                                      setScriptAnalyses(prev => ({
                                        ...prev,
                                        [scriptUrl]: {
                                          ...prev[scriptUrl],
                                          showOriginal: false
                                        }
                                      }))
                                    }}
                                  >
                                    Beautified
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={analysis.showOriginal ? "default" : "outline"}
                                    onClick={() => {
                                      const scriptUrl = value as string
                                      setScriptAnalyses(prev => ({
                                        ...prev,
                                        [scriptUrl]: {
                                          ...prev[scriptUrl],
                                          showOriginal: true
                                        }
                                      }))
                                    }}
                                  >
                                    Original (Minified)
                                  </Button>
                                </div>
                              )}
                              <div className="max-h-[500px] overflow-auto rounded-md">
                                <SyntaxHighlighter
                                  language="javascript"
                                  style={vscDarkPlus}
                                  showLineNumbers
                                  wrapLines
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: '0.375rem',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {analysis.showOriginal ? analysis.originalContent : analysis.scriptContent}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      }

      return <span className="text-amber-600">"{value}"</span>
    }

    if (value.__isFunction) {
      return (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Custom Code:</div>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-w-full">
            <code>{value.source}</code>
          </pre>
        </div>
      )
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">[]</span>
      }
      return (
        <div className="ml-4 mt-1">
          {value.map((item, index) => (
            <div key={index} className="mb-2">
              <span className="text-muted-foreground">[{index}]:</span> {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      )
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) {
        return <span className="text-muted-foreground">{'{}'}</span>
      }
      return (
        <div className="ml-4 mt-1 space-y-1">
          {entries.map(([key, val]) => (
            <div key={key} className="mb-2">
              <span className="font-medium text-foreground">{key}:</span> {renderValue(val, depth + 1, key)}
            </div>
          ))}
        </div>
      )
    }

    return <span>{String(value)}</span>
  }

  // Render module (event, condition, action) with detailed information
  const renderModule = (module: any, index: number, type: 'event' | 'condition' | 'action') => {
    const moduleName = getModuleName(module.modulePath)
    const complexity = calculateComplexity(module.settings)

    // Complexity color coding
    const complexityColor =
      complexity === 0 ? 'text-gray-500' :
      complexity < 5 ? 'text-green-600' :
      complexity < 15 ? 'text-yellow-600' :
      'text-red-600'

    const typeColors = {
      event: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      condition: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      action: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    }

    return (
      <Card key={index} className="mb-3">
        <CardContent className="pt-4">
          <div className="space-y-3">
            {/* Module Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${typeColors[type]}`}>
                    {type.toUpperCase()}
                  </span>
                  <span className="font-semibold text-base">{moduleName}</span>
                </div>

                {module.modulePath && (
                  <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                    {module.modulePath}
                  </div>
                )}
              </div>

              {/* Complexity Score */}
              <div className="flex flex-col items-end gap-1">
                <div className="text-xs text-muted-foreground">Complexity</div>
                <div className={`text-lg font-bold ${complexityColor}`}>
                  {complexity}
                </div>
              </div>
            </div>

            {/* Settings */}
            {module.settings && Object.keys(module.settings).length > 0 && (
              <div className="border-t pt-3 mt-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Settings</div>
                <div className="space-y-2">
                  {Object.entries(module.settings).map(([key, value]) => {
                    const isExternalScript = key === 'source' && typeof value === 'string' && value.startsWith('http')
                    const scriptUrl = isExternalScript ? value as string : null
                    const analysis = scriptUrl ? scriptAnalyses[scriptUrl] : null

                    return (
                      <div key={key} className="bg-muted/50 rounded p-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-foreground min-w-[100px]">{key}:</span>
                          <div className="flex-1 text-xs">
                            {isExternalScript && scriptUrl ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <a
                                    href={scriptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-600 hover:underline break-all"
                                  >
                                    {scriptUrl}
                                  </a>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => analyzeScript(scriptUrl)}
                                    disabled={analysis?.loading}
                                  >
                                    {analysis?.loading ? 'Analyzing...' : 'Analyze Script'}
                                  </Button>
                                </div>

                                {analysis && !analysis.loading && (
                                  <div className="mt-2 space-y-4">
                                    {analysis.error ? (
                                      <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                                        {analysis.error}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="p-4 bg-muted rounded-md">
                                          <div className="text-sm font-semibold mb-3">AI Analysis:</div>
                                          <div className="prose prose-sm dark:prose-invert max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                              {analysis.analysis}
                                            </ReactMarkdown>
                                          </div>
                                        </div>

                                        {analysis.scriptContent && (
                                          <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="source">
                                              <AccordionTrigger>
                                                <div className="flex flex-col items-start gap-1 w-full">
                                                  <span className="font-medium">View Source Code</span>
                                                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                    <span>
                                                      Actual: {formatBytes(analysis.scriptLength || 0)}
                                                    </span>
                                                    {analysis.gzippedSize && analysis.gzippedSize > 0 && (
                                                      <>
                                                        <span>•</span>
                                                        <span>
                                                          Gzipped: {formatBytes(analysis.gzippedSize)}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="text-green-600 dark:text-green-400">
                                                          Compression: {((1 - analysis.gzippedSize / (analysis.scriptLength || 1)) * 100).toFixed(1)}%
                                                        </span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              </AccordionTrigger>
                                              <AccordionContent>
                                                <div className="space-y-2">
                                                  {analysis.originalContent && (
                                                    <div className="flex gap-2">
                                                      <Button
                                                        size="sm"
                                                        variant={!analysis.showOriginal ? "default" : "outline"}
                                                        onClick={() => {
                                                          setScriptAnalyses(prev => ({
                                                            ...prev,
                                                            [scriptUrl]: {
                                                              ...prev[scriptUrl],
                                                              showOriginal: false
                                                            }
                                                          }))
                                                        }}
                                                      >
                                                        Beautified
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant={analysis.showOriginal ? "default" : "outline"}
                                                        onClick={() => {
                                                          setScriptAnalyses(prev => ({
                                                            ...prev,
                                                            [scriptUrl]: {
                                                              ...prev[scriptUrl],
                                                              showOriginal: true
                                                            }
                                                          }))
                                                        }}
                                                      >
                                                        Original (Minified)
                                                      </Button>
                                                    </div>
                                                  )}
                                                  <div className="max-h-[500px] overflow-auto rounded-md">
                                                    <SyntaxHighlighter
                                                      language="javascript"
                                                      style={vscDarkPlus}
                                                      showLineNumbers
                                                      wrapLines
                                                      customStyle={{
                                                        margin: 0,
                                                        borderRadius: '0.375rem',
                                                        fontSize: '0.75rem'
                                                      }}
                                                    >
                                                      {analysis.showOriginal ? analysis.originalContent : analysis.scriptContent}
                                                    </SyntaxHighlighter>
                                                  </div>
                                                </div>
                                              </AccordionContent>
                                            </AccordionItem>
                                          </Accordion>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : Array.isArray(value) ? (
                              <div className="space-y-1">
                                <div className="text-muted-foreground">Array ({value.length} items)</div>
                                {value.map((item, idx) => (
                                  <div key={idx} className="ml-4 pl-3 border-l-2 border-muted-foreground/20">
                                    {typeof item === 'object' ? (
                                      <pre className="text-xs overflow-x-auto">
                                        {JSON.stringify(item, null, 2)}
                                      </pre>
                                    ) : (
                                      <span className="text-foreground">{String(item)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : typeof value === 'object' && value !== null ? (
                              <pre className="text-xs overflow-x-auto bg-background p-2 rounded">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-foreground break-all">{String(value)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Negate indicator for conditions */}
            {type === 'condition' && module.negate && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <span className="font-semibold">⚠ NEGATED</span>
                <span className="text-xs">(condition is inverted)</span>
              </div>
            )}

            {/* Timeout for actions */}
            {type === 'action' && module.timeout !== undefined && (
              <div className="text-xs text-muted-foreground">
                Timeout: {module.timeout}ms
              </div>
            )}

            {/* Delay for events */}
            {type === 'event' && module.delayNext !== undefined && (
              <div className="text-xs text-muted-foreground">
                Delay Next: {module.delayNext}ms
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Adobe Launch Rules Dashboard</h1>
          <p className="text-muted-foreground">
            View and analyze Adobe Launch rules, data elements, and extensions
          </p>
        </div>

        {!data ? (
          <Card>
            <CardHeader>
              <CardTitle>Analyze Adobe Launch Rules</CardTitle>
              <CardDescription>
                Enter an Adobe Launch URL to extract rules, or upload a previously exported JSON file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="url" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="url">Analyze URL</TabsTrigger>
                  <TabsTrigger value="file">Upload File</TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="https://assets.adobedtm.com/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={loading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUrlExtract()
                          }
                        }}
                      />
                      <Button
                        onClick={handleUrlExtract}
                        disabled={loading || !url.trim()}
                      >
                        {loading ? 'Extracting...' : 'Extract'}
                      </Button>
                    </div>
                    {error && (
                      <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                        {error}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Enter an Adobe Launch library URL (e.g., https://assets.adobedtm.com/xxx/xxx/launch-xxx.min.js)
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <div className="space-y-4">
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      disabled={loading}
                    />
                    {error && (
                      <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                        {error}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Upload a JSON file previously exported from this tool
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {data.metadata && (
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{data.metadata.ruleCount}</div>
                      <div className="text-sm text-muted-foreground">Rules</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.metadata.dataElementCount}</div>
                      <div className="text-sm text-muted-foreground">Data Elements</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.metadata.extensionCount}</div>
                      <div className="text-sm text-muted-foreground">Extensions</div>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="text-sm font-medium">Script Information</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Size:</span>{' '}
                        <span className="font-medium">{formatBytes(data.metadata.scriptSize)}</span>
                      </div>
                      {data.buildInfo && (
                        <>
                          {data.buildInfo.buildDate && (
                            <div>
                              <span className="text-muted-foreground">Build Date:</span>{' '}
                              <span className="font-medium">{new Date(data.buildInfo.buildDate).toLocaleString()}</span>
                            </div>
                          )}
                          {data.buildInfo.turbineVersion && (
                            <div>
                              <span className="text-muted-foreground">Turbine Version:</span>{' '}
                              <span className="font-medium">{data.buildInfo.turbineVersion}</span>
                            </div>
                          )}
                          {data.buildInfo.turbineBuildDate && (
                            <div>
                              <span className="text-muted-foreground">Turbine Build:</span>{' '}
                              <span className="font-medium">{new Date(data.buildInfo.turbineBuildDate).toLocaleString()}</span>
                            </div>
                          )}
                          {data.buildInfo.environment && (
                            <div>
                              <span className="text-muted-foreground">Environment:</span>{' '}
                              <span className="font-medium capitalize">{data.buildInfo.environment}</span>
                            </div>
                          )}
                          {data.buildInfo.minified !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Minified:</span>{' '}
                              <span className="font-medium">{data.buildInfo.minified ? 'Yes' : 'No'}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Source:</span>{' '}
                      <a href={data.metadata.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {data.metadata.sourceUrl}
                      </a>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Extracted: {new Date(data.metadata.extractedAt).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="text"
                  placeholder="Search rules, data elements, or extensions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" onClick={() => {
                  setData(null)
                  setError(null)
                  setUrl('')
                  setScriptAnalyses({})
                  setSelectedEventType('all')
                }}>
                  Analyze New URL
                </Button>
              </div>

              {eventTypes.length > 0 && (
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium whitespace-nowrap">Filter by Event Type:</label>
                  <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="All Event Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Event Types ({data?.rules?.length || 0})</SelectItem>
                      {eventTypes.map((eventType) => {
                        const ruleCount = data?.rules?.filter(rule =>
                          rule.events?.some((event: any) => getEventTypeFromPath(event.modulePath) === eventType)
                        ).length || 0
                        return (
                          <SelectItem key={eventType} value={eventType}>
                            {formatEventType(eventType)} ({ruleCount})
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {selectedEventType !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEventType('all')}
                    >
                      Clear Filter
                    </Button>
                  )}
                </div>
              )}
            </div>

            <Tabs defaultValue="rules" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="rules">Rules ({filteredRules?.length || 0})</TabsTrigger>
                <TabsTrigger value="dataElements">Data Elements ({filteredDataElements.length})</TabsTrigger>
                <TabsTrigger value="extensions">Extensions ({filteredExtensions.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="rules" className="space-y-4">
                {/* Event Timeline Visualization */}
                <Card id="event-timeline" className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>Adobe Launch Event Timeline</span>
                      <span className="text-sm font-normal text-muted-foreground">Understanding when rules fire</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="timeline" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="timeline">Timeline View</TabsTrigger>
                        <TabsTrigger value="byrules">Rules by Event</TabsTrigger>
                      </TabsList>

                      <TabsContent value="timeline" className="space-y-3">
                      {/* Timeline Items */}
                      <div className="flex flex-col space-y-3">
                        {/* Script Loaded */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            ↓
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-blue-500">
                            <div className="font-semibold text-sm">Adobe Launch Script Loaded</div>
                            <div className="text-xs text-muted-foreground">Script downloads and initializes</div>
                          </div>
                        </div>

                        {/* Library Loaded */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            1
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-blue-600">
                            <div className="font-semibold text-sm">libraryLoaded</div>
                            <div className="text-xs text-muted-foreground">First event - library initialization complete</div>
                          </div>
                        </div>

                        {/* Page Top */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            2
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-indigo-600">
                            <div className="font-semibold text-sm">pageTop</div>
                            <div className="text-xs text-muted-foreground">Fires at top of page (synchronous)</div>
                          </div>
                        </div>

                        {/* Browser Parsing */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            ⏳
                          </div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border-l-4 border-gray-400 border-dashed">
                            <div className="font-semibold text-sm italic">Browser Parsing HTML</div>
                            <div className="text-xs text-muted-foreground">Browser renders page content</div>
                          </div>
                        </div>

                        {/* Page Bottom */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            3
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-purple-600">
                            <div className="font-semibold text-sm">pageBottom</div>
                            <div className="text-xs text-muted-foreground">Fires at bottom of page (synchronous)</div>
                          </div>
                        </div>

                        {/* DOM Ready */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            4
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-pink-600">
                            <div className="font-semibold text-sm">domReady</div>
                            <div className="text-xs text-muted-foreground">DOMContentLoaded - HTML parsed, DOM ready</div>
                          </div>
                        </div>

                        {/* Window Loaded */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            5
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-red-600">
                            <div className="font-semibold text-sm">windowLoaded</div>
                            <div className="text-xs text-muted-foreground">Window load - all resources loaded (images, CSS, etc.)</div>
                          </div>
                        </div>

                        {/* Runtime Events Section */}
                        <div className="flex items-center gap-4 mt-4">
                          <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            ⚡
                          </div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border-l-4 border-gray-400">
                            <div className="font-semibold text-sm italic">Runtime Events (Anytime After Load)</div>
                            <div className="text-xs text-muted-foreground">Events that can fire at any point during user session</div>
                          </div>
                        </div>

                        {/* Direct Call */}
                        <div className="flex items-center gap-4 ml-12">
                          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            6
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-orange-500">
                            <div className="font-semibold text-sm">directCall</div>
                            <div className="text-xs text-muted-foreground">Triggered via _satellite.track() - developer-controlled</div>
                          </div>
                        </div>

                        {/* Custom Event */}
                        <div className="flex items-center gap-4 ml-12">
                          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            7
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-amber-500">
                            <div className="font-semibold text-sm">customEvent</div>
                            <div className="text-xs text-muted-foreground">Custom JavaScript events dispatched to window</div>
                          </div>
                        </div>

                        {/* User Driven Events */}
                        <div className="flex items-center gap-4 ml-12">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            8
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-green-500">
                            <div className="font-semibold text-sm">User-Driven Events</div>
                            <div className="text-xs text-muted-foreground">click, change, submit, focus, hover, keypress - triggered by user interaction</div>
                          </div>
                        </div>

                        {/* Runtime Driven Events */}
                        <div className="flex items-center gap-4 ml-12">
                          <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            9
                          </div>
                          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 border-teal-500">
                            <div className="font-semibold text-sm">Runtime-Driven Events</div>
                            <div className="text-xs text-muted-foreground">enterViewport, timeOnPage, media events - triggered by browser/system conditions</div>
                          </div>
                        </div>
                      </div>
                      </TabsContent>

                      <TabsContent value="byrules">
                        {/* Horizontal scrollable list of events with their rules */}
                        <div className="space-y-4">
                          {/* Page Load Events (1-5) */}
                          <div>
                            <div className="text-sm font-semibold text-muted-foreground mb-3 px-1">Page Load Events</div>
                            <div className="overflow-x-auto pb-4">
                              <div className="flex gap-4 min-w-max">
                            {/* Library Loaded */}
                            {(() => {
                              const eventType = 'libraryLoaded'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-blue-600">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                        1
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">libraryLoaded</CardTitle>
                                        <CardDescription className="text-xs">Library initialization complete</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* Page Top */}
                            {(() => {
                              const eventType = 'pageTop'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-indigo-600">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                                        2
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">pageTop</CardTitle>
                                        <CardDescription className="text-xs">Top of page (synchronous)</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* Page Bottom */}
                            {(() => {
                              const eventType = 'pageBottom'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-purple-600">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                                        3
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">pageBottom</CardTitle>
                                        <CardDescription className="text-xs">Bottom of page (synchronous)</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* DOM Ready */}
                            {(() => {
                              const eventType = 'domReady'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-pink-600">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">
                                        4
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">domReady</CardTitle>
                                        <CardDescription className="text-xs">DOMContentLoaded</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* Window Loaded */}
                            {(() => {
                              const eventType = 'windowLoaded'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-red-600">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">
                                        5
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">windowLoaded</CardTitle>
                                        <CardDescription className="text-xs">All resources loaded</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}
                              </div>
                            </div>
                          </div>

                          {/* Runtime Events (6+) */}
                          <div>
                            <div className="text-sm font-semibold text-muted-foreground mb-3 px-1">Runtime Events</div>
                            <div className="overflow-x-auto pb-4">
                              <div className="flex gap-4 min-w-max">
                            {/* Direct Call */}
                            {(() => {
                              const eventType = 'directCall'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-orange-500">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                                        6
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">directCall</CardTitle>
                                        <CardDescription className="text-xs">_satellite.track()</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* Custom Event */}
                            {(() => {
                              const eventType = 'customEvent'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-amber-500">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                                        7
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">customEvent</CardTitle>
                                        <CardDescription className="text-xs">Custom JS events</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* Click */}
                            {(() => {
                              const eventType = 'click'
                              const eventRules = filteredRules?.filter(rule =>
                                rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                              ) || []

                              return eventRules.length > 0 && (
                                <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-green-500">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                                        8
                                      </div>
                                      <div>
                                        <CardTitle className="text-base">click</CardTitle>
                                        <CardDescription className="text-xs">User clicks</CardDescription>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                                      {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {eventRules.map((rule, idx) => {
                                        const ruleIndex = filteredRules?.indexOf(rule) ?? -1
                                        return (
                                        <a
                                          key={idx}
                                          href={`#rule-${ruleIndex}`}
                                          className="block text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            document.getElementById(`rule-${ruleIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }}
                                        >
                                          <div className="font-medium">{rule.name}</div>
                                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                                        </a>
                                      )})}
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* All other event types dynamically */}
                            {(() => {
                              const handledEventTypes = ['libraryLoaded', 'pageTop', 'pageBottom', 'domReady', 'windowLoaded', 'directCall', 'customEvent', 'click']
                              const allEventTypes = new Set<string>()

                              filteredRules?.forEach(rule => {
                                rule.events?.forEach((event: any) => {
                                  const eventType = getEventTypeFromPath(event.modulePath)
                                  if (eventType !== 'unknown' && !handledEventTypes.includes(eventType)) {
                                    allEventTypes.add(eventType)
                                  }
                                })
                              })

                              return Array.from(allEventTypes).map((eventType, index) => {
                                const eventRules = filteredRules?.filter(rule =>
                                  rule.events?.some((e: any) => getEventTypeFromPath(e.modulePath) === eventType)
                                ) || []

                                return (
                                  <Card key={eventType} className="w-80 flex-shrink-0 border-l-4 border-teal-500">
                                    <CardHeader className="pb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                                          {9 + index}
                                        </div>
                                        <div>
                                          <CardTitle className="text-base">{formatEventType(eventType)}</CardTitle>
                                          <CardDescription className="text-xs">Runtime event</CardDescription>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                      <div className="text-sm font-semibold text-muted-foreground mb-2">
                                        {eventRules.length} {eventRules.length === 1 ? 'Rule' : 'Rules'}
                                      </div>
                                      <div className="space-y-1 max-h-64 overflow-y-auto">
                                        {eventRules.map((rule, idx) => (
                                          <div key={idx} className="text-sm p-2 bg-muted/50 rounded hover:bg-muted transition-colors">
                                            <div className="font-medium">{rule.name}</div>
                                            <div className="text-xs text-muted-foreground">{rule.id}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )
                              })
                            })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {filteredRules && filteredRules.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredRules.map((rule, index) => {
                      // Extract event types for this rule
                      const ruleEventTypes = new Set<string>()
                      rule.events?.forEach((event: any) => {
                        if (event.modulePath) {
                          ruleEventTypes.add(getEventTypeFromPath(event.modulePath))
                        }
                      })

                      // Calculate total rule complexity
                      const totalComplexity =
                        (rule.events?.reduce((sum: number, e: any) => sum + calculateComplexity(e.settings), 0) || 0) +
                        (rule.conditions?.reduce((sum: number, c: any) => sum + calculateComplexity(c.settings), 0) || 0) +
                        (rule.actions?.reduce((sum: number, a: any) => sum + calculateComplexity(a.settings), 0) || 0)

                      const complexityColor =
                        totalComplexity === 0 ? 'text-gray-500' :
                        totalComplexity < 10 ? 'text-green-600' :
                        totalComplexity < 30 ? 'text-yellow-600' :
                        'text-red-600'

                      return (
                        <AccordionItem key={rule.id || index} value={`rule-${index}`} id={`rule-${index}`}>
                          <AccordionTrigger>
                            <div className="flex items-start justify-between w-full gap-4">
                              <div className="flex flex-col items-start text-left gap-2 flex-1">
                                <div className="font-medium">{rule.name}</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="text-sm text-muted-foreground">{rule.id}</div>
                                  {ruleEventTypes.size > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                      {Array.from(ruleEventTypes).map((eventType) => (
                                        <span
                                          key={eventType}
                                          className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
                                        >
                                          {formatEventType(eventType)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{rule.events?.length || 0} events</span>
                                  <span>•</span>
                                  <span>{rule.conditions?.length || 0} conditions</span>
                                  <span>•</span>
                                  <span>{rule.actions?.length || 0} actions</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 min-w-[80px]">
                                <div className="text-xs text-muted-foreground">Total Cost</div>
                                <div className={`text-xl font-bold ${complexityColor}`}>
                                  {totalComplexity}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                          <div className="space-y-6">
                            {/* Back to Timeline Link */}
                            <div className="flex justify-end">
                              <a
                                href="#event-timeline"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                                onClick={(e) => {
                                  e.preventDefault()
                                  document.getElementById('event-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                              >
                                <span>↑</span>
                                <span>View in Timeline</span>
                              </a>
                            </div>
                            {/* Events and Conditions Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Events Column */}
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <span>Events</span>
                                  <span className="text-sm font-normal text-muted-foreground">
                                    ({rule.events?.length || 0})
                                  </span>
                                </h4>
                                {rule.events && rule.events.length > 0 ? (
                                  rule.events.map((event: any, idx: number) => renderModule(event, idx, 'event'))
                                ) : (
                                  <div className="text-sm text-muted-foreground italic">No events</div>
                                )}
                              </div>

                              {/* Conditions Column */}
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <span>Conditions</span>
                                  <span className="text-sm font-normal text-muted-foreground">
                                    ({rule.conditions?.length || 0})
                                  </span>
                                </h4>
                                {rule.conditions && rule.conditions.length > 0 ? (
                                  rule.conditions.map((condition: any, idx: number) => renderModule(condition, idx, 'condition'))
                                ) : (
                                  <div className="text-sm text-muted-foreground italic">No conditions</div>
                                )}
                              </div>
                            </div>

                            {/* Actions Row */}
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <span>Actions</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                  ({rule.actions?.length || 0})
                                </span>
                              </h4>
                              {rule.actions && rule.actions.length > 0 ? (
                                rule.actions.map((action: any, idx: number) => renderModule(action, idx, 'action'))
                              ) : (
                                <div className="text-sm text-muted-foreground italic">No actions</div>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      )
                    })}
                  </Accordion>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No rules found
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="dataElements" className="space-y-4">
                {filteredDataElements.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredDataElements.map(([key, value], index) => (
                      <AccordionItem key={key} value={`de-${index}`}>
                        <AccordionTrigger>
                          <div className="font-medium">{key}</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <Card>
                            <CardContent className="pt-4">
                              {renderValue(value)}
                            </CardContent>
                          </Card>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No data elements found
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="extensions" className="space-y-4">
                {filteredExtensions.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredExtensions.map(([key, value], index) => (
                      <AccordionItem key={key} value={`ext-${index}`}>
                        <AccordionTrigger>
                          <div className="font-medium">{key}</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <Card>
                            <CardContent className="pt-4">
                              {renderValue(value)}
                            </CardContent>
                          </Card>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No extensions found
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  )
}
