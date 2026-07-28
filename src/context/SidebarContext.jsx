import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { CITADELLE_VIEWS } from "./citadelleViews.js";
import { isSettingsChild } from "../config/citadelleNav.js";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [activeView, setActiveView] = useState(CITADELLE_VIEWS.CHAT);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [settingsNavExpanded, setSettingsNavExpanded] = useState(false);

  useEffect(() => {
    if (isSettingsChild(activeView)) {
      setSettingsNavExpanded(true);
    }
  }, [activeView]);

  const navigate = useCallback((viewId) => {
    if (isSettingsChild(viewId)) {
      setSettingsNavExpanded(true);
    }
    setActiveView(viewId);
  }, []);

  const openSessionsView = useCallback(() => {
    setActiveView(CITADELLE_VIEWS.SESSIONS);
  }, []);

  const toggleNavCollapsed = useCallback(() => {
    setIsNavCollapsed((c) => !c);
  }, []);

  const toggleSettingsNav = useCallback(() => {
    setSettingsNavExpanded((open) => !open);
  }, []);

  const value = useMemo(
    () => ({
      activeView,
      setActiveView,
      navigate,
      openSessionsView,
      isNavCollapsed,
      toggleNavCollapsed,
      settingsNavExpanded,
      setSettingsNavExpanded,
      toggleSettingsNav,
      isSettingsChildActive: isSettingsChild(activeView),
    }),
    [
      activeView,
      navigate,
      openSessionsView,
      isNavCollapsed,
      toggleNavCollapsed,
      settingsNavExpanded,
      toggleSettingsNav,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar doit être utilisé dans SidebarProvider");
  }
  return ctx;
}
