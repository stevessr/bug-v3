import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { defaultEmojiGroups } from '../options/src/emojiData';

const Popup = () => {
  const [groups, setGroups] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('emojiGroups', (data) => {
      if (data.emojiGroups && data.emojiGroups.length > 0) {
        setGroups(data.emojiGroups);
      } else {
        setGroups(defaultEmojiGroups);
      }
    });
  }, []);

  const handleEmojiClick = (group, emoji) => {
    const markdown = `![${group.prefix}-${emoji.split('.')[0]}](https://cdn.jsdelivr.net/gh/L-JIN-K/my-emojis@main/${group.prefix}/${emoji})`;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  };

  if (groups.length === 0) {
    return <div className="w-96 p-2 text-center">Loading...</div>;
  }

  return (
    <div className="w-96 p-2">
      <div className="flex border-b">
        {groups.map((group, index) => (
          <button
            key={index}
            className={`px-4 py-2 text-sm font-medium ${activeGroupIndex === index ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveGroupIndex(index)}
          >
            {group.name}
          </button>
        ))}
      </div>
      <div className="py-2 grid grid-cols-8 gap-2 h-64 overflow-y-auto">
        {groups[activeGroupIndex].emojis.map((emoji, index) => (
          <img
            key={index}
            src={`../public/assets/${groups[activeGroupIndex].prefix}/${emoji}`}
            alt={emoji}
            className="w-10 h-10 object-contain rounded-md cursor-pointer hover:bg-gray-200 p-1"
            onClick={() => handleEmojiClick(groups[activeGroupIndex], emoji)}
            title="Click to copy markdown"
          />
        ))}
      </div>
      {copied && <div className="text-center text-green-500 text-xs absolute bottom-1 left-0 right-0">Copied!</div>}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
