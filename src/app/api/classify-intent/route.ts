// // app/api/classify-intent/route.ts
// import { NextRequest, NextResponse } from 'next/server';

// export async function POST(request: NextRequest) {
//   try {
//     console.log('Intent classification API called');
//     const { query } = await request.json();
//     console.log('Query received:', query);
    
//     if (!query) {
//       return NextResponse.json({ error: 'Query is required' }, { status: 400 });
//     }

//     const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
//     console.log('API key exists:', !!GEMINI_API_KEY);
    
//     if (!GEMINI_API_KEY) {
//       console.error('Gemini API key not found in environment variables');
//       return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
//     }

//     const prompt = `
//     Classify the following user query into one of these categories. Respond with ONLY the category number, if a specific category is not applicable, return 1 (BROWSE), if a specific category is indicated in the query, return that category number:

//     1. BROWSE - Regular web browsing, searching for information, news, facts, or general queries
//     2. LEARN - User wants to learn something, needs tutorials, courses, or structured learning content
//     3. MINDMAP - User wants to visualize concepts, create mind maps, or see relationships between ideas
//     4. CHAT - User wants to have a conversation, discuss topics, or needs interactive assistance

//     Examples:
//     - "What's the weather today?" → 1
//     - "How to learn Python programming?" → 2
//     - "Create a mindmap of machine learning concepts" → 3
//     - "I need help with my homework" → 4
//     - "Explain quantum physics to me" → 4
//     - "solve the quadratic equation for the following systems of linear equations" → 4
//     - "Best restaurants in Tokyo" → 1
//     - "Show me a visual representation of the solar system" → 3
//     - "I want to master JavaScript" → 2

//     User query: "${query}"
    
//     Category number only:`;

//     console.log('Making request to Gemini API...');
//     const response = await fetch(
//       'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
//       {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'x-goog-api-key': GEMINI_API_KEY,
//         },
//         body: JSON.stringify({
//           contents: [
//             {
//               parts: [
//                 {
//                   text: prompt
//                 }
//               ]
//             }
//           ],
//           generationConfig: {
//             temperature: 0.1,
//             maxOutputTokens: 10,
//           }
//         }),
//       }
//     );

//     console.log('Gemini API response status:', response.status);

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error('Gemini API error:', response.status, errorText);
//       throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
//     }

//     const data = await response.json();
//     console.log('Gemini API response data:', JSON.stringify(data, null, 2));
    
//     const classification = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
//     console.log('Classification result:', classification);
    
//     // Map the response to intent types
//     const intentMap = {
//       '1': 'BROWSE',
//       '2': 'LEARN', 
//       '3': 'MINDMAP',
//       '4': 'CHAT'
//     };

//     const intent = intentMap[classification] || 'BROWSE'; // Default to browse if unclear

//     return NextResponse.json({
//       query,
//       intent,
//       classification: classification
//     });

//   } catch (error) {
//     console.error('Intent classification error:', error);
//     return NextResponse.json(
//       { error: 'Failed to classify intent', intent: 'BROWSE' },
//       { status: 500 }
//     );
//   }
// }


// app/api/classify-intent/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const prompt = `
You are an intent classification expert. 
Classify the following user query into exactly ONE of these categories.
Respond ONLY with the category number (no text, no punctuation).

Rules for nuanced classification:
- **BROWSE (1):** For general web searches, finding resources, looking for courses/tutorials, or "how to learn" queries that imply browsing the web for materials.
- **LEARN (2):** For direct teaching/explanation requests where the user expects YOU to deliver the learning content in structured steps right now.
- **MINDMAP (3):** For requests to visualize relationships, structures, or create mind maps.
- **CHAT (4):** For casual conversation, personal questions, brainstorming, or step-by-step help.

Examples:
"how to learn cpp" → 1
"learn cpp step by step" → 2
"teach me python" → 2
"best way to learn guitar" → 1
"courses for machine learning" → 1
"give me a mind map of WW2 events" → 3
"explain quantum physics" → 2
"talk to me about AI trends" → 4
"best restaurants in Tokyo" → 1

User query: "${query}"
Category number only:
`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 5,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawClassification =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Extract only the numeric part to be safe
    const classification = rawClassification.match(/\d/)?.[0] || '1';

    const intentMap = {
      '1': 'BROWSE',
      '2': 'LEARN',
      '3': 'MINDMAP',
      '4': 'CHAT',
    };

    const intent = intentMap[classification] || 'BROWSE';

    return NextResponse.json({ query, intent, classification });
  } catch (error) {
    console.error('Intent classification error:', error);
    return NextResponse.json(
      { error: 'Failed to classify intent', intent: 'BROWSE' },
      { status: 500 }
    );
  }
}
