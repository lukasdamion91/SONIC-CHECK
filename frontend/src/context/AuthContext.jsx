import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useUser,
} from "@clerk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, formatApiErrorDetail, setApiTokenProvider } from "@/lib/api";
import { canStartScan } from "@/lib/accessPolicy.mjs";

const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || "";
const AuthContext = createContext(null);

const unavailableValue = {
  authConfigured: false,
  isSignedIn: false,
  clerkUser: null,
  user: false,
  loading: false,
  error: "Account access is not configured for this deployment.",
  refresh: async () => null,
  logout: async () => undefined,
  updateRegion: async () => null,
  getToken: async () => null,
  formatApiErrorDetail,
};

function ClerkAuthBridge({ children }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setApiTokenProvider(() => getToken());
    return () => setApiTokenProvider(null);
  }, [getToken]);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setUser(false);
      setError("");
      return null;
    }

    setProfileLoading(true);
    setError("");
    try {
      const name = clerkUser?.fullName || clerkUser?.username || "";
      await api.post("/auth/sync", { name });
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch (requestError) {
      setUser(null);
      setError(
        formatApiErrorDetail(requestError?.response?.data?.detail) ||
          "The account service is temporarily unavailable.",
      );
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [clerkUser?.fullName, clerkUser?.username, isLoaded, isSignedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await signOut({ redirectUrl: "/" });
    setUser(false);
  }, [signOut]);

  const updateRegion = useCallback(async (region) => {
    const { data } = await api.patch("/auth/region", { region });
    setUser(data);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      authConfigured: true,
      isSignedIn: Boolean(isSignedIn),
      clerkUser,
      user: isSignedIn ? user : false,
      loading: !isLoaded || (Boolean(isSignedIn) && (profileLoading || user === null) && !error),
      error,
      refresh,
      logout,
      updateRegion,
      getToken,
      formatApiErrorDetail,
    }),
    [clerkUser, error, getToken, isLoaded, isSignedIn, logout, profileLoading, refresh, updateRegion, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  if (!publishableKey) {
    return <AuthContext.Provider value={unavailableValue}>{children}</AuthContext.Provider>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/login"
      signUpUrl="/join"
      afterSignOutUrl="/"
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function hasScanEntitlement(user) {
  return canStartScan(user);
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

export const clerkPublishableKey = publishableKey;
