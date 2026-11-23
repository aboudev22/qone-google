import React, { createContext, useCallback, useContext, useState } from "react";
import {
  authApi,
  type Company,
  type LoginInput,
  type RegisterInput,
  type User,
} from "../../shared/api/auth";
import {
  getActiveCompanyId,
  localErpStore,
  setActiveCompanyId,
} from "../../shared/lib/localErpStore";

interface AuthContextType {
  user: User | null;
  companies: Company[];
  currentCompany: Company | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentCompany: (company: Company) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readInitialSession(): {
  user: User | null;
  companies: Company[];
  currentCompany: Company | null;
} {
  const me = localErpStore.getMe();
  if (!me || me.companies.length === 0) {
    return { user: null, companies: [], currentCompany: null };
  }
  const storedId = getActiveCompanyId();
  const matched =
    me.companies.find((c) => c.id === storedId) || me.companies[0];
  setActiveCompanyId(matched.id);
  return {
    user: me.user,
    companies: me.companies,
    currentCompany: matched,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [initial] = useState(readInitialSession);
  const [user, setUser] = useState<User | null>(initial.user);
  const [companies, setCompanies] = useState<Company[]>(initial.companies);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(
    initial.currentCompany,
  );

  const setCurrentCompany = useCallback((company: Company) => {
    setCurrentCompanyState(company);
    setActiveCompanyId(company.id);
  }, []);

  const applyCompanyList = useCallback(
    (list: Company[]) => {
      setCompanies(list);
      if (list.length === 0) {
        setCurrentCompanyState(null);
        setActiveCompanyId(null);
        return;
      }
      const storedId = getActiveCompanyId();
      const matched = list.find((c) => c.id === storedId) || list[0];
      setCurrentCompany(matched);
    },
    [setCurrentCompany],
  );

  const refreshUser = useCallback(async () => {
    const me = await authApi.getMe();
    if (!me) {
      setUser(null);
      setCompanies([]);
      setCurrentCompanyState(null);
      setActiveCompanyId(null);
      return;
    }
    setUser(me.user);
    applyCompanyList(me.companies);
  }, [applyCompanyList]);

  const login = async (input: LoginInput) => {
    const res = await authApi.login(input);
    setUser(res.user);
    applyCompanyList(res.companies || []);
  };

  const register = async (input: RegisterInput) => {
    const res = await authApi.register(input);
    setUser(res.user);
    const list = res.companies || (res.company ? [res.company] : []);
    applyCompanyList(list);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setCompanies([]);
    setCurrentCompanyState(null);
    setActiveCompanyId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        isLoading: false,
        isAuthenticated: Boolean(user && currentCompany),
        login,
        register,
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
