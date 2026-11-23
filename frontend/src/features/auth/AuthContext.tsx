import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  authApi,
  type Company,
  type LoginInput,
  type PendingInvitation,
  type RegisterInput,
  type User,
} from "../../shared/api/auth";
import { setActiveCompanyHeader } from "../../shared/api/http";

interface AuthContextType {
  user: User | null;
  companies: Company[];
  currentCompany: Company | null;
  pendingInvitations: PendingInvitation[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentCompany: (company: Company) => void;
  refreshUser: () => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setCurrentCompany = useCallback((company: Company) => {
    setCurrentCompanyState(company);
    setActiveCompanyHeader(company.id);
  }, []);

  const applyCompanyList = useCallback(
    (list: Company[], preferredId?: string) => {
      setCompanies(list);
      if (list.length === 0) {
        setCurrentCompanyState(null);
        setActiveCompanyHeader(null);
        return;
      }
      setCurrentCompanyState((prev) => {
        const targetId = preferredId || prev?.id;
        const matched = list.find((c) => c.id === targetId) || list[0];
        setActiveCompanyHeader(matched.id);
        return matched;
      });
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const me = await authApi.getMe();
    if (!me) {
      setUser(null);
      setCompanies([]);
      setCurrentCompanyState(null);
      setPendingInvitations([]);
      setActiveCompanyHeader(null);
      return;
    }
    setUser(me.user);
    setPendingInvitations(me.pendingInvitations || []);
    applyCompanyList(me.companies);
  }, [applyCompanyList]);

  useEffect(() => {
    let active = true;
    void authApi
      .getMe()
      .then((me) => {
        if (!active) return;
        if (!me) {
          setUser(null);
          setCompanies([]);
          setCurrentCompanyState(null);
          setPendingInvitations([]);
          setActiveCompanyHeader(null);
          return;
        }
        setUser(me.user);
        setPendingInvitations(me.pendingInvitations || []);
        applyCompanyList(me.companies);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyCompanyList]);

  const login = async (input: LoginInput) => {
    const res = await authApi.login(input);
    setUser(res.user);
    setPendingInvitations(res.pendingInvitations || []);
    const list = res.companies || [];
    applyCompanyList(list, list[0]?.id);
  };

  const register = async (input: RegisterInput) => {
    const res = await authApi.register(input);
    setUser(res.user);
    setPendingInvitations(res.pendingInvitations || []);
    const list = res.companies || (res.company ? [res.company] : []);
    applyCompanyList(list, list[0]?.id);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setCompanies([]);
    setCurrentCompanyState(null);
    setPendingInvitations([]);
    setActiveCompanyHeader(null);
  };

  const acceptInvitation = async (invitationId: string) => {
    const res = await authApi.acceptInvitation(invitationId);
    setPendingInvitations(res.pendingInvitations);
    applyCompanyList(res.companies, res.joinedCompanyId);
  };

  const declineInvitation = async (invitationId: string) => {
    const res = await authApi.declineInvitation(invitationId);
    setPendingInvitations(res.pendingInvitations);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        pendingInvitations,
        isLoading,
        isAuthenticated: Boolean(user && currentCompany),
        login,
        register,
        logout,
        setCurrentCompany,
        refreshUser,
        acceptInvitation,
        declineInvitation,
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
