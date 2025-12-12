import { NextRequest, NextResponse } from 'next/server'
import { getAllAnalyses } from '@/lib/models/scriptAnalysis'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  try {
    const analyses = await getAllAnalyses()

    if (analyses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No analyses found to export' },
        { status: 404 }
      )
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Adobe Launch Dashboard'
    workbook.created = new Date()

    // Main Analysis Sheet
    const mainSheet = workbook.addWorksheet('Script Analyses')

    // Define columns with separate analysis sections
    mainSheet.columns = [
      { header: 'Script URL', key: 'scriptUrl', width: 60 },
      { header: 'Triggered By Rule', key: 'triggeredByRule', width: 30 },
      { header: 'Triggered By Event', key: 'triggeredByEvent', width: 20 },
      { header: 'Script Size (bytes)', key: 'scriptLength', width: 15 },
      { header: 'Gzipped Size (bytes)', key: 'gzippedSize', width: 15 },
      { header: 'Summary', key: 'summary', width: 50 },
      { header: 'Purpose', key: 'purpose', width: 50 },
      { header: 'Key Actions', key: 'keyActions', width: 50 },
      { header: 'Data Collection', key: 'dataCollection', width: 50 },
      { header: 'Privacy Considerations', key: 'privacyConsiderations', width: 50 },
      { header: 'Loads Scripts', key: 'loadsScripts', width: 12 },
      { header: 'Path-Based Config', key: 'hasPathBasedConfig', width: 15 },
      { header: 'Path Config Details', key: 'pathConfigDetails', width: 40 },
      { header: 'Has Adobe Analytics', key: 'hasAdobeAnalytics', width: 18 },
      { header: 'Has EDDL Processing', key: 'hasEddlProcessing', width: 18 },
      { header: 'External Services', key: 'externalServices', width: 40 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ]

    // Style header row
    mainSheet.getRow(1).font = { bold: true }
    mainSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    mainSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    // Add data rows
    analyses.forEach(analysis => {
      // Extract sections - use analysisSections if available, otherwise parse from analysis string
      const sections = analysis.analysisSections || {}

      // Fallback: parse from markdown if analysisSections not available
      let summary = sections.summary || ''
      let purpose = sections.purpose || ''
      let keyActions = sections.keyActions || []
      let dataCollection = sections.dataCollection || ''
      let privacyConsiderations = sections.privacyConsiderations || ''

      // If no structured sections, try to extract from markdown analysis
      if (!summary && analysis.analysis) {
        const summaryMatch = analysis.analysis.match(/## Summary\n([^#]*)/i)
        if (summaryMatch) summary = summaryMatch[1].trim()

        const purposeMatch = analysis.analysis.match(/## Purpose\n([^#]*)/i)
        if (purposeMatch) purpose = purposeMatch[1].trim()

        const keyActionsMatch = analysis.analysis.match(/## Key Actions\n([^#]*)/i)
        if (keyActionsMatch) {
          const actionsText = keyActionsMatch[1].trim()
          keyActions = actionsText.split('\n').map(a => a.replace(/^-\s*/, '').trim()).filter(a => a)
        }

        const dataCollectionMatch = analysis.analysis.match(/## Data Collection\n([^#]*)/i)
        if (dataCollectionMatch) dataCollection = dataCollectionMatch[1].trim()

        const privacyMatch = analysis.analysis.match(/## Privacy Considerations\n([^#]*)/i)
        if (privacyMatch) privacyConsiderations = privacyMatch[1].trim()
      }

      mainSheet.addRow({
        scriptUrl: analysis.scriptUrl,
        triggeredByRule: analysis.triggeredByRule || '',
        triggeredByEvent: analysis.triggeredByEvent || '',
        scriptLength: analysis.scriptLength,
        gzippedSize: analysis.gzippedSize,
        summary,
        purpose,
        keyActions: Array.isArray(keyActions) ? keyActions.join('; ') : keyActions,
        dataCollection,
        privacyConsiderations,
        loadsScripts: analysis.loadsScripts ? 'Yes' : 'No',
        hasPathBasedConfig: analysis.hasPathBasedConfig ? 'Yes' : 'No',
        pathConfigDetails: analysis.pathConfigDetails || '',
        hasAdobeAnalytics: analysis.adobeAnalytics?.hasAdobeAnalytics ? 'Yes' : 'No',
        hasEddlProcessing: analysis.eddlDataLayer?.hasEddlProcessing ? 'Yes' : 'No',
        externalServices: analysis.externalServices?.join(', ') || '',
        createdAt: analysis.createdAt ? new Date(analysis.createdAt).toLocaleString() : '',
      })
    })

    // Adobe Analytics Details Sheet
    const aaSheet = workbook.addWorksheet('Adobe Analytics Details')

    aaSheet.columns = [
      { header: 'Script URL', key: 'scriptUrl', width: 60 },
      { header: 'Triggered By Rule', key: 'triggeredByRule', width: 30 },
      { header: 'Has Adobe Analytics', key: 'hasAdobeAnalytics', width: 18 },
      { header: 'Variable Modifications', key: 'variableModifications', width: 40 },
      { header: 'Tracking Calls', key: 'trackingCalls', width: 30 },
      { header: 'Events Set', key: 'eventsSet', width: 30 },
      { header: 'eVars Set', key: 'eVarsSet', width: 30 },
      { header: 'Props Set', key: 'propsSet', width: 30 },
      { header: 'Products String', key: 'productsString', width: 40 },
      { header: 'Details', key: 'details', width: 50 },
    ]

    // Style header row
    aaSheet.getRow(1).font = { bold: true }
    aaSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    }
    aaSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    // Add Adobe Analytics data
    analyses.forEach(analysis => {
      const aa = analysis.adobeAnalytics
      aaSheet.addRow({
        scriptUrl: analysis.scriptUrl,
        triggeredByRule: analysis.triggeredByRule || '',
        hasAdobeAnalytics: aa?.hasAdobeAnalytics ? 'Yes' : 'No',
        variableModifications: aa?.variableModifications?.join(', ') || '',
        trackingCalls: aa?.trackingCalls?.join(', ') || '',
        eventsSet: aa?.eventsSet?.join(', ') || '',
        eVarsSet: aa?.eVarsSet?.join(', ') || '',
        propsSet: aa?.propsSet?.join(', ') || '',
        productsString: aa?.productsString || '',
        details: aa?.details || '',
      })
    })

    // EDDL/Data Layer Sheet
    const eddlSheet = workbook.addWorksheet('EDDL Data Layer')

    eddlSheet.columns = [
      { header: 'Script URL', key: 'scriptUrl', width: 60 },
      { header: 'Triggered By Rule', key: 'triggeredByRule', width: 30 },
      { header: 'Has EDDL Processing', key: 'hasEddlProcessing', width: 18 },
      { header: 'Operations', key: 'operations', width: 30 },
      { header: 'Data Layer Variables', key: 'dataLayerVariables', width: 50 },
      { header: 'Event Listeners', key: 'eventListeners', width: 40 },
      { header: 'Details', key: 'details', width: 50 },
    ]

    // Style header row
    eddlSheet.getRow(1).font = { bold: true }
    eddlSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9B59B6' }
    }
    eddlSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    // Add EDDL data
    analyses.forEach(analysis => {
      const eddl = analysis.eddlDataLayer
      eddlSheet.addRow({
        scriptUrl: analysis.scriptUrl,
        triggeredByRule: analysis.triggeredByRule || '',
        hasEddlProcessing: eddl?.hasEddlProcessing ? 'Yes' : 'No',
        operations: eddl?.operations?.join(', ') || '',
        dataLayerVariables: eddl?.dataLayerVariables?.join(', ') || '',
        eventListeners: eddl?.eventListeners?.join(', ') || '',
        details: eddl?.details || '',
      })
    })

    // External Services Sheet
    const servicesSheet = workbook.addWorksheet('External Services')

    servicesSheet.columns = [
      { header: 'Script URL', key: 'scriptUrl', width: 60 },
      { header: 'Triggered By Rule', key: 'triggeredByRule', width: 30 },
      { header: 'External Service', key: 'service', width: 50 },
    ]

    // Style header row
    servicesSheet.getRow(1).font = { bold: true }
    servicesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFED7D31' }
    }
    servicesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    // Add external services data (one row per service)
    analyses.forEach(analysis => {
      if (analysis.externalServices && analysis.externalServices.length > 0) {
        analysis.externalServices.forEach(service => {
          servicesSheet.addRow({
            scriptUrl: analysis.scriptUrl,
            triggeredByRule: analysis.triggeredByRule || '',
            service,
          })
        })
      }
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    const filename = `adobe-launch-analyses-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export analyses' },
      { status: 500 }
    )
  }
}
