"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  UserCog, 
  Save, 
  Brain, 
  Mail, 
  Users, 
  Briefcase, 
  Clock, 
  BarChart3,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Download,
  LogIn,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { usePersonalContext } from '@/hooks/usePersonalContext';
import { useAuth } from '@/contexts/auth-context';
import type { PersonalContextLearningInput } from '@/types/personal-context';

export default function PersonalContextPage() {
  const [manualContext, setManualContext] = useState("");
  const [learningOptions, setLearningOptions] = useState({
    timeRange: 'last_3months' as PersonalContextLearningInput['options']['timeRange'],
    analysisDepth: 'standard' as PersonalContextLearningInput['options']['analysisDepth'],
    includePromotional: false,
    minThreadLength: 2
  });
  const [learningLogs, setLearningLogs] = useState<{ message: string; source: string }[]>([]);
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [lastLogTimestamp, setLastLogTimestamp] = useState<string>('');
  const [isPollingLogs, setIsPollingLogs] = useState(false);

  const { toast } = useToast();
  const { currentUser, googleAccessToken, handleSignIn } = useAuth();
  const {
    profile,
    progress,
    statistics,
    isLoading,
    error,
    learnPersonalContext,
    getPersonalContext,
    getUserStatistics,
    testGmailConnection,
    deletePersonalContextData,
    clearError
  } = usePersonalContext();

  // Use actual user ID from auth
  const userId = currentUser?.uid;

  // Ref for the logs container to enable auto-scrolling
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Function to check if user is at the bottom of the logs
  const isScrolledToBottom = () => {
    if (!logsContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
  };
  
  // Function to scroll to the bottom of logs
  const scrollToBottom = () => {
    if (logsContainerRef.current && showDetailedLogs && shouldAutoScroll) {
      logsContainerRef.current.scrollTo({
        top: logsContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
  
  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = () => {
    setShouldAutoScroll(isScrolledToBottom());
  };
  
  // Effect to auto-scroll when new logs are added
  useEffect(() => {
    if (showDetailedLogs && learningLogs.length > 0) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(scrollToBottom, 100);
    }
  }, [learningLogs, showDetailedLogs, shouldAutoScroll]);
  
  // Effect to scroll to bottom when logs section is first expanded
  useEffect(() => {
    if (showDetailedLogs && learningLogs.length > 0) {
      // Reset auto-scroll to true when expanding
      setShouldAutoScroll(true);
      // Scroll to bottom after a delay to ensure the section is fully expanded
      setTimeout(scrollToBottom, 200);
    }
  }, [showDetailedLogs]);

  useEffect(() => {
    // Load existing context and statistics on component mount
    if (userId) {
      getPersonalContext(userId);
      getUserStatistics(userId);
    }
  }, [userId, getPersonalContext, getUserStatistics]);

  // Effect to listen for progress updates and log them
  useEffect(() => {
    if (progress && isLoading) {
      const phase = progress.currentPhase.charAt(0).toUpperCase() + progress.currentPhase.slice(1);
      addLog(`Phase: ${phase} - Progress: ${progress.progress}%`, 'client');
      
      if (progress.threadsDiscovered > 0) {
        addLog(`Discovered ${progress.threadsDiscovered} email threads for analysis`, 'client');
      }
      
      if (progress.threadsAnalyzed > 0) {
        addLog(`Analyzed ${progress.threadsAnalyzed} threads containing ${progress.emailsAnalyzed} emails`, 'client');
      }
      
      if (progress.contactsClassified > 0) {
        addLog(`Classified ${progress.contactsClassified} contacts from your email history`, 'client');
      }
    }
  }, [progress, isLoading]);

  // Listen for custom log events from services
  useEffect(() => {
    const handleLogEvent = (event: CustomEvent<{message: string, source?: string}>) => {
      if (event.detail && event.detail.message) {
        const { message, source } = event.detail;
        
        // Format based on source
        let formattedSource = source || 'client';
        
        // Detect source based on log message prefix if not explicitly set
        if (source === 'console') {
          if (message.includes('[GmailService]')) {
            formattedSource = 'gmail';
          } else if (message.includes('[AnalysisService]')) {
            formattedSource = 'analysis';
          } else if (message.includes('[PersonalContextService]')) {
            formattedSource = 'service';
          } else if (message.includes('[PersonalContextAPI]') || message.includes('[API]')) {
            formattedSource = 'server';
          } else if (message.includes('WARNING:') || message.includes('Compiling')) {
            formattedSource = 'server';
          } else if (message.includes('[PersonalContextStore]')) {
            formattedSource = 'service';
          } else if (message.includes('GET /api/') || message.includes('POST /api/')) {
            formattedSource = 'server';
          }
        }
        
        // Add the log without filtering - capture everything
        addLog(message, formattedSource);
      }
    };
    
    // Add event listener
    window.addEventListener('personal-context-log', handleLogEvent as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('personal-context-log', handleLogEvent as EventListener);
    };
  }, []);

  const handleStartLearning = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to start learning from your Gmail.",
        variant: "destructive"
      });
      return;
    }

    if (!googleAccessToken) {
      toast({
        title: "Gmail Access Required",
        description: "Please connect to Google to access your Gmail for learning.",
        variant: "destructive"
      });
      return;
    }

    clearError();
    
    // Reset logs, show log panel, and start polling
    setLearningLogs([]);
    setShowDetailedLogs(true);
    setLastLogTimestamp(''); // Reset timestamp to get all logs
    setIsPollingLogs(true);  // Start polling for logs
    
    // Add initial logs
    addLog(`Starting personal context learning process...`, 'client');
    addLog(`Time range: ${getTimeRangeDisplayText(learningOptions.timeRange)}`, 'client');
    addLog(`Analysis depth: ${learningOptions.analysisDepth}`, 'client');
    addLog(`Connecting to Gmail API...`, 'client');
    
    const input: PersonalContextLearningInput = {
      userId: currentUser.uid,
      accessToken: googleAccessToken,
      options: learningOptions
    };

    const result = await learnPersonalContext(input);
    
    if (result.success) {
      addLog("✅ Learning complete! Successfully analyzed your email patterns and built personal context.", 'client');
      toast({
        title: "Learning Complete!",
        description: "Successfully analyzed your email patterns and built personal context.",
      });
      // Refresh statistics
      if (userId) {
        getUserStatistics(userId);
      }
    } else {
      addLog(`❌ Learning failed: ${result.error || "Unknown error"}`, 'client');
      toast({
        title: "Learning Failed",
        description: result.error || "Failed to learn from Gmail.",
        variant: "destructive"
      });
    }
    
    // Stop polling after learning is complete
    setIsPollingLogs(false);
  };

  const handleTestConnection = async () => {
    if (!googleAccessToken) {
      toast({
        title: "Authentication Required",
        description: "Please connect to Google to test Gmail access.",
        variant: "destructive"
      });
      return;
    }

    const result = await testGmailConnection(googleAccessToken!);
    
    toast({
      title: result.success ? "Connection Successful" : "Connection Failed",
      description: result.message || result.error,
      variant: result.success ? "default" : "destructive"
    });
  };

  const handleSaveManualContext = () => {
    // TODO: Implement manual context saving
    console.log("Saving manual context:", manualContext);
    toast({
      title: "Context Saved",
      description: "Your manual context has been updated.",
    });
  };

  const handleDeleteContext = async () => {
    if (!userId) return;
    
    if (!confirm("Are you sure you want to delete all personal context data? This action cannot be undone.")) {
      return;
    }

    const result = await deletePersonalContextData(userId);
    
    if (result.success) {
      toast({
        title: "Data Deleted",
        description: "All personal context data has been deleted.",
      });
    } else {
      toast({
        title: "Delete Failed",
        description: "Failed to delete personal context data.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Add a log entry with timestamp and proper formatting
  const addLog = (message: string, source: string = 'client') => {
    // For client-side logs that don't already have timestamps, add them
    let formattedMessage = message;
    if (source !== 'console' && source !== 'server' && !message.includes('[')) {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      formattedMessage = `[${timestamp}] ${message}`;
    }
    
    setLearningLogs(prev => [...prev, { message: formattedMessage, source }]);
  };

  // Display logs in the UI with proper formatting
  const renderLog = (log: { message: string; source: string }) => {
    // Apply color based on source
    let className = "";
    switch (log.source) {
      case 'gmail':
        className = "text-blue-600";
        break;
      case 'analysis':
        className = "text-purple-600";
        break;
      case 'service':
        className = "text-green-600";
        break;
      case 'server':
        className = "text-slate-500";
        break;
      case 'console':
        className = "text-slate-500";
        break;
      default:
        className = "text-foreground";
    }
    
    return <div className={`pb-1 ${className}`}>{log.message}</div>;
  };
  
  // Get readable text for time range
  const getTimeRangeDisplayText = (timeRange: PersonalContextLearningInput['options']['timeRange']) => {
    switch (timeRange) {
      case 'last_month': return 'Last Month';
      case 'last_3months': return 'Last 3 Months';
      case 'last_6months': return 'Last 6 Months';
      case 'last_year': return 'Last Year';
      case 'last_2years': return 'Past 2 Years';
      case 'last_3years': return 'Past 3 Years';
      case 'last_5years': return 'Past 5 Years';
      case 'all_time': return 'All Time';
      default: return timeRange;
    }
  };

  // Function to fetch server logs
  const fetchServerLogs = async () => {
    try {
      const url = lastLogTimestamp 
        ? `/api/personal-context/server-logs?after=${encodeURIComponent(lastLogTimestamp)}&limit=100`
        : '/api/personal-context/server-logs?limit=100';
        
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch server logs');
      
      const data = await response.json();
      
      if (data.logs && data.logs.length > 0) {
        // Update logs with new server logs
        const newLogs = data.logs.map((log: {timestamp: string, message: string}) => ({
          message: log.message,
          source: determineLogSource(log.message)
        }));
        
        // Add new logs and update last timestamp
        if (newLogs.length > 0) {
          setLearningLogs(prev => [...prev, ...newLogs]);
          setLastLogTimestamp(data.logs[0].timestamp);
        }
      }
    } catch (error) {
      console.error('Error fetching server logs:', error);
    }
  };
  
  // Function to determine the source of a log based on its content
  const determineLogSource = (message: string): string => {
    if (message.includes('[GmailService]')) {
      return 'gmail';
    } else if (message.includes('[AnalysisService]')) {
      return 'analysis';
    } else if (message.includes('[PersonalContextService]')) {
      return 'service';
    } else if (message.includes('[PersonalContextAPI]') || message.includes('[API]')) {
      return 'server';
    } else if (message.includes('[PersonalContextStore]')) {
      return 'service';
    } else if (message.includes('WARNING:') || message.includes('Compiling')) {
      return 'server';
    } else if (message.includes('GET /api/') || message.includes('POST /api/')) {
      return 'server';
    }
    return 'server';
  };
  
  // Effect to start polling when learning process starts
  useEffect(() => {
    // Start polling when learning is in progress
    if (isLoading && !isPollingLogs) {
      setIsPollingLogs(true);
    }
    
    // Stop polling when learning is complete
    if (!isLoading && isPollingLogs) {
      setIsPollingLogs(false);
    }
  }, [isLoading, isPollingLogs]);
  
  // Poll for server logs when isPollingLogs is true
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isPollingLogs) {
      // Fetch logs immediately
      fetchServerLogs();
      
      // Then set up polling interval
      interval = setInterval(fetchServerLogs, 1000); // Poll every second
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPollingLogs, lastLogTimestamp]);

  // Function to manually process a raw server log string (like from terminal output)
  const processRawServerLog = (logStr: string) => {
    // First check if this is a relevant log message
    if (logStr.includes('[PersonalContextService]') || 
        logStr.includes('[GmailService]') || 
        logStr.includes('[AnalysisService]') || 
        logStr.includes('[PersonalContextStore]') ||
        logStr.includes('[PersonalContextAPI]') || 
        logStr.includes('[API]') || 
        logStr.includes('WARNING:') || 
        logStr.includes('GET /api/personal-context') || 
        logStr.includes('POST /api/personal-context')) {
      
      // Determine the appropriate source
      let source = 'server';
      if (logStr.includes('[GmailService]')) {
        source = 'gmail';
      } else if (logStr.includes('[AnalysisService]')) {
        source = 'analysis';
      } else if (logStr.includes('[PersonalContextService]')) {
        source = 'service';
      } else if (logStr.includes('[PersonalContextStore]')) {
        source = 'service';
      }
      
      // Add to logs
      addLog(logStr, source);
    }
  };

  // Effect to override console.log on the client side to capture all logs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Save the original console.log
      const originalConsoleLog = console.log;
      
      // Override console.log
      console.log = function(...args) {
        // Call the original console.log
        originalConsoleLog.apply(console, args);
        
        // Convert args to a string for processing
        const logStr = args.map(arg => 
          typeof arg === 'string' ? arg : 
          typeof arg === 'object' ? JSON.stringify(arg) : 
          String(arg)
        ).join(' ');
        
        // Process as a server log (this will filter and categorize)
        processRawServerLog(logStr);
      };
      
      // Restore the original console.log on cleanup
      return () => {
        console.log = originalConsoleLog;
      };
    }
  }, [processRawServerLog]);

  // Show authentication prompt if user is not signed in
  if (!currentUser) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Personal Context</h1>
          <p className="text-muted-foreground">
            Manage your personal context to help the AI understand your communication style and preferences.
          </p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <UserCog className="h-6 w-6 text-primary" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              Please sign in with your Google account to access personal context features.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Personal context learning requires access to your Gmail to analyze communication patterns and preferences.
            </p>
            <Button onClick={handleSignIn} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show Google connection prompt if user is signed in but doesn't have Gmail access
  if (!googleAccessToken) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Personal Context</h1>
          <p className="text-muted-foreground">
            Manage your personal context to help the AI understand your communication style and preferences.
          </p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <LinkIcon className="h-6 w-6 text-primary" />
              Google Connection Required
            </CardTitle>
            <CardDescription>
              Hello {currentUser.displayName || currentUser.email}, please connect to Google to access your Gmail.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              We need access to your Gmail to analyze your communication patterns and build your personal context.
            </p>
            <Button onClick={handleSignIn} className="w-full">
              <LinkIcon className="mr-2 h-4 w-4" />
              Connect to Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Personal Context</h1>
        <p className="text-muted-foreground">
          Manage your personal context to help the AI understand your communication style and preferences.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="learn">Learn from Gmail</TabsTrigger>
          <TabsTrigger value="manual">Manual Input</TabsTrigger>
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Context Status</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics?.hasPersonalContext ? 'Active' : 'Not Set'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics?.hasPersonalContext ? 'Personal context available' : 'No context data found'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics?.contactCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Classified relationships
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patterns</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics?.patternCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Communication patterns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confidence</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics?.confidence ? `${Math.round(statistics.confidence * 100)}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Analysis confidence
                </p>
              </CardContent>
            </Card>
          </div>

          {statistics?.hasPersonalContext && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Manage your personal context data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(statistics?.lastUpdated)}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => userId && getPersonalContext(userId)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleDeleteContext}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="learn" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                Learn from Gmail
              </CardTitle>
              <CardDescription>
                Automatically analyze your Gmail to understand your communication patterns and relationships.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Authentication Status */}
              <div className="grid w-full gap-2">
                <Label>Authentication Status</Label>
                <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Connected to Google as {currentUser?.email}
                    </p>
                    <p className="text-xs text-green-600">
                      Gmail access permissions granted
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select 
                    value={learningOptions.timeRange} 
                    onValueChange={(value: PersonalContextLearningInput['options']['timeRange']) => 
                      setLearningOptions(prev => ({ ...prev, timeRange: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3months">Last 3 Months</SelectItem>
                      <SelectItem value="last_6months">Last 6 Months</SelectItem>
                      <SelectItem value="last_year">Last Year</SelectItem>
                      <SelectItem value="last_2years">Past 2 Years</SelectItem>
                      <SelectItem value="last_3years">Past 3 Years</SelectItem>
                      <SelectItem value="last_5years">Past 5 Years</SelectItem>
                      <SelectItem value="all_time">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Analysis Depth</Label>
                  <Select 
                    value={learningOptions.analysisDepth} 
                    onValueChange={(value: PersonalContextLearningInput['options']['analysisDepth']) => 
                      setLearningOptions(prev => ({ ...prev, analysisDepth: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="comprehensive">Comprehensive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleTestConnection} 
                  variant="outline"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Test Connection
                </Button>
                <Button 
                  onClick={handleStartLearning} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                  {isLoading ? 'Learning...' : 'Start Learning'}
                </Button>
              </div>

              {progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {progress.currentPhase}</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} className="w-full" />
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div>Threads: {progress.threadsAnalyzed}/{progress.threadsDiscovered}</div>
                    <div>Contacts: {progress.contactsClassified}</div>
                  </div>
                </div>
              )}
              
              {/* Detailed Logs Section */}
              <div className="space-y-2 mt-4 border rounded-md p-3">
                <div 
                  className="flex justify-between items-center cursor-pointer" 
                  onClick={() => setShowDetailedLogs(!showDetailedLogs)}
                >
                  <Label className="text-sm font-medium">Detailed Process Logs</Label>
                  <Button variant="ghost" size="sm">
                    {showDetailedLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                
                {showDetailedLogs && (
                  <>
                    {/* Filter controls */}
                    <div className="flex gap-2 mb-2 flex-wrap items-center justify-between">
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          variant={logFilter === 'all' ? 'default' : 'outline'} 
                          size="sm"
                          onClick={() => setLogFilter('all')}
                        >
                          All
                        </Button>
                        <Button 
                          variant={logFilter === 'client' ? 'default' : 'outline'} 
                          size="sm"
                          className="text-foreground"
                          onClick={() => setLogFilter('client')}
                        >
                          UI
                        </Button>
                        <Button 
                          variant={logFilter === 'service' ? 'default' : 'outline'} 
                          size="sm"
                          className="text-green-600"
                          onClick={() => setLogFilter('service')}
                        >
                          Service
                        </Button>
                        <Button 
                          variant={logFilter === 'gmail' ? 'default' : 'outline'} 
                          size="sm"
                          className="text-blue-600"
                          onClick={() => setLogFilter('gmail')}
                        >
                          Gmail
                        </Button>
                        <Button 
                          variant={logFilter === 'analysis' ? 'default' : 'outline'} 
                          size="sm"
                          className="text-purple-600"
                          onClick={() => setLogFilter('analysis')}
                        >
                          Analysis
                        </Button>
                        <Button 
                          variant={logFilter === 'server' ? 'default' : 'outline'} 
                          size="sm"
                          className="text-slate-500"
                          onClick={() => setLogFilter('server')}
                        >
                          Server
                        </Button>
                      </div>
                      
                      {/* Auto-scroll indicator and control */}
                      {!shouldAutoScroll && learningLogs.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setShouldAutoScroll(true);
                            scrollToBottom();
                          }}
                          className="text-xs"
                        >
                          📍 Scroll to Latest
                        </Button>
                      )}
                    </div>

                    <div 
                      className="bg-muted p-3 rounded-md h-80 overflow-y-auto text-xs font-mono" 
                      ref={logsContainerRef}
                      onScroll={handleScroll}
                    >
                      {learningLogs.length === 0 ? (
                        <p className="text-muted-foreground">No logs available yet. Start the learning process to see detailed logs.</p>
                      ) : (
                        learningLogs
                          .filter(log => logFilter === 'all' || log.source === logFilter)
                          .map((log, index) => (
                            <div key={index}>
                              {renderLog(log)}
                            </div>
                          ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-6">
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
                Manual Context
          </CardTitle>
          <CardDescription>
                Manually provide information about your communication style and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
              <div className="grid w-full gap-2">
                <Label htmlFor="manual-context">Enter your context below:</Label>
            <Textarea
                  id="manual-context"
                  value={manualContext}
                  onChange={(e) => setManualContext(e.target.value)}
              placeholder="e.g., Your role, communication style, current projects, availability, etc."
              className="min-h-[250px] text-sm"
            />
                <p className="text-xs text-muted-foreground">
              The more detail you provide, the better the AI can assist you.
            </p>
          </div>
        </CardContent>
        <CardFooter>
              <Button onClick={handleSaveManualContext}>
            <Save className="mr-2 h-4 w-4" />
                Save Manual Context
          </Button>
        </CardFooter>
      </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          {profile ? (
            <div className="space-y-6">
              {/* Communication Style & Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Communication Style & Patterns</CardTitle>
                  <CardDescription>Your global and contextual communication preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Primary Tone</Label>
                      <Badge variant="secondary" className="mt-1 block w-fit">
                        {profile.communicationPatterns.globalStyle.tone}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Formality Level</Label>
                      <div className="flex items-center mt-1">
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${profile.communicationPatterns.globalStyle.formality * 10}%` }}
                          />
                        </div>
                        <span className="ml-2 text-sm">{profile.communicationPatterns.globalStyle.formality}/10</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Response Length</Label>
                      <Badge variant="secondary" className="mt-1 block w-fit">
                        {profile.communicationPatterns.globalStyle.responseLength}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.communicationPatterns.globalStyle.greetingStyle.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Greeting Styles</Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {profile.communicationPatterns.globalStyle.greetingStyle.slice(0, 3).map((greeting, index) => (
                            <Badge key={index} variant="outline" className="text-xs">{greeting}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {profile.communicationPatterns.globalStyle.closingStyle.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Sign-off Styles</Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {profile.communicationPatterns.globalStyle.closingStyle.slice(0, 3).map((closing, index) => (
                            <Badge key={index} variant="outline" className="text-xs">{closing}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Sentence Structure</Label>
                      <p className="text-sm text-muted-foreground">{profile.communicationPatterns.globalStyle.sentenceStructure}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Emoji Usage</Label>
                      <p className="text-sm text-muted-foreground">{profile.communicationPatterns.globalStyle.emojiUsage}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Punctuation Style</Label>
                      <p className="text-sm text-muted-foreground">{profile.communicationPatterns.globalStyle.punctuationStyle}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Relationships & Social Context */}
              <Card>
                <CardHeader>
                  <CardTitle>Relationships & Social Context</CardTitle>
                  <CardDescription>Your network and relationship dynamics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Contact Categories</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.relationships.relationshipTypes.map((type, index) => (
                          <Badge key={index} variant="secondary">
                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Key Contacts</Label>
                      <div className="mt-2 space-y-2">
                        {Object.entries(profile.relationships.contacts).slice(0, 5).map(([email, relationship]) => (
                          <div key={email} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <p className="text-sm font-medium">{email}</p>
                              <p className="text-xs text-muted-foreground">
                                {relationship.relationshipType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                                {relationship.communicationFrequency} • 
                                Confidence: {Math.round(relationship.confidence * 100)}%
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {relationship.totalInteractions} interactions
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Professional Profile */}
              <Card>
                <CardHeader>
                  <CardTitle>Professional Profile</CardTitle>
                  <CardDescription>Your work-related information and patterns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.professionalProfile.jobTitle && (
                      <div>
                        <Label className="text-sm font-medium">Job Title</Label>
                        <p className="text-sm">{profile.professionalProfile.jobTitle}</p>
                      </div>
                    )}
                    {profile.professionalProfile.company && (
                      <div>
                        <Label className="text-sm font-medium">Company</Label>
                        <p className="text-sm">{profile.professionalProfile.company}</p>
                      </div>
                    )}
                    {profile.professionalProfile.department && (
                      <div>
                        <Label className="text-sm font-medium">Department</Label>
                        <p className="text-sm">{profile.professionalProfile.department}</p>
                      </div>
                    )}
                    {profile.professionalProfile.industry && (
                      <div>
                        <Label className="text-sm font-medium">Industry</Label>
                        <p className="text-sm">{profile.professionalProfile.industry}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium">Management Level</Label>
                      <Badge variant="outline">{profile.professionalProfile.managementLevel.replace('_', ' ')}</Badge>
                    </div>
                    {profile.professionalProfile.networkingStyle && (
                      <div>
                        <Label className="text-sm font-medium">Networking Style</Label>
                        <Badge variant="secondary">{profile.professionalProfile.networkingStyle}</Badge>
                      </div>
                    )}
                  </div>
                  
                  {profile.professionalProfile.expertise.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Expertise Areas</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.professionalProfile.expertise.map((skill, index) => (
                          <Badge key={index} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.professionalProfile.projectsAndResponsibilities.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Projects & Responsibilities</Label>
                      <div className="mt-2 space-y-1">
                        {profile.professionalProfile.projectsAndResponsibilities.slice(0, 5).map((item, index) => (
                          <p key={index} className="text-sm text-muted-foreground">• {item}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.professionalProfile.decisionMakingAuthority && profile.professionalProfile.decisionMakingAuthority.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Decision Making Authority</Label>
                      <div className="mt-2 space-y-1">
                        {profile.professionalProfile.decisionMakingAuthority.slice(0, 3).map((item, index) => (
                          <p key={index} className="text-sm text-muted-foreground">• {item}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.professionalProfile.workingHours && (
                    <div>
                      <Label className="text-sm font-medium">Working Hours</Label>
                      <p className="text-sm text-muted-foreground">
                        {profile.professionalProfile.workingHours.startHour}:00 - {profile.professionalProfile.workingHours.endHour}:00 
                        ({profile.professionalProfile.workingHours.timezone})
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Meeting Style</Label>
                      <p className="text-sm text-muted-foreground">{profile.professionalProfile.meetingPatterns.meetingStyle}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Preferred Meeting Duration</Label>
                      <p className="text-sm text-muted-foreground">{profile.professionalProfile.meetingPatterns.preferredDuration} minutes</p>
                    </div>
                    {profile.professionalProfile.meetingPatterns.preferredTimes && profile.professionalProfile.meetingPatterns.preferredTimes.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Preferred Meeting Times</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {profile.professionalProfile.meetingPatterns.preferredTimes.slice(0, 3).map((time, index) => (
                            <Badge key={index} variant="outline" className="text-xs">{time}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Knowledge Areas & Expertise */}
              {profile.knowledgeAreas && profile.knowledgeAreas.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Knowledge Areas & Expertise</CardTitle>
                    <CardDescription>Domains of knowledge and expertise levels identified from communications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.knowledgeAreas.slice(0, 8).map((area, index) => (
                        <div key={index} className="p-3 bg-muted rounded border">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-medium text-sm">{area.domain}</p>
                            <Badge variant="outline" className="text-xs">
                              {area.expertise_level}
                            </Badge>
                          </div>
                          {area.context && (
                            <p className="text-xs text-muted-foreground">{area.context}</p>
                          )}
                          <div className="flex items-center mt-2">
                            <div className="w-full bg-secondary rounded-full h-1">
                              <div 
                                className="bg-primary h-1 rounded-full" 
                                style={{ width: `${area.confidence * 100}%` }}
                              />
                            </div>
                            <span className="ml-2 text-xs text-muted-foreground">{Math.round(area.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Behavioral Patterns */}
              {profile.behavioralPatterns && profile.behavioralPatterns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Behavioral Patterns</CardTitle>
                    <CardDescription>Observed behavioral tendencies and interaction patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {profile.behavioralPatterns.slice(0, 6).map((pattern, index) => (
                        <div key={index} className="p-3 bg-muted rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-sm capitalize">{pattern.type.replace('_', ' ')}</p>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(pattern.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{pattern.pattern}</p>
                          {pattern.triggers && pattern.triggers.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Triggers:</p>
                              <div className="flex flex-wrap gap-1">
                                {pattern.triggers.slice(0, 3).map((trigger, triggerIndex) => (
                                  <Badge key={triggerIndex} variant="outline" className="text-xs">{trigger}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contextual Communication Responses */}
              {profile.contextualResponses && profile.contextualResponses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Contextual Communication Responses</CardTitle>
                    <CardDescription>How communication style adapts to different scenarios and contexts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {profile.contextualResponses.slice(0, 5).map((response, index) => (
                        <div key={index} className="p-3 bg-muted rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-sm">{response.scenario}</p>
                            <div className="flex gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {response.formality_level.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {Math.round(response.confidence * 100)}%
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{response.typical_response_style}</p>
                          {response.key_phrases && response.key_phrases.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Common phrases:</p>
                              <div className="flex flex-wrap gap-1">
                                {response.key_phrases.slice(0, 4).map((phrase, phraseIndex) => (
                                  <Badge key={phraseIndex} variant="outline" className="text-xs">"{phrase}"</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Temporal & Timing Patterns */}
              {profile.temporalPatterns && profile.temporalPatterns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Temporal & Timing Patterns</CardTitle>
                    <CardDescription>Time-based communication and availability patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {profile.temporalPatterns.slice(0, 5).map((pattern, index) => (
                        <div key={index} className="p-3 bg-muted rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-sm capitalize">{pattern.type.replace('_', ' ')}</p>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(pattern.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{pattern.pattern}</p>
                          {pattern.specific_times && pattern.specific_times.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Specific times:</p>
                              <div className="flex flex-wrap gap-1">
                                {pattern.specific_times.slice(0, 4).map((time, timeIndex) => (
                                  <Badge key={timeIndex} variant="outline" className="text-xs">{time}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Personal Preferences & Behavioral Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Preferences & Behavioral Patterns</CardTitle>
                  <CardDescription>Your habits, preferences, and behavioral tendencies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Decision Making Style</Label>
                      <Badge variant="secondary">{profile.personalPreferences.decisionMakingStyle}</Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Conflict Resolution</Label>
                      <Badge variant="secondary">{profile.personalPreferences.conflictResolutionApproach}</Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Response Timing Patterns</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${profile.personalPreferences.responseTimingPatterns.businessHours ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs">Business Hours</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${profile.personalPreferences.responseTimingPatterns.eveningEmails ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs">Evening Emails</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${profile.personalPreferences.responseTimingPatterns.weekendEmails ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs">Weekend Emails</span>
                      </div>
                      <div>
                        <span className="text-xs">Urgent: {profile.personalPreferences.responseTimingPatterns.urgentResponseTime}h</span>
                      </div>
                    </div>
                  </div>

                  {profile.personalPreferences.personalInterests.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Personal Interests</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.personalPreferences.personalInterests.slice(0, 8).map((interest, index) => (
                          <Badge key={index} variant="outline">{interest}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.personalPreferences.valuesAndBeliefs.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Values & Beliefs</Label>
                      <div className="mt-2 space-y-1">
                        {profile.personalPreferences.valuesAndBeliefs.slice(0, 3).map((value, index) => (
                          <p key={index} className="text-sm text-muted-foreground">• {value}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.personalPreferences.communicationPreferences && (
                    <div>
                      <Label className="text-sm font-medium">Communication Preferences</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {profile.personalPreferences.communicationPreferences.preferredChannels && profile.personalPreferences.communicationPreferences.preferredChannels.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-1">Preferred Channels:</p>
                            <div className="flex flex-wrap gap-1">
                              {profile.personalPreferences.communicationPreferences.preferredChannels.slice(0, 3).map((channel, index) => (
                                <Badge key={index} variant="outline" className="text-xs">{channel}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {profile.personalPreferences.communicationPreferences.topicPreferences && profile.personalPreferences.communicationPreferences.topicPreferences.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-1">Topic Preferences:</p>
                            <div className="flex flex-wrap gap-1">
                              {profile.personalPreferences.communicationPreferences.topicPreferences.slice(0, 3).map((topic, index) => (
                                <Badge key={index} variant="outline" className="text-xs">{topic}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium">Scheduling Preferences</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Buffer Time: {profile.personalPreferences.schedulingPreferences.bufferTimeNeeded} minutes</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Back-to-back: {profile.personalPreferences.schedulingPreferences.backToBackTolerance ? 'Tolerates' : 'Avoids'}
                        </p>
                      </div>
                    </div>
                    {profile.personalPreferences.schedulingPreferences.preferredMeetingTimes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.personalPreferences.schedulingPreferences.preferredMeetingTimes.map((time, index) => (
                          <Badge key={index} variant="outline" className="text-xs">{time}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Learning Metadata & Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle>Learning Metadata & Analytics</CardTitle>
                  <CardDescription>Information about the analysis process and confidence scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Emails Analyzed</Label>
                      <p className="text-lg font-semibold">{profile.learningMetadata.emailsAnalyzed}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Threads Analyzed</Label>
                      <p className="text-lg font-semibold">{profile.learningMetadata.threadsAnalyzed}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Contacts Classified</Label>
                      <p className="text-lg font-semibold">{profile.learningMetadata.contactsClassified}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Learning Source</Label>
                      <Badge variant="outline" className="text-xs">{profile.learningMetadata.learningSource.replace('_', ' ')}</Badge>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <Label className="text-sm font-medium">Confidence Scores</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Overall</span>
                          <span>{Math.round(profile.learningMetadata.confidenceScores.overall * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${getConfidenceColor(profile.learningMetadata.confidenceScores.overall)}`}
                            style={{ width: `${profile.learningMetadata.confidenceScores.overall * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Communication</span>
                          <span>{Math.round(profile.learningMetadata.confidenceScores.communicationStyle * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${getConfidenceColor(profile.learningMetadata.confidenceScores.communicationStyle)}`}
                            style={{ width: `${profile.learningMetadata.confidenceScores.communicationStyle * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Relationships</span>
                          <span>{Math.round(profile.learningMetadata.confidenceScores.relationships * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${getConfidenceColor(profile.learningMetadata.confidenceScores.relationships)}`}
                            style={{ width: `${profile.learningMetadata.confidenceScores.relationships * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label className="text-sm font-medium">Analysis Time Range</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(profile.learningMetadata.analysisTimeRange.startDate).toLocaleDateString()} - {new Date(profile.learningMetadata.analysisTimeRange.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Personal Context Available</h3>
                <p className="text-muted-foreground mb-4">
                  Learn from your Gmail or manually input your context to see your profile details.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
