// Helper functions for parsing and describing Adobe Launch rules

class RuleHelpers {
  // Map module paths to human-readable event types
  static getEventType(modulePath) {
    const eventTypes = {
      'core/src/lib/events/libraryLoaded.js': 'Library Loaded (Page Top)',
      'core/src/lib/events/pageBottom.js': 'Page Bottom',
      'core/src/lib/events/domReady.js': 'DOM Ready',
      'core/src/lib/events/windowLoaded.js': 'Window Loaded',
      'core/src/lib/events/directCall.js': 'Direct Call',
      'core/src/lib/events/customEvent.js': 'Custom Event',
      'core/src/lib/events/click.js': 'Click',
      'core/src/lib/events/submit.js': 'Form Submission',
      'core/src/lib/events/change.js': 'Change',
      'core/src/lib/events/focus.js': 'Focus',
      'core/src/lib/events/blur.js': 'Blur',
      'core/src/lib/events/keypress.js': 'Keypress',
      'core/src/lib/events/hover.js': 'Hover',
      'core/src/lib/events/entersViewport.js': 'Enters Viewport',
      'core/src/lib/events/timeOnPage.js': 'Time on Page',
      'core/src/lib/events/tabBlur.js': 'Tab Blur',
      'core/src/lib/events/tabFocus.js': 'Tab Focus',
      'core/src/lib/events/mediaEnded.js': 'Media Ended',
      'core/src/lib/events/mediaPaused.js': 'Media Paused',
      'core/src/lib/events/mediaPlayed.js': 'Media Played',
      'core/src/lib/events/mediaVolumeChanged.js': 'Media Volume Changed',
      'core/src/lib/events/dataElementChange.js': 'Data Element Change',
      'core/src/lib/events/zoom.js': 'Zoom',
      'core/src/lib/events/orientationChange.js': 'Orientation Change',
      'core/src/lib/events/pushState.js': 'Push State',
      'core/src/lib/events/historyChange.js': 'History Change'
    };

    return eventTypes[modulePath] || 'Custom Event';
  }

  // Get condition type description
  static getConditionType(modulePath) {
    const conditionTypes = {
      'core/src/lib/conditions/path.js': 'URL Path',
      'core/src/lib/conditions/pathAndQuerystring.js': 'Path & Query String',
      'core/src/lib/conditions/protocol.js': 'Protocol',
      'core/src/lib/conditions/subdomain.js': 'Subdomain',
      'core/src/lib/conditions/queryStringParameter.js': 'Query String Parameter',
      'core/src/lib/conditions/hash.js': 'Hash',
      'core/src/lib/conditions/cookie.js': 'Cookie',
      'core/src/lib/conditions/customCode.js': 'Custom Code',
      'core/src/lib/conditions/dateRange.js': 'Date Range',
      'core/src/lib/conditions/deviceType.js': 'Device Type',
      'core/src/lib/conditions/domain.js': 'Domain',
      'core/src/lib/conditions/landingPage.js': 'Landing Page',
      'core/src/lib/conditions/loggedIn.js': 'Logged In',
      'core/src/lib/conditions/maxFrequency.js': 'Max Frequency',
      'core/src/lib/conditions/newOrReturningVisitor.js': 'New/Returning Visitor',
      'core/src/lib/conditions/operatingSystem.js': 'Operating System',
      'core/src/lib/conditions/pageViews.js': 'Page Views',
      'core/src/lib/conditions/previousOccurrences.js': 'Previous Occurrences',
      'core/src/lib/conditions/previousSessions.js': 'Previous Sessions',
      'core/src/lib/conditions/screenResolution.js': 'Screen Resolution',
      'core/src/lib/conditions/sessionDuration.js': 'Session Duration',
      'core/src/lib/conditions/timeOnSite.js': 'Time on Site',
      'core/src/lib/conditions/trafficSource.js': 'Traffic Source',
      'core/src/lib/conditions/variable.js': 'Variable',
      'core/src/lib/conditions/windowSize.js': 'Window Size',
      'core/src/lib/conditions/samplingRate.js': 'Sampling Rate',
      'core/src/lib/conditions/valueComparison.js': 'Value Comparison',
      'core/src/lib/conditions/dataElementValue.js': 'Data Element Value'
    };

    return conditionTypes[modulePath] || 'Custom Condition';
  }

  // Get action type description
  static getActionType(modulePath) {
    const actionTypes = {
      'core/src/lib/actions/customCode.js': 'Custom Code',
      'adobe-analytics/src/lib/actions/sendBeacon.js': 'Send Analytics Beacon',
      'adobe-analytics/src/lib/actions/setVariables.js': 'Set Analytics Variables',
      'adobe-analytics/src/lib/actions/clearVariables.js': 'Clear Analytics Variables',
      'adobe-target/src/lib/actions/loadTarget.js': 'Load Target',
      'adobe-target/src/lib/actions/firePageLoad.js': 'Fire Target Page Load',
      'adobe-audience-manager/src/lib/actions/sendData.js': 'Send to Audience Manager'
    };

    return actionTypes[modulePath] || 'Custom Action';
  }

