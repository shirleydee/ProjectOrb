// app/api/explain/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { selectedText, pageContext, requestType = 'explain' } = await request.json();
    
    if (!selectedText) {
      return NextResponse.json(
        { error: 'Selected text is required' }, 
        { status: 400 }
      );
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'API key not configured' }, 
        { status: 500 }
      );
    }

    // Generate context-aware prompt based on request type and page context
    const prompt = generatePrompt(selectedText, pageContext, requestType);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json(
        { error: `AI service error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.candidates || data.candidates.length === 0) {
      console.error('No candidates in Gemini response:', data);
      return NextResponse.json(
        { error: 'No explanation generated' }, 
        { status: 500 }
      );
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('Invalid candidate structure:', candidate);
      return NextResponse.json(
        { error: 'Invalid response structure' }, 
        { status: 500 }
      );
    }

    const explanation = candidate.content.parts[0].text;
    
    return NextResponse.json({ 
      explanation,
      requestType,
      selectedText: selectedText.substring(0, 200) // Return truncated version for reference
    });
    
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

function generatePrompt(selectedText, pageContext, requestType) {
  const contextInfo = pageContext ? `
Page Context:
- Title: ${pageContext.title || 'Unknown'}
- URL: ${pageContext.url || 'Unknown'}
- Description: ${pageContext.description || 'Not available'}
- Page Content Preview: ${pageContext.content ? pageContext.content.substring(0, 300) + '...' : 'Not available'}
` : '';

  const basePrompt = `${contextInfo}

Selected Text: "${selectedText}"

`;

  switch (requestType) {
    case 'explain':
      return basePrompt + `Please provide a clear, comprehensive explanation of the selected text. Consider:
1. What does this text mean in simple terms?
2. Why is this concept important or relevant?
3. How does it relate to the broader context of the webpage?
4. Are there any technical terms that need clarification?

Provide your explanation in a clear, educational manner that would help someone understand this concept better.`;

    case 'simplify':
      return basePrompt + `Please simplify this text to make it easier to understand:
1. Use simpler language and shorter sentences
2. Remove jargon and technical terms where possible
3. Explain any necessary technical terms in plain language
4. Make it accessible to a general audience

Provide a simplified version that maintains the core meaning but is much easier to read.`;

    case 'translate':
      return basePrompt + `Please help with this text by:
1. If it's in a foreign language, translate it to English
2. If it's already in English but uses complex terminology, "translate" it to plain English
3. If it contains idioms or cultural references, explain what they mean
4. Provide context about any cultural or linguistic nuances

Make this text accessible and understandable.`;

    case 'examples':
      return basePrompt + `Please provide practical examples related to this text:
1. Give 2-3 concrete, real-world examples that illustrate this concept
2. Show how this might apply in different scenarios or contexts
3. If relevant, provide analogies that make the concept easier to understand
4. Include any common use cases or applications

Help make this concept more tangible with practical examples.`;

    case 'related':
      return basePrompt + `Please suggest related concepts and topics:
1. What are 3-5 related concepts or topics someone should explore?
2. What are the prerequisites to fully understand this?
3. What are the next steps or advanced topics to learn after this?
4. How does this connect to other fields or disciplines?

Provide a learning pathway and related concepts that would deepen understanding.`;

    default:
      return basePrompt + `Please provide a helpful response about this selected text, considering the context provided.`;
  }
}

// Handle CORS preflight
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}