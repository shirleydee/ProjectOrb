// app/api/gemini-chat/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' }, 
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY; // Use server-side env var (without NEXT_PUBLIC_)
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'API key not configured' }, 
        { status: 500 }
      );
    }

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
            maxOutputTokens: 1024,
            topP: 0.8,
            topK: 40
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json(
        { error: `Gemini API error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.candidates || data.candidates.length === 0) {
      console.error('No candidates in Gemini response:', data);
      return NextResponse.json(
        { error: 'No response generated' }, 
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

    const reply = candidate.content.parts[0].text;
    
    return NextResponse.json({ reply });
    
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}