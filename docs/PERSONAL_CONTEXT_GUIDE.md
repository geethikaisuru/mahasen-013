# Personal Context Learning System - User Guide

## 🎯 Overview

The Personal Context Learning System is an advanced AI feature that automatically learns from your Gmail communication patterns to provide highly personalized assistance. Using secure OAuth authentication, the system analyzes your email interactions to understand your communication style, relationships, and preferences.

## 🚀 Quick Start

### Step 1: Authentication
1. **Navigate** to `/personal-context` in the application
2. **Sign In** with your Google account if you haven't already
3. **Grant Permissions** when prompted during OAuth flow:
   - Gmail read access
   - User profile information

### Step 2: Configure Learning
1. **Choose Time Range**: Select how far back to analyze (1 month to 1 year)
2. **Set Analysis Depth**: Choose from Basic, Standard, or Comprehensive
3. **Configure Options**: Decide whether to include promotional emails

### Step 3: Start Learning
1. **Test Connection**: Verify your Gmail access is working
2. **Start Learning**: Begin the automated analysis process
3. **Monitor Progress**: Watch real-time updates as your context is built

### Step 4: Experience Personalization
1. **Use AI Chat**: Experience personalized responses in the chat interface
2. **See Indicators**: Look for "Personalized" tags on AI responses
3. **Review Profile**: Check your learned communication patterns in the Profile tab

## Features

### 🧠 Automatic Learning
- Analyzes Gmail email threads where you've participated
- Filters out promotional emails to focus on meaningful conversations
- Builds a comprehensive profile of your communication patterns

### 📊 Communication Analysis
- **Communication Style**: Tone, formality level, response length preferences
- **Contact Relationships**: Classifies contacts by relationship type (family, colleagues, clients, etc.)
- **Professional Profile**: Extracts job title, company, expertise areas
- **Personal Preferences**: Identifies scheduling patterns and decision-making style

### 🎯 Personalized AI Responses
- Chat assistant adapts responses to match your communication style
- Considers your professional context and expertise
- Respects your preferences for formality and response length

## Understanding Your Profile

### Communication Style
Your global communication patterns across all contacts:
- **Tone**: formal, casual, friendly, professional, direct, diplomatic
- **Formality Level**: 1-10 scale of how formal your communication is
- **Response Length**: brief, moderate, detailed
- **Greeting/Closing Styles**: Common ways you start and end emails

### Professional Profile
Work-related information extracted from your emails:
- Job title and company
- Industry and department
- Management level
- Areas of expertise
- Working hours and meeting preferences

### Relationships
Contact classification based on communication patterns:
- **Family**: Personal family relationships
- **Close Friends**: Personal close relationships
- **Work Colleagues**: Day-to-day work contacts
- **Clients/Customers**: External business relationships
- **Executives/Bosses**: Management and leadership contacts
- **Vendors/Service Providers**: Business service relationships

### Personal Preferences
- Response timing patterns (business hours, weekends, urgency)
- Decision-making style (quick, deliberate, collaborative, etc.)
- Scheduling preferences and meeting patterns
- Personal interests and topics of conversation

## Privacy and Security

### Data Protection
- Personal context data is stored securely in Firebase Firestore
- Email content is analyzed but not permanently stored
- Only email metadata and patterns are retained
- Gmail access tokens are not stored permanently

### Access Control
- Each user's context is isolated and private
- Firestore security rules prevent unauthorized access
- Data can be deleted at any time using the "Delete All Data" function

### What Data is Stored
- Communication style patterns and preferences
- Contact relationship classifications (email addresses only)
- Professional profile information
- Personal preference patterns
- Learning metadata and confidence scores

### What Data is NOT Stored
- Full email content or bodies
- Gmail access tokens
- Sensitive personal information beyond communication patterns
- Private email content or attachments

## API Integration

### Using Personal Context in Your App

#### Chat Integration
The chat assistant automatically uses personal context when available:

```typescript
// Chat API automatically includes personal context
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: userMessage,
    userId: currentUserId 
  })
});
```

#### Direct API Access
Access personal context programmatically:

