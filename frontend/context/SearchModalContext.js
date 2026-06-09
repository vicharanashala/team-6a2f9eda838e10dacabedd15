import { createContext, useContext, useState, useCallback } from 'react';

const SearchModalContext = createContext({
  isOpen: false,
  openModal: () => {},
  closeModal: () => {},
});

export const SearchModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <SearchModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </SearchModalContext.Provider>
  );
};

export const useSearchModal = () => useContext(SearchModalContext);