  // Format event description with settings
  static formatEventDescription(event) {
    const type = this.getEventType(event.modulePath);
    const settings = event.settings || {};
    let description = type;

    // Add specific details based on event type
    if (settings.identifier) {
      description += ` - Identifier: "${settings.identifier}"`;
    }
    if (settings.elementSelector) {
      description += ` - Selector: \`${settings.elementSelector}\``;
    }
    if (settings.eventType) {
      description += ` - Event: "${settings.eventType}"`;
    }
    if (settings.delay !== undefined) {
      description += ` - Delay: ${settings.delay}ms`;
    }
    if (settings.bubbleFireIfParent) {
      description += ' - Bubbles to parent';
    }
    if (settings.bubbleFireIfChildFired) {
      description += ' - Fires if child fired';
    }

    return description;
  }

  // Get detailed event information
  static getDetailedEventInfo(event) {
    const type = this.getEventType(event.modulePath);
    const settings = event.settings || {};
    const details = {
      type,
      modulePath: event.modulePath,
      settings: {}
    };

    // Extract key settings based on event type
    if (settings.elementSelector) {
      details.settings.selector = settings.elementSelector;
    }
    if (settings.identifier) {
      details.settings.identifier = settings.identifier;
    }
    if (settings.eventType) {
      details.settings.eventType = settings.eventType;
    }
    if (settings.delay !== undefined) {
      details.settings.delay = settings.delay;
    }
    if (settings.bubbleFireIfParent !== undefined) {
      details.settings.bubbleToParent = settings.bubbleFireIfParent;
    }
    if (settings.bubbleFireIfChildFired !== undefined) {
      details.settings.fireIfChildFired = settings.bubbleFireIfChildFired;
    }
    if (settings.bubbleStop !== undefined) {
      details.settings.stopPropagation = settings.bubbleStop;
    }

    return details;
  }

  // Format condition description with settings
  static formatConditionDescription(condition) {
    const type = this.getConditionType(condition.modulePath);
    const settings = condition.settings || {};
    let description = type;

    // Add specific details based on condition type
    if (settings.paths && Array.isArray(settings.paths)) {
      const pathCount = settings.paths.length;
      if (pathCount === 1) {
        description += `: "${settings.paths[0].value}"`;
      } else {
        description += `: ${pathCount} paths`;
      }
    }
    if (settings.value) {
      description += `: "${settings.value}"`;
    }
    if (settings.name) {
      description += `: "${settings.name}"`;
    }
    if (settings.start && settings.end) {
      description += `: ${settings.start} to ${settings.end}`;
    } else if (settings.start) {
      description += `: After ${settings.start}`;
    } else if (settings.end) {
      description += `: Before ${settings.end}`;
    }

    return description;
  }

  // Format action description with settings
  static formatActionDescription(action) {
    const type = this.getActionType(action.modulePath);
    let description = type;

    if (action.settings) {
      if (action.settings.trackerProperties && action.settings.trackerProperties.eVars) {
        const evarCount = Object.keys(action.settings.trackerProperties.eVars).length;
        description += ` (${evarCount} eVars)`;
      }
      if (action.settings.source && action.settings.isExternal) {
        description += ' (External Script)';
      }
    }

    return description;
  }

  // Generate a "when fired" summary for a rule
  static getWhenFiredSummary(rule) {
    const events = rule.events || [];
    const conditions = rule.conditions || [];

    let summary = '**Fires when:**\n';

    // Events
    if (events.length === 0) {
      summary += '- No specific event trigger\n';
    } else if (events.length === 1) {
      summary += `- ${this.formatEventDescription(events[0])}\n`;
    } else {
      summary += `- Any of these events occur:\n`;
      events.forEach(event => {
        summary += `  - ${this.formatEventDescription(event)}\n`;
      });
    }

    // Conditions
    if (conditions.length > 0) {
      summary += '\n**And all these conditions are met:**\n';
      conditions.forEach(condition => {
        summary += `- ${this.formatConditionDescription(condition)}\n`;
      });
    }

    return summary;
  }

  // Determine rule frequency/timing
  static getRuleFrequency(rule) {
    const events = rule.events || [];
    const conditions = rule.conditions || [];

    // Check for page load events
    const hasPageLoad = events.some(e =>
      e.modulePath?.includes('libraryLoaded') ||
      e.modulePath?.includes('windowLoaded') ||
      e.modulePath?.includes('domReady')
    );

    // Check for frequency conditions
    const hasFrequency = conditions.some(c =>
      c.modulePath?.includes('maxFrequency') ||
      c.modulePath?.includes('previousOccurrences')
    );

    if (hasPageLoad && !hasFrequency) {
      return 'Every page load';
    } else if (hasPageLoad && hasFrequency) {
      return 'Page load (with frequency limit)';
    } else if (events.some(e => e.modulePath?.includes('click'))) {
      return 'On user click';
    } else if (events.some(e => e.modulePath?.includes('directCall'))) {
      return 'On direct call trigger';
    } else if (events.length === 0) {
      return 'On specific conditions';
    }

    return 'Event-driven';
  }
}

module.exports = RuleHelpers;