```typescript
import { personalContextService } from '@/services/personal-context/personal-context-service';

// Get user's personal context
const profile = await personalContextService.getPersonalContext(userId);

// Get user statistics
const stats = await personalContextService.getUserStatistics(userId);

// Start learning process
const result = await personalContextService.learnPersonalContext({
  userId,
  accessToken,
  options: {
    timeRange: 'last_3months',
    analysisDepth: 'standard',
    includePromotional: false,
    minThreadLength: 2
  }
});
```

#### React Hook
Use the provided React hook for state management:

```typescript
import { usePersonalContext } from '@/hooks/usePersonalContext';

function MyComponent() {
  const {
    profile,
    statistics,
    isLoading,
    error,
    learnPersonalContext,
    getPersonalContext
  } = usePersonalContext();

  // Component logic here
}
```

#### Global Context Provider
Use the context provider for app-wide personal context state:

```typescript
import { PersonalContextProvider, usePersonalContextGlobal } from '@/contexts/PersonalContextProvider';

// Wrap your app
function App() {
  return (
    <PersonalContextProvider defaultUserId="user-123">
      <YourAppContent />
    </PersonalContextProvider>
  );
}

// Use in components
function MyComponent() {
  const { profile, hasPersonalContext } = usePersonalContextGlobal();
  // Component logic here
}
```

## API Endpoints

### Learning Endpoints
- `POST /api/personal-context/learn` - Start learning from Gmail
- `POST /api/personal-context/test-connection` - Test Gmail connection

### Data Endpoints
- `GET /api/personal-context/profile?userId={id}` - Get personal context profile
- `PUT /api/personal-context/profile` - Update personal context profile
- `GET /api/personal-context/statistics?userId={id}` - Get user statistics

## Troubleshooting

### Common Issues

#### Gmail Connection Failed
- Verify your access token is valid and has read permissions
- Check that Gmail API is enabled for your project
- Ensure the token hasn't expired

#### No Personal Context Found
- Make sure you've completed the learning process
- Check that your Gmail account has sufficient email history
- Verify the time range includes relevant email activity

#### Low Confidence Scores
- Increase the analysis time range
- Switch to "comprehensive" analysis depth
- Ensure you have varied email conversations in the selected time range

#### Learning Process Stuck
- Check the browser console for error messages
- Verify your internet connection
- Try reducing the time range or analysis depth

### Getting Help
- Check the browser console for detailed error messages
- Review the Personal Context page's Overview tab for system status
- Use the "Test Connection" feature to verify Gmail integration

## Best Practices

### For Optimal Learning
1. **Sufficient Data**: Use at least 3 months of email history
2. **Varied Conversations**: Ensure your email includes different types of communications
3. **Regular Updates**: Re-run learning periodically to capture evolving patterns
4. **Quality over Quantity**: Focus on meaningful email threads rather than promotional emails

### For Privacy
1. **Regular Reviews**: Periodically review your learned profile
2. **Data Cleanup**: Delete personal context data when no longer needed
3. **Access Control**: Keep your Gmail tokens secure and don't share them
4. **Manual Override**: Use manual input for sensitive context information

### For Integration
1. **Gradual Rollout**: Start with basic features before advanced integration
2. **User Control**: Always provide users control over their personal context
3. **Fallback Behavior**: Ensure your app works well without personal context
4. **Performance**: Cache personal context data to avoid repeated API calls

## Advanced Configuration

### Custom Learning Parameters
Modify learning behavior by adjusting options:

```typescript
const advancedOptions = {
  timeRange: 'last_6months',
  analysisDepth: 'comprehensive',
  includePromotional: false,
  minThreadLength: 3,
  // Add custom filters or processing rules
};
```

### Integration with Other Systems
The personal context system is designed to integrate with:
- Email composition assistants
- Calendar scheduling tools
- CRM systems
- Communication platforms
- Workflow automation tools

## Future Enhancements

### Planned Features
- Real-time learning from new emails
- Integration with other email providers (Outlook, etc.)
- Advanced relationship mapping
- Team and organizational context learning
- Cross-platform synchronization

### Extensibility
The system is built with extensibility in mind:
- Pluggable analysis engines
- Custom insight extractors
- Integration APIs for third-party services
- Configurable learning algorithms 