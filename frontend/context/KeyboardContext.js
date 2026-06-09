'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import SearchModal from '@/components/SearchModal';
import { useVoiceCommand } from '@/context/VoiceCommandContext';

const KeyboardContext = createContext(null);

export function KeyboardProvider({ children }) {
  const { isSearchOpen, openSearch, closeSearch, autoStart } = useVoiceCommand();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }

      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        openSearch();
        return;
      }

      if (e.key === 'Escape') {
        if (isSearchOpen) {
          closeSearch();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, openSearch, closeSearch]);

  const moveSelectionDown = useCallback(() => {
    setSelectedIndex(prev => prev + 1);
  }, []);

  const moveSelectionUp = useCallback(() => {
    setSelectedIndex(prev => Math.max(0, prev - 1));
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  return (
    <KeyboardContext.Provider value={{
      isSearchOpen,
      selectedIndex,
      searchQuery,
      setSelectedIndex,
      setSearchQuery,
      openSearch,
      closeSearch,
      moveSelectionDown,
      moveSelectionUp,
      resetSelection,
    }}>
      {children}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={closeSearch}
        autoStart={autoStart}
      />
    </KeyboardContext.Provider>
  );
}

function isInputFocused() {
  const active = document.activeElement;
  return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
}

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within KeyboardProvider');
  }
  return context;
}