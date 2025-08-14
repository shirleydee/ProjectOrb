import { useState } from "react";
import { Search } from "lucide-react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = () => {
    if (query.trim()) onSearch(query);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Animated background glow */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-full opacity-75 blur-sm transition-all duration-500 ${isFocused ? 'animate-pulse opacity-100' : ''}`}></div>
      
      {/* Main search container */}
      <div className={`relative flex items-center bg-gray-900 rounded-full border transition-all duration-300 ${isFocused ? 'border-purple-500/50 shadow-[0_0_30px_rgba(147,51,234,0.3)]' : 'border-gray-700'}`}>
        
        {/* Search input */}
        <input
          type="text"
          placeholder="Search or ask me anything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-grow bg-transparent text-white placeholder-gray-400 px-6 py-4 outline-none rounded-l-full text-lg"
        />
        
        {/* Search button */}
        <button
          onClick={handleSearch}
          className={`group relative m-1 px-6 py-3 rounded-full transition-all duration-300 ${
            query.trim() 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg hover:shadow-purple-500/25' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          disabled={!query.trim()}
        >
          <Search 
            size={20} 
            className={`transition-all duration-300 ${
              query.trim() ? 'text-white' : 'text-gray-400'
            } group-hover:scale-110`} 
          />
        </button>
      </div>
      
      {/* Subtle glow effect on the bottom */}
      <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent transition-opacity duration-500 ${isFocused ? 'opacity-60' : 'opacity-0'}`}></div>
    </div>
  );
}