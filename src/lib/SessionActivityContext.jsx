import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import SessionIdleWarningDialog from "@/components/shared/SessionIdleWarningDialog";
import {
  SESSION_ACTIVITY_CHANNEL,
  SESSION_IDLE_MS,
  SESSION_IDLE_WARNING_MS,
} from "../../shared/sessionActivityPolicy.js";
import {
  isWithinStripeCheckoutGrace,
  markIdleLogoutFlag,
  readLastActivityAt,
  writeLastActivityAt,
} from "@/lib/sessionActivityStorage";

const SessionActivityContext = createContext(null);

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"];

function isRegisterPath(pathname) {
  return pathname === "/register" || pathname.startsWith("/register/");
}

function isPostEventPath(pathname) {
  return pathname === "/post-event" || pathname.startsWith("/post-event/");
}

export function SessionActivityProvider({ children }) {
  const { isAuthenticated, authChecked, isLoadingAuth, logout } = useAuth();
  const location = useLocation();
  const pauseIdsRef = useRef(new Set());
  const [, bumpPauseVersion] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const channelRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);

  const routePaused = useMemo(() => {
    const { pathname, search } = location;
    if (isRegisterPath(pathname) || isPostEventPath(pathname)) return true;
    if (pathname === "/ad-manager" || pathname.startsWith("/ad-manager/")) {
      if (isWithinStripeCheckoutGrace()) return true;
      const params = new URLSearchParams(search);
      if (params.get("success") === "true" || params.get("cancelled") === "true") return true;
    }
    return false;
  }, [location.pathname, location.search]);

  const manualPaused = pauseIdsRef.current.size > 0;
  const paused = routePaused || manualPaused;

  const monitoringEnabled =
    authChecked && !isLoadingAuth && isAuthenticated;

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const handleIdleLogout = useCallback(async () => {
    clearTimers();
    setShowWarning(false);
    markIdleLogoutFlag();
    await logout(true);
  }, [clearTimers, logout]);

  const scheduleIdleTimers = useCallback(() => {
    clearTimers();
    if (!monitoringEnabled || paused) {
      setShowWarning(false);
      return;
    }

    const idleMs = Date.now() - lastActivityRef.current;
    const msUntilWarning = SESSION_IDLE_MS - SESSION_IDLE_WARNING_MS - idleMs;
    const msUntilLogout = SESSION_IDLE_MS - idleMs;

    if (msUntilLogout <= 0) {
      void handleIdleLogout();
      return;
    }

    if (msUntilWarning <= 0) {
      setShowWarning(true);
      logoutTimerRef.current = setTimeout(() => {
        void handleIdleLogout();
      }, msUntilLogout);
      return;
    }

    setShowWarning(false);
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      logoutTimerRef.current = setTimeout(() => {
        void handleIdleLogout();
      }, SESSION_IDLE_WARNING_MS);
    }, msUntilWarning);
  }, [clearTimers, handleIdleLogout, monitoringEnabled, paused]);

  const recordActivity = useCallback(
    (at = Date.now()) => {
      lastActivityRef.current = at;
      writeLastActivityAt(at);
      setShowWarning(false);
      try {
        channelRef.current?.postMessage({ type: "activity", at });
      } catch {
        // ignore
      }
      scheduleIdleTimers();
    },
    [scheduleIdleTimers]
  );

  const addPause = useCallback((id) => {
    if (!id || pauseIdsRef.current.has(id)) return;
    pauseIdsRef.current.add(id);
    bumpPauseVersion((v) => v + 1);
  }, []);

  const removePause = useCallback((id) => {
    if (!id || !pauseIdsRef.current.has(id)) return;
    pauseIdsRef.current.delete(id);
    bumpPauseVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!monitoringEnabled) {
      clearTimers();
      setShowWarning(false);
      return undefined;
    }

    const stored = readLastActivityAt();
    lastActivityRef.current = stored || Date.now();
    if (!stored) writeLastActivityAt(lastActivityRef.current);
    scheduleIdleTimers();

    const onActivity = () => recordActivity();
    const onVisibility = () => {
      if (document.visibilityState === "visible") recordActivity();
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", onVisibility);

    let channel;
    try {
      channel = new BroadcastChannel(SESSION_ACTIVITY_CHANNEL);
      channelRef.current = channel;
      channel.onmessage = (event) => {
        const { type, at } = event.data || {};
        if (type === "activity" && Number.isFinite(at)) {
          lastActivityRef.current = at;
          setShowWarning(false);
          scheduleIdleTimers();
        }
        if (type === "logout") {
          void handleIdleLogout();
        }
      };
    } catch {
      channelRef.current = null;
    }

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      document.removeEventListener("visibilitychange", onVisibility);
      channel?.close();
      channelRef.current = null;
    };
  }, [monitoringEnabled, scheduleIdleTimers, recordActivity, clearTimers, handleIdleLogout]);

  useEffect(() => {
    if (!monitoringEnabled) return;
    scheduleIdleTimers();
  }, [monitoringEnabled, paused, scheduleIdleTimers]);

  const contextValue = useMemo(
    () => ({ addPause, removePause, recordActivity }),
    [addPause, removePause, recordActivity]
  );

  return (
    <SessionActivityContext.Provider value={contextValue}>
      {children}
      <SessionIdleWarningDialog
        open={showWarning && monitoringEnabled && !paused}
        onStaySignedIn={() => recordActivity()}
        onSignOut={() => {
          try {
            channelRef.current?.postMessage({ type: "logout" });
          } catch {
            // ignore
          }
          void handleIdleLogout();
        }}
      />
    </SessionActivityContext.Provider>
  );
}

export function useSessionActivityPause(id, active = true) {
  const ctx = useContext(SessionActivityContext);

  useEffect(() => {
    if (!ctx || !active || !id) return undefined;
    ctx.addPause(id);
    return () => ctx.removePause(id);
  }, [ctx, id, active]);
}
