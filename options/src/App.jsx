import React, { useState, useEffect } from 'react';
import { defaultEmojiGroups } from './emojiData';

const App = () => {
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    chrome.storage.local.get('emojiGroups', (data) => {
      if (data.emojiGroups) {
        setGroups(data.emojiGroups);
      } else {
        setGroups(defaultEmojiGroups);
      }
    });
  }, []);

  const handleGroupNameChange = (index, newName) => {
    const updatedGroups = [...groups];
    updatedGroups[index].name = newName;
    setGroups(updatedGroups);
  };

  const handleEmojiRemove = (groupIndex, emojiIndex) => {
    const updatedGroups = [...groups];
    updatedGroups[groupIndex].emojis.splice(emojiIndex, 1);
    setGroups(updatedGroups);
  };

  const handleAddGroup = () => {
    const newGroup = {
      name: 'New Group',
      prefix: `new-group-${Date.now()}`,
      emojis: [],
    };
    setGroups([...groups, newGroup]);
  };

  const handleSave = () => {
    chrome.storage.local.set({ emojiGroups: groups }, () => {
      setStatus('Settings saved!');
      setTimeout(() => setStatus(''), 2000);
    });
  };

  const handleReset = () => {
    setGroups(defaultEmojiGroups);
    chrome.storage.local.remove('emojiGroups', () => {
      setStatus('Settings reset to default!');
      setTimeout(() => setStatus(''), 2000);
    });
  };

  return (
    <div className="options-root max-w-6xl mx-auto p-4 sm:p-6">
      <div className="toolbar flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Emoji Manager</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleAddGroup} id="add-group" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            添加新分组
          </button>
          <button onClick={handleReset} id="reset-default" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition duration-200">
            恢复默认
          </button>
          <button onClick={handleSave} id="save-data" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition duration-200">
            保存设置
          </button>
        </div>
      </div>

      {status && <div id="status" className="mb-6 p-3 rounded-lg bg-green-100 text-green-700 border border-green-200">{status}</div>}

      <div id="groups" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="group-card bg-white p-4 rounded-lg shadow-md border border-gray-200">
            <input
              type="text"
              value={group.name}
              onChange={(e) => handleGroupNameChange(groupIndex, e.target.value)}
              className="group-name-input text-lg font-semibold text-gray-700 border-b-2 border-gray-300 focus:border-blue-500 outline-none w-full mb-4"
            />
            <div className="emoji-grid grid grid-cols-6 gap-2">
              {group.emojis.map((emoji, emojiIndex) => (
                <div key={emojiIndex} className="emoji-item relative">
                  <img
                    src={`/assets/${group.prefix}/${emoji}`}
                    alt={emoji}
                    className="w-12 h-12 object-contain rounded-md bg-gray-100 p-1"
                  />
                  <button
                    onClick={() => handleEmojiRemove(groupIndex, emojiIndex)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
