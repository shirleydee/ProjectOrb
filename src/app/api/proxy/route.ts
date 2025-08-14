
// app/api/proxy/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const preserveCSS = searchParams.get('preserveCSS') === 'true';

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate URL
    const url = new URL(targetUrl);
    
    // Security check - prevent SSRF attacks
    const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedDomains.some(domain => url.hostname.includes(domain))) {
      return NextResponse.json({ error: 'Blocked domain' }, { status: 403 });
    }

    // Fetch the page with proper headers
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let html = await response.text();

    if (preserveCSS) {
      // Enhanced CSS and resource preservation
      html = await enhanceHtmlForCSS(html, targetUrl);
    }

    // Set proper headers for the response
    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    
    return new Response(html, { headers });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: `Failed to fetch page: ${error.message}` },
      { status: 500 }
    );
  }
}

async function enhanceHtmlForCSS(html, baseUrl) {
  try {
    const baseUrlObj = new URL(baseUrl);
    const baseOrigin = baseUrlObj.origin;
    
    // More comprehensive URL fixing
    let enhancedHtml = html
      // Fix CSS @import statements in <style> tags
      .replace(
        /@import\s+(?:url\()?["']?(?!https?:\/\/|\/\/|data:)([^"')]+)["']?\)?/gi,
        (match, path) => {
          const fullUrl = path.startsWith('/') 
            ? `${baseOrigin}${path}` 
            : `${baseOrigin}/${path}`;
          return match.replace(path, fullUrl);
        }
      )
      // Fix CSS links with better regex
      .replace(
        /<link([^>]+href=["'])(?!https?:\/\/|\/\/|data:|#)([^"']+)(["'][^>]*>)/gi,
        (match, prefix, path, suffix) => {
          const fullUrl = path.startsWith('/') 
            ? `${baseOrigin}${path}` 
            : new URL(path, baseUrl).href;
          return `${prefix}${fullUrl}${suffix}`;
        }
      )
      // Fix script sources
      .replace(
        /<script([^>]+src=["'])(?!https?:\/\/|\/\/|data:)([^"']+)(["'][^>]*>)/gi,
        (match, prefix, path, suffix) => {
          const fullUrl = path.startsWith('/') 
            ? `${baseOrigin}${path}` 
            : new URL(path, baseUrl).href;
          return `${prefix}${fullUrl}${suffix}`;
        }
      )
      // Fix image sources
      .replace(
        /<img([^>]+src=["'])(?!https?:\/\/|\/\/|data:)([^"']+)(["'][^>]*>)/gi,
        (match, prefix, path, suffix) => {
          const fullUrl = path.startsWith('/') 
            ? `${baseOrigin}${path}` 
            : new URL(path, baseUrl).href;
          return `${prefix}${fullUrl}${suffix}`;
        }
      )
      // Fix CSS background images in style attributes
      .replace(
        /style=(["'])([^"']*background[^"']*url\()(?!https?:\/\/|\/\/|data:)([^)]+)(\)[^"']*)(["'])/gi,
        (match, quote1, prefix, path, suffix, quote2) => {
          const fullUrl = path.replace(/["']/g, '');
          const absoluteUrl = fullUrl.startsWith('/') 
            ? `${baseOrigin}${fullUrl}` 
            : new URL(fullUrl, baseUrl).href;
          return `style=${quote1}${prefix}"${absoluteUrl}"${suffix}${quote2}`;
        }
      )
      // Fix favicon and other icon links
      .replace(
        /<link([^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)[^>]+href=["'])(?!https?:\/\/|\/\/|data:)([^"']+)(["'][^>]*>)/gi,
        (match, prefix, path, suffix) => {
          const fullUrl = path.startsWith('/') 
            ? `${baseOrigin}${path}` 
            : new URL(path, baseUrl).href;
          return `${prefix}${fullUrl}${suffix}`;
        }
      );

    // Add Content Security Policy to allow external resources
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';">`;
    
    if (enhancedHtml.includes('<head>')) {
      enhancedHtml = enhancedHtml.replace('<head>', `<head>\n${cspMeta}`);
    }

    // Add viewport meta for responsive design
    if (!enhancedHtml.includes('viewport')) {
      const viewportMeta = `<meta name="viewport" content="width=device-width, initial-scale=1.0">`;
      enhancedHtml = enhancedHtml.replace('<head>', `<head>\n${viewportMeta}`);
    }

    return enhancedHtml;
  } catch (error) {
    console.error('Error enhancing HTML:', error);
    return html; // Return original if enhancement fails
  }
}

// Handle CORS preflight
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


// // app/api/proxy/route.js
// import { NextResponse } from 'next/server';

// // Import Puppeteer dynamically to avoid build issues
// let puppeteer;
// try {
//   puppeteer = require('puppeteer');
// } catch (error) {
//   console.warn('Puppeteer not available, falling back to fetch');
// }

// export async function GET(request) {
//   const { searchParams } = new URL(request.url);
//   const targetUrl = searchParams.get('url');
//   const preserveCSS = searchParams.get('preserveCSS') === 'true';
//   const waitForJs = searchParams.get('waitForJs') === 'true';
//   const screenshot = searchParams.get('screenshot') === 'true';

//   if (!targetUrl) {
//     return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
//   }

//   try {
//     // Validate URL
//     const url = new URL(targetUrl);
    
//     // Security check - prevent SSRF attacks
//     const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
//     if (blockedDomains.some(domain => url.hostname.includes(domain))) {
//       return NextResponse.json({ error: 'Blocked domain' }, { status: 403 });
//     }

//     console.log(`Scraping URL: ${targetUrl} with ${puppeteer ? 'Puppeteer' : 'fetch'}`);

//     let html;
//     let metadata = {};

//     if (puppeteer && (waitForJs || isJavaScriptHeavySite(url.hostname))) {
//       // Use Puppeteer for JavaScript-heavy sites
//       html = await scrapeWithPuppeteer(targetUrl, { preserveCSS, screenshot });
//     } else {
//       // Use regular fetch for simple sites
//       html = await scrapeWithFetch(targetUrl);
//     }

//     if (preserveCSS) {
//       html = await enhanceHtmlForCSS(html, targetUrl);
//     }

//     // Add our selection script if preserveCSS is true
//     if (preserveCSS) {
//       html = addSelectionScript(html);
//     }

//     // Set proper headers for the response
//     const responseHeaders = new Headers();
//     responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
//     responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
//     responseHeaders.set('X-Frame-Options', 'SAMEORIGIN');
//     responseHeaders.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';");
    
//     return new Response(html, { headers: responseHeaders });

//   } catch (error) {
//     console.error('Proxy error:', error);
//     return createErrorPage(error, targetUrl);
//   }
// }

// // Check if site is JavaScript-heavy and needs Puppeteer
// function isJavaScriptHeavySite(hostname) {
//   const jsSites = [
//     'medium.com',
//     'twitter.com',
//     'x.com',
//     'facebook.com',
//     'instagram.com',
//     'linkedin.com',
//     'youtube.com',
//     'reddit.com',
//     'discord.com',
//     'notion.so',
//     'figma.com',
//     'miro.com',
//     'canva.com',
//     'airtable.com',
//     'typeform.com'
//   ];
  
//   return jsSites.some(site => hostname.includes(site));
// }

// // Scrape with Puppeteer (for JavaScript-heavy sites)
// async function scrapeWithPuppeteer(targetUrl, options = {}) {
//   let browser;
  
//   try {
//     console.log('Launching Puppeteer browser...');
    
//     // Browser configuration
//     const browserOptions = {
//       headless: 'new', // Use new headless mode
//       args: [
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//         '--disable-gpu',
//         '--no-first-run',
//         '--no-default-browser-check',
//         '--disable-background-timer-throttling',
//         '--disable-backgrounding-occluded-windows',
//         '--disable-renderer-backgrounding',
//         '--disable-features=TranslateUI',
//         '--disable-ipc-flooding-protection',
//         '--window-size=1920,1080'
//       ],
//     };

//     // Use different options for different environments
//     if (process.env.NODE_ENV === 'production') {
//       browserOptions.executablePath = '/usr/bin/google-chrome-stable';
//     }

//     browser = await puppeteer.launch(browserOptions);
//     const page = await browser.newPage();

//     // Set viewport and user agent
//     await page.setViewport({ width: 1920, height: 1080 });
//     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

//     // Block unnecessary resources for faster loading
//     await page.setRequestInterception(true);
//     page.on('request', (req) => {
//       const resourceType = req.resourceType();
//       const url = req.url();
      
//       // Block ads and tracking
//       if (resourceType === 'image' && url.includes('ads') || 
//           url.includes('analytics') || 
//           url.includes('tracking') ||
//           url.includes('facebook.com') ||
//           url.includes('doubleclick') ||
//           url.includes('googlesyndication')) {
//         req.abort();
//       } else {
//         req.continue();
//       }
//     });

//     console.log(`Navigating to: ${targetUrl}`);
    
//     // Navigate to the page
//     await page.goto(targetUrl, { 
//       waitUntil: 'domcontentloaded',
//       timeout: 30000 
//     });

//     // Wait for content to load (especially for SPAs)
//     try {
//       await page.waitForSelector('body', { timeout: 5000 });
      
//       // Additional wait for specific sites
//       const hostname = new URL(targetUrl).hostname;
//       if (hostname.includes('medium.com')) {
//         await page.waitForSelector('article, [data-testid="storyContent"]', { timeout: 10000 });
//         await page.waitForTimeout(2000); // Additional wait for dynamic content
//       }
//     } catch (e) {
//       console.log('Timeout waiting for selectors, continuing...');
//     }

//     // Scroll to load lazy-loaded content
//     await autoScroll(page);

//     // Get the final HTML
//     const html = await page.content();
    
//     console.log(`Successfully scraped ${html.length} characters from ${targetUrl}`);
    
//     return html;

//   } catch (error) {
//     console.error('Puppeteer scraping error:', error);
//     throw new Error(`Browser scraping failed: ${error.message}`);
//   } finally {
//     if (browser) {
//       await browser.close();
//     }
//   }
// }

// // Auto-scroll function to load lazy content
// async function autoScroll(page) {
//   await page.evaluate(async () => {
//     await new Promise((resolve) => {
//       let totalHeight = 0;
//       const distance = 100;
//       const timer = setInterval(() => {
//         const scrollHeight = document.body.scrollHeight;
//         window.scrollBy(0, distance);
//         totalHeight += distance;

//         if(totalHeight >= scrollHeight || totalHeight > 5000){
//           clearInterval(timer);
//           resolve();
//         }
//       }, 100);
//     });
//   });
  
//   // Scroll back to top
//   await page.evaluate(() => window.scrollTo(0, 0));
// }

// // Fallback fetch method
// async function scrapeWithFetch(targetUrl) {
//   const headers = {
//     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
//     'Accept-Language': 'en-US,en;q=0.9',
//     'Accept-Encoding': 'gzip, deflate, br',
//     'Cache-Control': 'no-cache',
//     'Pragma': 'no-cache',
//     'Sec-Fetch-Dest': 'document',
//     'Sec-Fetch-Mode': 'navigate',
//     'Sec-Fetch-Site': 'none',
//     'Sec-Fetch-User': '?1',
//     'Upgrade-Insecure-Requests': '1',
//     'DNT': '1',
//   };

//   const response = await fetch(targetUrl, {
//     headers,
//     redirect: 'follow',
//     signal: AbortSignal.timeout(15000),
//   });

//   if (!response.ok) {
//     throw new Error(`HTTP ${response.status}: ${response.statusText}`);
//   }

//   const contentType = response.headers.get('content-type') || '';
//   if (!contentType.includes('text/html')) {
//     throw new Error(`Expected HTML but got ${contentType}`);
//   }

//   const html = await response.text();
  
//   if (!html.includes('<html') && !html.includes('<HTML')) {
//     throw new Error('Response is not valid HTML content');
//   }

//   return html;
// }

// // Add text selection script
// function addSelectionScript(html) {
//   const selectionScript = `
//     <script>
//       document.addEventListener('DOMContentLoaded', function() {
//         document.addEventListener('mouseup', function(e) {
//           const selection = window.getSelection();
//           const selectedText = selection.toString().trim();
//           if (selectedText && selectedText.length > 0 && selectedText.length < 1000) {
//             parent.postMessage({
//               type: 'highlight',
//               text: selectedText
//             }, '*');
//           }
//         });

//         document.addEventListener('click', function(e) {
//           const target = e.target;
//           if (target.tagName === 'A' && target.href) {
//             e.preventDefault();
//             parent.postMessage({
//               type: 'navigate',
//               url: target.href
//             }, '*');
//           }
//         });

//         const style = document.createElement('style');
//         style.textContent = \`
//           ::selection {
//             background-color: rgba(147, 51, 234, 0.3) !important;
//             color: inherit !important;
//           }
//           ::-moz-selection {
//             background-color: rgba(147, 51, 234, 0.3) !important;
//             color: inherit !important;
//           }
//           body {
//             user-select: text !important;
//           }
//         \`;
//         document.head.appendChild(style);
//       });
//     </script>
//   `;

//   return html.replace('</body>', selectionScript + '</body>');
// }

// async function enhanceHtmlForCSS(html, baseUrl) {
//   try {
//     const baseUrlObj = new URL(baseUrl);
//     const baseOrigin = baseUrlObj.origin;
    
//     // Clean up malformed HTML
//     html = html
//       .replace(/data-rh="true"\s+(?=\w+=")/g, 'data-rh="true" ')
//       .replace(/(\w+)=([^"'\s>]+)(\s|>)/g, '$1="$2"$3')
//       .replace(/(\w+="[^"]*")\s+\1/g, '$1');

//     // Fix URLs
//     let enhancedHtml = html
//       .replace(
//         /<link([^>]*?\s+href=["'])(?!https?:\/\/|\/\/|data:|#)([^"']+)(["'][^>]*)>/gi,
//         (match, prefix, path, suffix) => {
//           try {
//             const fullUrl = path.startsWith('/') 
//               ? `${baseOrigin}${path}` 
//               : new URL(path, baseUrl).href;
//             return `<link${prefix}${fullUrl}${suffix}>`;
//           } catch (e) {
//             return match;
//           }
//         }
//       )
//       .replace(
//         /<script([^>]*?\s+src=["'])(?!https?:\/\/|\/\/|data:)([^"']+)(["'][^>]*)>/gi,
//         (match, prefix, path, suffix) => {
//           try {
//             const fullUrl = path.startsWith('/') 
//               ? `${baseOrigin}${path}` 
//               : new URL(path, baseUrl).href;
//             return `<script${prefix}${fullUrl}${suffix}>`;
//           } catch (e) {
//             return match;
//           }
//         }
//       )
//       .replace(
//         /<img([^>]*?\s+src=["'])(?!https?:\/\/|\/\/|data:)([^"']+)(["'][^>]*)>/gi,
//         (match, prefix, path, suffix) => {
//           try {
//             const fullUrl = path.startsWith('/') 
//               ? `${baseOrigin}${path}` 
//               : new URL(path, baseUrl).href;
//             return `<img${prefix}${fullUrl}${suffix}>`;
//           } catch (e) {
//             return match;
//           }
//         }
//       );

//     // Add base tag
//     if (!enhancedHtml.includes('<base ')) {
//       enhancedHtml = enhancedHtml.replace(
//         /<head>/i,
//         `<head>\n<base href="${baseOrigin}/">`
//       );
//     }

//     return enhancedHtml;
//   } catch (error) {
//     console.error('Error enhancing HTML:', error);
//     return html;
//   }
// }

// function createErrorPage(error, targetUrl) {
//   const errorHtml = `
//   <!DOCTYPE html>
//   <html lang="en">
//   <head>
//       <meta charset="UTF-8">
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <title>Loading Error</title>
//       <style>
//           body {
//               font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//               display: flex;
//               justify-content: center;
//               align-items: center;
//               min-height: 100vh;
//               margin: 0;
//               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//               color: white;
//           }
//           .error-container {
//               text-align: center;
//               max-width: 600px;
//               padding: 3rem;
//               background: rgba(255,255,255,0.1);
//               backdrop-filter: blur(10px);
//               border-radius: 20px;
//               border: 1px solid rgba(255,255,255,0.2);
//           }
//           .error-icon { font-size: 4rem; margin-bottom: 1rem; }
//           .error-title { font-size: 2rem; font-weight: 600; margin-bottom: 1rem; }
//           .error-message { margin-bottom: 1.5rem; line-height: 1.6; opacity: 0.9; }
//           .error-details { 
//               font-size: 0.875rem; 
//               background: rgba(0,0,0,0.2); 
//               padding: 1rem; 
//               border-radius: 12px; 
//               margin-bottom: 1.5rem;
//               font-family: monospace;
//               text-align: left;
//               word-break: break-all;
//           }
//           .button-group {
//               display: flex;
//               gap: 1rem;
//               justify-content: center;
//               flex-wrap: wrap;
//           }
//           .retry-button, .original-link {
//               background: rgba(255,255,255,0.2);
//               color: white;
//               border: 1px solid rgba(255,255,255,0.3);
//               padding: 0.75rem 1.5rem;
//               border-radius: 12px;
//               font-weight: 500;
//               cursor: pointer;
//               text-decoration: none;
//               transition: all 0.3s ease;
//               display: inline-flex;
//               align-items: center;
//               gap: 0.5rem;
//           }
//           .retry-button:hover, .original-link:hover { 
//               background: rgba(255,255,255,0.3);
//               transform: translateY(-2px);
//           }
//           .puppeteer-note {
//               margin-top: 2rem;
//               padding: 1rem;
//               background: rgba(255,193,7,0.1);
//               border: 1px solid rgba(255,193,7,0.3);
//               border-radius: 12px;
//               font-size: 0.875rem;
//               line-height: 1.5;
//           }
//       </style>
//   </head>
//   <body>
//       <div class="error-container">
//           <div class="error-icon">🤖</div>
//           <h1 class="error-title">Browser Scraping Failed</h1>
//           <p class="error-message">
//               Our advanced browser scraping couldn't load this webpage. 
//               This might be due to anti-bot protection, network issues, or server restrictions.
//           </p>
//           <div class="error-details">
//               Error: ${error.message}<br>
//               URL: ${targetUrl}<br>
//               Browser: ${puppeteer ? 'Puppeteer Available' : 'Puppeteer Not Available'}
//           </div>
//           <div class="button-group">
//               <button class="retry-button" onclick="window.location.reload()">
//                   🔄 Try Again
//               </button>
//               <a href="${targetUrl}" target="_blank" class="original-link">
//                   🌐 Open Original
//               </a>
//               <button class="retry-button" onclick="parent.postMessage({type:'switchMode'}, '*')">
//                   🔀 Switch Mode
//               </button>
//           </div>
//           ${!puppeteer ? `
//           <div class="puppeteer-note">
//               ⚠️ <strong>Enhanced browsing not available:</strong><br>
//               Install Puppeteer for better support of JavaScript-heavy sites:<br>
//               <code>npm install puppeteer</code>
//           </div>
//           ` : ''}
//       </div>
//   </body>
//   </html>
//   `;
  
//   return new Response(errorHtml, { 
//     headers: { 'Content-Type': 'text/html; charset=utf-8' },
//     status: 200
//   });
// }

// // Handle CORS preflight
// export async function OPTIONS(request) {
//   return new Response(null, {
//     status: 200,
//     headers: {
//       'Access-Control-Allow-Origin': '*',
//       'Access-Control-Allow-Methods': 'GET, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type',
//     },
//   });
// }