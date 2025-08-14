// app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";


export default function Page() {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIntent, setCurrentIntent] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const TabShell = dynamic(() => import("@/components/TabShell"), { ssr: false });

  const chatEndRef = useRef(null);
  const router = useRouter();

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isBotTyping]);

   useEffect(() => {
    if (window?.orb) {
      console.log("orb context ready");
    }
  }, []);

  const handleSearch = async (query) => {
    setIsLoading(true);
    setCurrentIntent(null);
    console.log("Searching for:", query);
    
    try {
      // First, classify the intent using Gemini
      const intentResponse = await fetch('/api/classify-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const intentData = await intentResponse.json();
      const intent = intentData.intent;
      setCurrentIntent(intent);

      console.log("Classified intent:", intent);

      // Route based on intent
      switch (intent) {
        case 'BROWSE':
          await handleBrowseIntent(query);
          break;
        case 'LEARN':
          await handleLearnIntent(query);
          break;
        case 'MINDMAP':
          await handleMindmapIntent(query);
          break;
        case 'CHAT':
          handleChatIntent(query);
          break;
        default:
          await handleBrowseIntent(query);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to browse if classification fails
      await handleBrowseIntent(query);
    }
  };

  const handleBrowseIntent = async (query) => {
    console.log("Browsing for:", query);
    
    try {
      // Call Google Search API
      const searchResponse = await fetch(`/api/browse?q=${encodeURIComponent(query)}`);
      const searchData = await searchResponse.json();
      
      if (searchResponse.ok && searchData.results) {
        setSearchResults(searchData.results.map(result => ({
          ...result,
          description: result.snippet,
          url: result.link
        })));
      } else {
        console.error('Search API error:', searchData.error);
        // Fallback results
        setSearchResults([
          { 
            id: 1, 
            type: 'browse', 
            title: `Search results for "${query}"`, 
            description: "Unable to fetch live results. Please try again.",
            url: '#'
          }
        ]);
      }
    } catch (error) {
      console.error('Browse search error:', error);
      // Fallback results
      setSearchResults([
        { 
          id: 1, 
          type: 'browse', 
          title: `Search error for "${query}"`, 
          description: "Network error occurred. Please check your connection and try again.",
          url: '#'
        }
      ]);
    }
    
    setIsLoading(false);
  };

  const handleLearnIntent = async (query) => {
    console.log("Creating learning roadmap for:", query);
    
    // Call your roadmap API here
    // const roadmapResponse = await fetch('/api/roadmap', { ... });
    
    setTimeout(() => {
      setSearchResults([
        { id: 1, type: 'learn', title: `Learning Path: ${query}`, description: "Structured learning roadmap generated for you" },
        { id: 2, type: 'learn', title: "Recommended Resources", description: "Curated learning materials and courses" },
      ]);
      setIsLoading(false);
    }, 1000);
  };

  const handleMindmapIntent = async (query) => {
    console.log("Creating mindmap for:", query);
    
    // Call your mindmap API here
    // const mindmapResponse = await fetch('/api/mindmap', { ... });
    
    setTimeout(() => {
      setSearchResults([
        { id: 1, type: 'mindmap', title: `Mind Map: ${query}`, description: "Visual concept map generated for your topic" },
        { id: 2, type: 'mindmap', title: "Related Concepts", description: "Connected ideas and relationships" },
      ]);
      setIsLoading(false);
    }, 1000);
  };


const fetchGeminiReply = async (prompt) => {
  setIsBotTyping(true);
  try {
    const res = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        prompt: prompt 
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    const reply = data.reply || "⚠️ No response from Gemini.";
    setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    
  } catch (err) {
    console.error("Gemini chat error:", err);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `⚠️ Sorry, something went wrong: ${err.message}` },
    ]);
  }
  setIsBotTyping(false);
};


  //code for handling chat intet
  const handleChatIntent = async (query) => {
    console.log("Opening chat for:", query);
    setShowChat(true);
    setSearchResults([]);
    setMessages([{ role: "user", text: query }]); // User’s first message
    await fetchGeminiReply(query);
    setIsLoading(false);
  };
 
  //sending message in chat
   const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setChatInput("");
    await fetchGeminiReply(userMessage);
  };



const handleClick = (url) => {
  if (window.orb) {
    window.orb.createTab(url); // uses the new tabs:create IPC
  } else {
    window.open(url, "_blank"); // fallback for web mode
  }
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
      <TabShell />
      {/* Header/Nav */}
      <nav className="p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Project-Orb</h1>
          {/* Add nav items here */}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero section */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-white mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Learn Anything
            </h1>
            <p className="text-xl text-gray-300 mb-12">
              The Most Advanced AI-Powered Learning Assistant
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-12">
            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Intent indicator */}
          {currentIntent && (
            <div className="mb-6">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                currentIntent === 'BROWSE' ? 'bg-blue-500/20 text-blue-400' :
                currentIntent === 'LEARN' ? 'bg-green-500/20 text-green-400' :
                currentIntent === 'MINDMAP' ? 'bg-purple-500/20 text-purple-400' :
                'bg-pink-500/20 text-pink-400'
              }`}>
                <span className="mr-2">
                  {currentIntent === 'BROWSE' ? '🌐' :
                   currentIntent === 'LEARN' ? '📚' :
                   currentIntent === 'MINDMAP' ? '🧠' : '💬'}
                </span>
                {currentIntent} Mode
              </div>
            </div>
          )}

          {/* Chat Panel */}
         {showChat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl h-[80vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Chat Assistant</h3>
              <button 
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white rounded-br-none"
                        : "bg-gray-800 text-gray-200 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 text-gray-400 px-4 py-3 rounded-2xl rounded-bl-none">
                    <span className="animate-pulse">● ● ●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-600 focus:border-purple-500"
              />
              <button
                onClick={sendMessage}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && !isLoading && (
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className={`backdrop-blur-sm border rounded-lg p-6 hover:border-opacity-75 transition-all duration-300 cursor-pointer ${
                    result.type === 'browse' ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50' :
                    result.type === 'learn' ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50' :
                    result.type === 'mindmap' ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50' :
                    'bg-gray-800/50 border-gray-700'
                  }`}
                    onClick={() => handleClick(result.url)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-2 line-clamp-2">{result.title}</h3>
                      {result.displayLink && (
                        <p className="text-green-400 text-sm mb-2">{result.displayLink}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {result.thumbnail && (
                        <img 
                          src={result.thumbnail} 
                          alt="" 
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <span className="text-2xl">
                        {result.type === 'browse' ? '🌐' :
                         result.type === 'learn' ? '📚' :
                         result.type === 'mindmap' ? '🧠' : '💬'}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm line-clamp-3">{result.description}</p>
                  {result.url && result.url !== '#' && (
                    <div className="mt-3 flex items-center text-blue-400 text-sm">
                      <span>Click to visit →</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 mt-auto">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2025 Torchbits. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}