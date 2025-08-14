"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function ViewPage() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const [html, setHtml] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("proxy"); // "proxy" or "direct"
  const [explanation, setExplanation] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [pageContext, setPageContext] = useState("");
  const [showFloatingAI, setShowFloatingAI] = useState(false);
  const [floatingInput, setFloatingInput] = useState("");
  const iframeRef = useRef(null);

  // Fetch HTML from proxy API with better CSS preservation
  useEffect(() => {
    if (url) {
      setLoading(true);
      setError("");
      
      // Use enhanced browser scraping for better results
      const apiUrl = `/api/proxy?url=${encodeURIComponent(url)}&preserveCSS=true&waitForJs=true`;
      
      fetch(apiUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.text();
        })
        .then((fetchedHtml) => {
          // Process HTML to fix relative URLs and preserve styling
          const processedHtml = processHtmlForIframe(fetchedHtml, url);
          setHtml(processedHtml);
          
          // Extract page context for better explanations
          setPageContext(extractPageContext(fetchedHtml));
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error loading page:", err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [url]);

  // Extract page context for better explanations
  const extractPageContext = (html) => {
    try {
      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      // Extract meta description
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const description = descMatch ? descMatch[1].trim() : '';
      
      // Extract some text content (first few paragraphs)
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        const bodyContent = bodyMatch[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 500);
        
        return {
          title,
          description,
          url,
          content: bodyContent
        };
      }
      
      return { title, description, url, content: '' };
    } catch (error) {
      console.error('Error extracting page context:', error);
      return { title: '', description: '', url, content: '' };
    }
  };
  // Process HTML to fix relative URLs and add selection functionality
  const processHtmlForIframe = (html, baseUrl) => {
    try {
      const baseUrlObj = new URL(baseUrl);
      const baseOrigin = baseUrlObj.origin;
      const basePath = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);

      // Fix relative URLs in the HTML
      let processedHtml = html
        // Fix CSS links
        .replace(
          /href="(?!https?:\/\/|\/\/|data:|#)([^"]+\.css[^"]*)"/gi,
          (match, path) => {
            const fullUrl = path.startsWith('/') 
              ? `${baseOrigin}${path}` 
              : `${baseOrigin}${basePath}${path}`;
            return `href="${fullUrl}"`;
          }
        )
        // Fix image sources
        .replace(
          /src="(?!https?:\/\/|\/\/|data:)([^"]+)"/gi,
          (match, path) => {
            const fullUrl = path.startsWith('/') 
              ? `${baseOrigin}${path}` 
              : `${baseOrigin}${basePath}${path}`;
            return `src="${fullUrl}"`;
          }
        )
        // Fix script sources
        .replace(
          /<script[^>]+src="(?!https?:\/\/|\/\/|data:)([^"]+)"/gi,
          (match, path) => {
            const fullUrl = path.startsWith('/') 
              ? `${baseOrigin}${path}` 
              : `${baseOrigin}${basePath}${path}`;
            return match.replace(/src="[^"]+"/, `src="${fullUrl}"`);
          }
        )
        // Fix background images in style attributes
        .replace(
          /url\(["']?(?!https?:\/\/|\/\/|data:)([^"')]+)["']?\)/gi,
          (match, path) => {
            const fullUrl = path.startsWith('/') 
              ? `${baseOrigin}${path}` 
              : `${baseOrigin}${basePath}${path}`;
            return `url("${fullUrl}")`;
          }
        );

      // Add base tag for remaining relative URLs
      if (!processedHtml.includes('<base ')) {
        processedHtml = processedHtml.replace(
          '<head>',
          `<head>\n<base href="${baseOrigin}${basePath}">`
        );
      }

      // Add text selection functionality
      const selectionScript = `
        <script>
          document.addEventListener('mouseup', function() {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            if (selectedText && selectedText.length > 0 && selectedText.length < 500) {
              parent.postMessage({
                type: 'highlight',
                text: selectedText
              }, '*');
            }
          });

          // Add visual feedback for selection
          document.addEventListener('selectstart', function(e) {
            document.body.style.userSelect = 'text';
          });

          // Prevent some navigation issues
          document.addEventListener('click', function(e) {
            const target = e.target;
            if (target.tagName === 'A' && target.href) {
              e.preventDefault();
              parent.postMessage({
                type: 'navigate',
                url: target.href
              }, '*');
            }
          });

          // Add some styling to make selection more visible
          const style = document.createElement('style');
          style.textContent = \`
            ::selection {
              background-color: rgba(147, 51, 234, 0.3) !important;
              color: inherit !important;
            }
            ::-moz-selection {
              background-color: rgba(147, 51, 234, 0.3) !important;
              color: inherit !important;
            }
          \`;
          document.head.appendChild(style);
        </script>
      `;

      // Insert the script before closing body tag
      processedHtml = processedHtml.replace('</body>', selectionScript + '</body>');

      return processedHtml;
    } catch (error) {
      console.error('Error processing HTML:', error);
      return html; // Return original HTML if processing fails
    }
  };

  // Listen for messages from iframe
  useEffect(() => {
    function handleMessage(event) {
      if (event.data?.type === "highlight") {
        setSelectedText(event.data.text);
      } else if (event.data?.type === "navigate") {
        // Handle internal navigation
        window.open(event.data.url, '_blank');
      } else if (event.data?.type === "switchMode") {
        // Handle switch mode request from error page
        switchViewMode();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handle explain functionality with LLM
  const handleExplain = async () => {
    setIsExplaining(true);
    setShowExplanation(true);
    setExplanation("");

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText,
          pageContext,
          requestType: 'explain'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setExplanation(data.explanation || "No explanation received");
      
    } catch (error) {
      console.error('Explanation error:', error);
      setExplanation(`Sorry, I couldn't explain this right now. Error: ${error.message}`);
    }

    setIsExplaining(false);
  };

  // Handle different types of AI assistance
  const handleAIAction = async (action) => {
    setIsExplaining(true);
    setShowExplanation(true);
    setExplanation("");

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText,
          pageContext,
          requestType: action
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setExplanation(data.explanation || "No response received");
      
    } catch (error) {
      console.error('AI action error:', error);
      setExplanation(`Sorry, I couldn't process this right now. Error: ${error.message}`);
    }

    setIsExplaining(false);
  };

  // Handle floating AI assistant
  const handleFloatingAI = async () => {
    if (!floatingInput.trim()) return;
    
    setIsExplaining(true);
    setShowExplanation(true);
    setExplanation("");
    setSelectedText(floatingInput); // Use the input as "selected text"

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText: floatingInput,
          pageContext: { ...pageContext, note: "User manually entered text for analysis" },
          requestType: 'explain'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setExplanation(data.explanation || "No explanation received");
      
    } catch (error) {
      console.error('Floating AI error:', error);
      setExplanation(`Sorry, I couldn't process this right now. Error: ${error.message}`);
    }

    setIsExplaining(false);
    setShowFloatingAI(false);
    setFloatingInput("");
  };

  // Close explanation and reset selection
  const closeExplanation = () => {
    setShowExplanation(false);
    setSelectedText("");
    setExplanation("");
  };

  // Handle view mode switching
  const switchViewMode = () => {
    const newMode = viewMode === "proxy" ? "direct" : "proxy";
    setViewMode(newMode);
    
    // Clear any existing selections when switching modes
    setSelectedText("");
    setShowExplanation(false);
    setExplanation("");
    
    // Show warning for direct mode
    if (newMode === "direct") {
      alert("Note: Text selection and AI features are disabled in Direct Mode due to browser security restrictions. Switch back to Proxy Mode to use these features.");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-950">
        <div className="p-4 bg-gray-900 text-white border-b border-gray-800">
          <h1 className="text-lg font-semibold">Loading...</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading page content...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-950">
        <div className="p-4 bg-gray-900 text-white border-b border-gray-800">
          <h1 className="text-lg font-semibold text-red-400">Error Loading Page</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-gray-400 mb-4">Failed to load: {error}</p>
            <div className="space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
              >
                Retry
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors inline-block"
              >
                Open Original
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-950">
      {/* Enhanced Header */}
      <div className="p-4 bg-gray-900 text-white border-b border-gray-800">
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{url}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-400">
                View Mode: {viewMode === "proxy" ? "Enhanced (with AI features)" : "Direct (limited features)"}
              </p>
              {viewMode === "direct" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                  ⚠️ No AI features
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3 ml-4">
            <button
              onClick={() => setShowFloatingAI(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 text-sm rounded transition-colors flex items-center gap-1"
              title="Ask AI about anything on this page"
            >
              🤖 Ask AI
            </button>
            <button
              onClick={switchViewMode}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === "proxy" 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
            >
              {viewMode === "proxy" ? "Switch to Direct" : "Switch to Enhanced"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm rounded transition-colors"
            >
              Open Original
            </a>
          </div>
        </div>
      </div>

      {/* Enhanced Iframe viewer */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {viewMode === "proxy" ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            className="w-full h-full border-none bg-white"
            onLoad={() => {
              console.log('Enhanced iframe loaded with AI features');
            }}
          />
        ) : (
          <>
            <iframe
              src={url}
              className="w-full h-full border-none bg-white"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation"
              onError={() => setError("Direct iframe loading failed")}
              onLoad={() => {
                console.log('Direct iframe loaded');
              }}
            />
            {/* Direct Mode Overlay with Instructions */}
            <div className="absolute top-4 left-4 bg-black/80 text-white px-4 py-2 rounded-lg text-sm max-w-sm">
              <p className="font-medium mb-1">🌐 Direct Mode</p>
              <p className="text-xs opacity-90">
                Viewing original site directly. Switch to Enhanced Mode for AI features and text selection.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Enhanced Highlight popup - Only show in proxy mode */}
      {selectedText && !showExplanation && viewMode === "proxy" && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-700 to-purple-800 text-white px-5 py-4 rounded-xl shadow-2xl animate-fadeIn border border-purple-600 max-w-sm z-50">
          <div className="mb-3">
            <p className="text-sm font-medium mb-2">Selected text:</p>
            <p className="text-sm bg-purple-800/50 p-2 rounded italic">
              "{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExplain}
              className="bg-white text-purple-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm flex items-center"
            >
              🧠 Explain
            </button>
            <button
              onClick={() => handleAIAction('simplify')}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center"
            >
              📝 Simplify
            </button>
            <button
              onClick={() => handleAIAction('translate')}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center"
            >
              🌐 Translate
            </button>
            <button
              onClick={() => setSelectedText("")}
              className="bg-purple-600/50 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* AI Explanation Panel */}
      {showExplanation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[80vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-white">AI Assistant</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Analyzing: "{selectedText.length > 50 ? selectedText.substring(0, 50) + '...' : selectedText}"
                </p>
              </div>
              <button 
                onClick={closeExplanation}
                className="text-gray-400 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {isExplaining ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Analyzing and generating explanation...</p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <div className="bg-gray-800 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Selected Text:</h4>
                    <p className="text-white italic">"{selectedText}"</p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-white mb-3">Explanation:</h4>
                    <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {explanation || "No explanation available"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-700 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => handleAIAction('explain')}
                  disabled={isExplaining}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  🧠 Re-explain
                </button>
                <button
                  onClick={() => handleAIAction('examples')}
                  disabled={isExplaining}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  📋 Examples
                </button>
                <button
                  onClick={() => handleAIAction('related')}
                  disabled={isExplaining}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  🔗 Related
                </button>
              </div>
              <button
                onClick={closeExplanation}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Assistant Input - Works in both modes */}
      {showFloatingAI && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">🤖 AI Assistant</h3>
                <button 
                  onClick={() => {setShowFloatingAI(false); setFloatingInput("");}}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-gray-300 mb-4 text-sm">
                Ask me anything about this webpage, paste text to explain, or get help understanding concepts.
              </p>
              
              <div className="space-y-4">
                <textarea
                  value={floatingInput}
                  onChange={(e) => setFloatingInput(e.target.value)}
                  placeholder="Paste text here to explain, or ask me anything about this webpage..."
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-600 focus:border-purple-500 min-h-[100px] resize-vertical"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleFloatingAI();
                    }
                  }}
                />
                
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">
                    Press Ctrl+Enter to submit
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {setShowFloatingAI(false); setFloatingInput("");}}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFloatingAI}
                      disabled={!floatingInput.trim() || isExplaining}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      {isExplaining ? "Processing..." : "Ask AI"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}