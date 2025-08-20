import React, { useState, useEffect } from 'react';
import { defaultEmojiGroups } from '../../options/src/emojiData';

const App = ({ onEmojiSelect }) => {
  const [groups, setGroups] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  useEffect(() => {
    chrome.storage.local.get('emojiGroups', (data) => {
      if (data.emojiGroups && data.emojiGroups.length > 0) {
        setGroups(data.emojiGroups);
      } else {
        setGroups(defaultEmojiGroups);
      }
    });
  }, []);

  if (groups.length === 0) {
    return null;
  }

  const handleEmojiClick = (group, emoji) => {
    const markdown = `![${group.prefix}-${emoji.split('.')[0]}](https://cdn.jsdelivr.net/gh/L-JIN-K/my-emojis@main/${group.prefix}/${emoji})`;
    onEmojiSelect(markdown);
  };

  return (
    <div className="w-96 p-2 bg-white rounded-lg shadow-lg border">
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
            src={chrome.runtime.getURL(`assets/${groups[activeGroupIndex].prefix}/${emoji}`)}
            alt={emoji}
            className="w-10 h-10 object-contain rounded-md cursor-pointer hover:bg-gray-200 p-1"
            onClick={() => handleEmojiClick(groups[activeGroupIndex], emoji)}
            title="Click to insert"
          />
        ))}
      </div>
    </div>
  );
};

export default App;
