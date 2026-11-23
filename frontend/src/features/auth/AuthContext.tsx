import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { api } from "../../shared/api/client";
import type { Company, User } from "../../shared/api/auth";
import { auth, googleAuthProvider } from "../../shared/lib/firebase";
import {
  acceptTeamInvitation,
  createCompanyWorkspace,
  loadUserCompanies,
  previewInvitationForSignedInUser,
  recordActivity,
  updateOwnUserNames,
  upsertUserProfile,
} from "../../shared/lib/firestoreErp";

interface AuthContextType {
  user: User | null;
  companies: Company[];
  currentCompany: Company | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  signInWithGoogle: () => Promise<{ user: User; companies: Company[] }>;
  createCompanyOnboarding: (input: {
    companyName: string;
    firstName?: string;
    lastName?: string;
    seedDemoData?: boolean;
  }) => Promise<Company>;
  acceptInvitationToken: (token: string) => Promise<Company>;
  previewInvitation: (token: string) => Promise<{
    id: string;
    companyId: string;
    companyName: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Company["role"];
  }>;
  logout: () => Promise<void>;
  setCurrentCompany: (company: Company) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setCurrentCompany = useCallback((company: Company) => {
    setCurrentCompanyState(company);
    api.setActiveCompanyId(company.id);
  }, []);

  const syncFromFirebaseUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setUser(null);
      setCompanies([]);
      setCurrentCompanyState(null);
      api.setActiveCompanyId(null);
      return { user: null, companies: [] as Company[] };
    }

    const profile = await upsertUserProfile(fbUser);
    const list = await loadUserCompanies(fbUser.uid);
    setUser(profile);
    setCompanies(list);

    if (list.length > 0) {
      const storedCompanyId = api.getActiveCompanyId();
      const active = list.find((c) => c.id === storedCompanyId) || list[0];
      setCurrentCompany(active);
    } else {
      setCurrentCompanyState(null);
      api.setActiveCompanyId(null);
    }

    return { user: profile, companies: list };
  }, [setCurrentCompany]);

  const refreshUser = useCallback(async () => {
    try {
      await syncFromFirebaseUser();
    } catch (err) {
      console.error("Failed to refresh user state:", err);
    } finally {
      setIsLoading(false);
    }
  }, [syncFromFirebaseUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setCompanies([]);
        setCurrentCompanyState(null);
        api.setActiveCompanyId(null);
        setIsLoading(false);
        return;
      }

      try {
        await syncFromFirebaseUser();
      } catch (err) {
        console.error("Auth sync error:", err);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncFromFirebaseUser]);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const profile = await upsertUserProfile(cred.user);
    const list = await loadUserCompanies(cred.user.uid);
    setUser(profile);
    setCompanies(list);

    if (list.length > 0) {
      const storedId = api.getActiveCompanyId();
      const active = list.find((c) => c.id === storedId) || list[0];
      setCurrentCompany(active);
      await recordActivity(
        active.id,
        profile,
        "auth.login",
        `Connexion de ${profile.firstName || profile.email}`,
      );
    }

    return { user: profile, companies: list };
  };

  const createCompanyOnboarding = async (input: {
    companyName: string;
    firstName?: string;
    lastName?: string;
    seedDemoData?: boolean;
  }) => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error("Veuillez d'abord vous connecter avec Google.");
    }

    let currentProfile = user || (await upsertUserProfile(fbUser));
    if (input.firstName?.trim() || input.lastName?.trim()) {
      const nextFirst = input.firstName?.trim() || currentProfile.firstName;
      const nextLast = input.lastName?.trim() ?? currentProfile.lastName;
      await updateOwnUserNames(fbUser.uid, nextFirst, nextLast);
      currentProfile = {
        ...currentProfile,
        firstName: nextFirst,
        lastName: nextLast,
      };
      setUser(currentProfile);
    }

    const company = await createCompanyWorkspace({
      user: currentProfile,
      companyName: input.companyName,
      seedDemoData: input.seedDemoData,
    });

    const list = await loadUserCompanies(fbUser.uid);
    setCompanies(list);
    setCurrentCompany(company);
    return company;
  };

  const acceptInvitationToken = async (token: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error("Veuillez d'abord vous connecter avec Google.");
    }
    const currentProfile = user || (await upsertUserProfile(fbUser));
    const company = await acceptTeamInvitation(token, currentProfile);
    const list = await loadUserCompanies(fbUser.uid);
    setCompanies(list);
    setCurrentCompany(company);
    return company;
  };

  const previewInvitation = async (token: string) => {
    return previewInvitationForSignedInUser(token);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (user && currentCompany) {
        await recordActivity(
          currentCompany.id,
          user,
          "auth.logout",
          `Déconnexion de ${user.firstName || user.email}`,
        );
      }
      await signOut(auth);
    } catch {
      // Ignore signOut errors client-side
    } finally {
      setUser(null);
      setCompanies([]);
      setCurrentCompanyState(null);
      api.setActiveCompanyId(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        isLoading,
        isAuthenticated: Boolean(user),
        needsOnboarding: Boolean(user) && companies.length === 0,
        signInWithGoogle,
        createCompanyOnboarding,
        acceptInvitationToken,
        previewInvitation,
        logout,
        setCurrentCompany,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
};
