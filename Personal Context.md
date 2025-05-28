# Personal Context

This is the section where we can display everything the agent have learned about the user.
There should be these information automatically learned from the "Learn About Human Process". But those things should be manually editable too.

How the human reply to certain emails or people or event may change, for an example he may reply in a friendly tone to a friend and in a formal tone to a work email. So these things must be adjusted to account for that as well.

- Information
    
    ### Communication Style & Patterns
    
    - Writing tone (formal, casual, friendly, direct, humorous)
    - Sentence structure (short vs long sentences, complexity level)
    - Greeting and sign-off preferences ("Hey", "Hi there", "Best regards", "Cheers")
    - Response timing patterns (immediate vs delayed responses)
    - Emoji and punctuation usage
    - Language preferences (slang, technical terms, regional expressions)
    
    ### Relationships & Social Context
    
    - Family members (names, relationships, important details)
    - Close friends (names, how they're addressed, relationship context)
    - Professional contacts (colleagues, clients, business partners)
    - Relationship dynamics (formal vs casual with different people)
    - Social circles (work, personal, hobby groups)
    
    ### Professional Information
    
    - Current role and responsibilities
    - Work schedule and availability
    - Meeting preferences and patterns
    - Professional goals and projects
    - Industry knowledge and expertise
    - Networking style and preferences
    - Decision-making authority levels
    
    ### Personal Preferences & Habits
    
    - Daily routines and schedules
    - Favorite foods, restaurants, activities
    - Travel preferences and frequent destinations
    - Shopping habits and brand preferences
    - Entertainment choices (movies, music, books, sports teams)
    - Values and beliefs that influence decisions
    
    ### Behavioral Patterns
    
    - Decision-making style (quick vs deliberate, collaborative vs independent)
    - Conflict resolution approach
    - How they handle requests, invitations, and offers
    - Typical reasons for saying yes/no to different types of requests
    - Delegation patterns and comfort levels
    - Privacy boundaries and what they share publicly
    
    ### Contextual Responses
    
    - Common scenarios they face and typical responses
    - Standard replies to frequent email types
    - Escalation triggers (what requires human attention)
    - Seasonal patterns (holiday responses, vacation times)
    - Stress indicators and how communication changes during busy periods
    
    ### Knowledge & Expertise Areas
    
    - Professional expertise for answering technical questions
    - Personal interests they can discuss knowledgeably
    - Learning preferences (how they like to receive information)
    - Topics they avoid or defer to others
    
- Contextual Response Framework
    
    ### 1. Contact Classification System
    
    The AI should categorize each contact into relationship types:
    
    ```python
    contact_categories = {
        "family": {
            "tone": "warm_casual",
            "formality": "very_low",
            "emoji_usage": "frequent"
        },
        "close_friends": {
            "tone": "casual_friendly",
            "formality": "low",
            "emoji_usage": "moderate"
        },
        "work_colleagues": {
            "tone": "professional_friendly",
            "formality": "medium",
            "emoji_usage": "minimal"
        },
        "clients_customers": {
            "tone": "professional_courteous",
            "formality": "high",
            "emoji_usage": "none"
        },
        "executives_bosses": {
            "tone": "respectful_professional",
            "formality": "very_high",
            "emoji_usage": "none"
        },
        "vendors_service_providers": {
            "tone": "business_neutral",
            "formality": "medium_high",
            "emoji_usage": "rare"
        },
        "unknown_cold_outreach": {
            "tone": "polite_reserved",
            "formality": "high",
            "emoji_usage": "none"
        }
    }
    
    ```
    
    ### 2. Context Detection Triggers
    
    The AI should analyze multiple signals to determine appropriate response style:
    
    Sender Analysis
    
    - Email domain (company email vs personal)
    - Previous email history and relationship patterns
    - Contact's role/title in signature
    - Mutual connections or shared contexts
    
    ### Email Content Analysis
    
    - Subject line formality ("Meeting Request" vs "hey quick question")
    - Greeting style ("Dear Sir/Madam" vs "Hey!")
    - Overall tone of incoming message
    - Urgency indicators ("URGENT", "ASAP", "when you have time")
    
    ### Temporal Context
    
    - Time of day (business hours vs evening/weekend)
    - Deadline pressures mentioned in email
    
    ### Thread Context
    
    - Ongoing conversation tone
    - CC/BCC recipients (formal when others are copied)
    - Reply-all situations requiring diplomatic responses
    
    ### 3. Adaptive Response Rules
    
    ### Tone Matching System
    
    ```python
    tone_adaptation_rules = {
        "mirror_incoming_tone": {
            "if_formal_incoming": "respond_formal",
            "if_casual_incoming": "respond_casual_but_appropriate",
            "if_urgent_incoming": "acknowledge_urgency"
        },
        "relationship_override": {
            "family_always_casual": True,
            "executive_always_formal": True,
            "client_match_their_tone": True
        },
        "context_adjustments": {
            "group_emails": "more_formal",
            "private_messages": "relationship_appropriate",
            "first_contact": "slightly_more_formal"
        }
    }
    
    ```
    
    ### Dynamic Style Templates
    
    The AI should have multiple response templates for each contact type:
    
    **Example for Work Colleague:**
    
    - **Formal version:** "Thank you for your email. I'll review this and get back to you by tomorrow."
    - **Casual version:** "Thanks for sending this over! I'll take a look and let you know by tomorrow."
    - **Urgent version:** "Got it - I'll prioritize this and have a response within the hour."
    
    ### 4. Learning and Adaptation Mechanisms
    
    ### Pattern Recognition
    
    - Track how the human actually responds to different people
    - Learn from corrections when human overrides AI responses
    - Identify seasonal or situational communication changes
    
    ### Feedback Loop System
    
    ```python
    learning_system = {
        "response_tracking": {
            "ai_suggested_tone": "professional_friendly",
            "human_actual_tone": "casual_friendly",
            "contact_category": "work_colleague",
            "context": "internal_team_discussion"
        },
        "pattern_updates": {
            "adjust_contact_relationship": "closer_than_assumed",
            "update_tone_preference": "more_casual_with_team",
            "context_rule": "internal_emails_less_formal"
        }
    }
    
    ```
    
    ### 5. Implementation Strategy
    
    ### Training Phase
    
    - **Email History Analysis:** Scan past emails to identify communication patterns with different contacts
    - **Relationship Mapping:** Automatically categorize contacts based on email patterns, domains, and content
    - **Style Profiling:** Learn the human's different "communication personas" for various contexts
    
    ### Real-time Adaptation
    
    - **Incoming Email Analysis:** Classify sender, detect context, analyze tone
    - **Style Selection:** Choose appropriate communication style based on learned patterns
    - **Response Generation:** Create response matching the determined style
    - **Confidence Scoring:** Rate how confident the AI is about the chosen approach
    
    ### Continuous Learning
    
    - **Human Feedback:** Track when human edits or overrides AI responses
    - **Pattern Updates:** Adjust contact classifications and style rules
    - **Context Refinement:** Improve understanding of situational communication needs
    
    ### 6. Special Situation Handling
    
    ### Conflict Situations
    
    - Default to more formal/diplomatic language
    - Avoid taking sides in group emails
    - Escalate sensitive topics to human attention
    
    ### Cultural Considerations
    
    - Adjust formality based on cultural context of sender
    - Handle different business etiquette expectations
    - Respect cultural communication norms
    
    ### Emergency Overrides
    
    - Always escalate crisis communications
    - Recognize legal/compliance language needs
    - Flag unusual tone shifts that might indicate problems

And when the AI agent is talking using the chatbox in the dashboard, and when it's reading a new email, or when new information comes in and if you can get some personal context from those new information and if you find out that the already existing person context information should be changed, the LLM should have necessary tools to update the memory.