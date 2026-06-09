"use client";

import React, { useRef } from 'react';
import { useVoiceCommand } from '@/context/VoiceCommandContext';
import SearchModal from '@/components/SearchModal';

export default function RootLayoutClient() {
  const { isSearchOpen, closeSearch, autoStart } = useVoiceCommand();
  const searchRef = useRef(null);
  return (
    <SearchModal
      ref={searchRef}
      isOpen={isSearchOpen}
      onClose={closeSearch}
      autoStart={autoStart}
    />
  );
}
