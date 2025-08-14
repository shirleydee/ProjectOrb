// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    console.log('Search API called with query:', query);
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CX = process.env.GOOGLE_CX; // Custom Search Engine ID
    
    console.log('API key exists:', !!GOOGLE_API_KEY);
    console.log('Search engine ID exists:', !!GOOGLE_CX);
    
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      console.error('Google API credentials not found');
      return NextResponse.json({ 
        error: 'Google Search API credentials not configured',
        missingKeys: {
          apiKey: !GOOGLE_API_KEY,
          searchEngineId: !GOOGLE_CX
        }
      }, { status: 500 });
    }

    // Google Custom Search API endpoint
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`;
    
    console.log('Making request to Google Search API...');
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('Google Search API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Search API error:', response.status, errorText);
      
      // Handle quota exceeded or other common errors
      if (response.status === 429) {
        return NextResponse.json({ 
          error: 'Search quota exceeded. Please try again later.',
          results: []
        }, { status: 429 });
      }
      
      throw new Error(`Google Search API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Search results count:', data.items?.length || 0);

    // Transform the results to a cleaner format
    const results = data.items?.map((item, index) => ({
      id: index + 1,
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || null,
      type: 'browse'
    })) || [];

    return NextResponse.json({
      query,
      results,
      totalResults: data.searchInformation?.totalResults || '0',
      searchTime: data.searchInformation?.searchTime || '0'
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform search',
        message: error.message,
        results: []
      },
      { status: 500 }
    );
  }
}