# Mahasen - AI-Powered Email Assistant

An intelligent email management system powered by Firebase and GenKit AI, featuring advanced personal context learning for personalized email assistance.

## 🌟 Features

### 📧 Email Management
- Gmail integration for email reading and management
- AI-powered email drafting and composition
- Thread-based email organization
- Email categorization and filtering

### 🧠 Personal Context Learning System
- **Automatic Learning**: Analyzes Gmail email patterns to understand communication style
- **Relationship Mapping**: Classifies contacts by relationship type (family, colleagues, clients, etc.)
- **Communication Analysis**: Extracts tone, formality level, and response preferences
- **Professional Profiling**: Identifies job title, company, expertise areas
- **Personalized AI**: Chat assistant adapts responses to match your communication style

### 💬 AI Chat Assistant
- Context-aware conversations
- Personalized responses based on learned preferences
- Professional context integration
- Communication style matching

### 🔧 Integrations
- Firebase/Firestore for data storage
- Gmail API for email access
- GenKit AI for intelligent processing
- Real-time learning and updates

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase project with Firestore enabled
- Gmail API credentials
- GenKit AI configuration (Gemini model)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mahasen-013
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file with:
   ```
   # Firebase Configuration
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY=your-private-key
   FIREBASE_CLIENT_EMAIL=your-client-email
   
   # GenKit AI Configuration
   GOOGLE_GENAI_API_KEY=your-gemini-api-key
   
   # Gmail API Configuration
   GMAIL_CLIENT_ID=your-gmail-client-id
   GMAIL_CLIENT_SECRET=your-gmail-client-secret
   ```

4. **Deploy Firebase configuration**
   ```bash
   # Deploy Firestore rules and indexes
   firebase deploy --only firestore:rules,firestore:indexes
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Personal Context System

The Personal Context Learning System is the core innovation of Mahasen, providing intelligent personalization through automated email analysis.

### How It Works

1. **Gmail Analysis**: Connects to your Gmail account to analyze email threads where you've participated
2. **Pattern Recognition**: Uses AI to identify communication patterns, relationships, and preferences
3. **Profile Building**: Creates a comprehensive personal context profile
4. **Personalization**: Applies learned context to AI responses and recommendations

### Key Benefits

- **Automatic Adaptation**: AI learns your communication style without manual input
- **Relationship Awareness**: Understands different communication patterns for different contacts
- **Professional Context**: Recognizes work relationships and adjusts formality accordingly
- **Privacy-First**: Only analyzes patterns, doesn't store email content

### Getting Started with Personal Context

1. **Navigate to Personal Context**
   - Go to `/personal-context` in the application
   - Access the comprehensive management interface

2. **Sign In with Google**
   - If not already signed in, click "Sign In with Google" 
   - Grant Gmail permissions during the OAuth flow
   - Your Gmail access will be automatically configured

3. **Start Learning**
   - Configure analysis options (time range, depth)
   - Click "Start Learning" to begin the automated analysis process
   - Monitor progress in real-time

4. **Experience Personalization**
   - Chat with the AI assistant
   - Notice personalized responses matching your style
   - See relationship-aware communication with "Personalized" indicators

## 🏗️ Architecture

### Core Services

- **PersonalContextService**: Orchestrates the learning process
- **GmailService**: Handles Gmail API integration and email fetching
- **PersonalContextAnalysisService**: AI-powered email pattern analysis
- **PersonalContextStore**: Firestore data persistence layer

### API Endpoints

- `/api/personal-context/learn` - Start learning from Gmail
- `/api/personal-context/profile` - Manage personal context profile
- `/api/personal-context/statistics` - Get user statistics
- `/api/personal-context/test-connection` - Test Gmail connection
- `/api/chat` - AI chat with personal context integration

### Data Storage

- **Firestore Collections**:
  - `personal_contexts` - User profiles and preferences
  - `contact_relationships` - Relationship classifications
  - `communication_patterns` - Contact-specific communication styles
  - `learning_progress` - Analysis progress tracking

## 🔒 Privacy & Security

### Data Protection
- Personal context data stored securely in Firebase Firestore
- Email content analyzed but not permanently stored
- OAuth flow ensures secure Gmail access without storing long-term tokens
- User data isolated by userId with Firestore security rules

### Privacy Controls
- Users can delete all personal context data
- Clear documentation of what data is collected
- OAuth-based Gmail integration with proper permission management
- Transparent learning process with progress tracking

## 📚 Documentation

- **[Personal Context Guide](docs/PERSONAL_CONTEXT_GUIDE.md)** - Comprehensive user guide
- **[Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)** - Production deployment guide
- **[Personal Context.md](Personal%20Context.md)** - Technical specifications

## 🛠️ Development

### Project Structure
```
src/
├── app/                          # Next.js app directory
│   ├── api/                     # API routes
│   │   ├── chat/               # Chat API with personal context
│   │   └── personal-context/   # Personal context APIs
│   ├── chat/                   # Chat interface
│   ├── personal-context/       # Personal context management
│   └── mail/                   # Email management
├── services/                   # Backend services
│   └── personal-context/       # Personal context services
├── components/                 # React components
├── hooks/                      # Custom React hooks
├── contexts/                   # React context providers
├── types/                      # TypeScript type definitions
└── lib/                        # Utility libraries

firebase.json                   # Firebase configuration
firestore.rules                # Firestore security rules
firestore.indexes.json         # Firestore indexes
```

### Key Components

- **PersonalContextPage**: Main UI for personal context management
- **ChatView**: AI chat interface with personalization
- **usePersonalContext**: React hook for personal context state
- **PersonalContextProvider**: Global context provider

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🚀 Deployment

### Prerequisites
1. Firebase project configured
2. Gmail API credentials set up
3. GenKit AI model access configured
4. Environment variables configured for production

### Deployment Steps
1. Follow the [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)
2. Deploy Firestore rules and indexes
3. Configure production environment variables
4. Deploy to your hosting platform
5. Verify all integrations work correctly

### Environment Configuration

**Development:**
- Local Firebase emulators (optional)
- Development Gmail API credentials
- Test GenKit AI configuration

**Production:**
- Production Firebase project
- Production Gmail API credentials
- Production GenKit AI configuration
- Proper security rules and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Update documentation as needed
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Use provided React hooks and contexts
- Implement proper error handling
- Add comprehensive tests
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues
- **Gmail Connection Failed**: Check API credentials and permissions
- **Personal Context Not Loading**: Verify Firestore configuration
- **AI Responses Not Personalized**: Ensure personal context learning completed

### Getting Help
- Check the [Personal Context Guide](docs/PERSONAL_CONTEXT_GUIDE.md)
- Review browser console for error messages
- Use the built-in connection test features
- Check Firebase and Gmail API status

### Contact
For questions, issues, or contributions, please:
- Open an issue on the repository
- Check existing documentation
- Review the troubleshooting guides

---

**Mahasen** - Intelligent email assistance with personal context learning. Built with ❤️ using Firebase, GenKit AI, and Next.js.
