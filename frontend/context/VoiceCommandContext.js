'use client';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

// Context to control the global voice activation and opening of the search modal
const VoiceCommandContext = createContext({
  openSearch: () => {},
  closeSearch: () => {},
  isSearchOpen: false,
});

export const useVoiceCommand = () => useContext(VoiceCommandContext);

export const VoiceCommandProvider = ({ children }) => {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const recognitionRef = useRef(null);

  const openSearch = (startListening = false) => {
    setSearchOpen(true);
    setAutoStart(startListening);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setAutoStart(false);
  };

  useEffect(() => {
    // If search modal is already open, do not run the global listener to avoid microphone conflict
    if (isSearchOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
        recognitionRef.current = null;
      }
      return;
    }

    if (typeof window === 'undefined') return;
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let isActive = false;
    let hasPermission = true;
    let shouldRestart = true;

    // Lenient activation phrase to match "Hey PrashnaSarathi" and common speech-to-text misrecognitions
    const activationPhrase = /(hey\s+)?(prashna|prasna|prishna|prisna|prasanna|krishna|prashan|prasan)\s*(sarathi|sarthi|sarati)/i;

    const startRecognition = () => {
      if (isSearchOpen || isActive) return;
      try {
        // Instantiate a brand new SpeechRecognition object on each start to bypass dead instance restriction
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.trim();
            if (activationPhrase.test(transcript)) {
              toast.success("Hey PrashnaSārathi: Voice Search Activated!", {
                id: 'voice-activate',
                icon: '🎙️'
              });
              openSearch(true);
              break;
            }
          }
        };

        recognition.onerror = (e) => {
          if (e.error !== 'aborted') {
            console.error('Global voice command error', e.error, e);
          }
          if (e.error === 'not-allowed') {
            hasPermission = false;
          }
          isActive = false;
        };

        recognition.onend = () => {
          isActive = false;
          // Keep wake word listener alive forever unless search modal is open, permission is denied, or context destroyed
          if (!isSearchOpen && hasPermission && shouldRestart) {
            setTimeout(startRecognition, 500);
          }
        };

        recognition.start();
        isActive = true;
        recognitionRef.current = recognition;
      } catch (err) {
        console.error('Failed to start global SpeechRecognition:', err);
        isActive = false;
      }
    };

    // Initial start attempt
    startRecognition();

    // User gesture listener to request permissions and start recognition if blocked
    const handleInteraction = async () => {
      if (isSearchOpen) return;
      hasPermission = true;
      if (!isActive) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          console.warn("User dismissed or denied microphone access prompt:", e);
        }
        startRecognition();
      }
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      shouldRestart = false;
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [isSearchOpen]);

  return (
    <VoiceCommandContext.Provider value={{ openSearch, closeSearch, isSearchOpen, autoStart }}>
      {children}
    </VoiceCommandContext.Provider>
  );
};
