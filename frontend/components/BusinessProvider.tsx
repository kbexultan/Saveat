"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/AuthProvider";


export type Business = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
};


export type BusinessMembership = {
  id: string;
  role: string;
  status: string;
  business: Business;
};


type BusinessContextType = {
  memberships: BusinessMembership[];
  selectedMembership: BusinessMembership | null;

  loading: boolean;

  refreshBusiness: () => Promise<void>;

  selectBusiness: (
    businessId: string,
  ) => void;

  clearBusinessState: () => void;
};


const BusinessContext =
  createContext<
    BusinessContextType | undefined
  >(undefined);


const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


const BUSINESS_STORAGE_KEY =
  "saveat_business_id";


export function BusinessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    memberships,
    setMemberships,
  ] = useState<
    BusinessMembership[]
  >([]);

  const [
    selectedMembership,
    setSelectedMembership,
  ] = useState<
    BusinessMembership | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);


  const clearBusinessState =
    useCallback(() => {
      setMemberships([]);
      setSelectedMembership(
        null,
      );

      localStorage.removeItem(
        BUSINESS_STORAGE_KEY,
      );
    }, []);


  const refreshBusiness =
    useCallback(
      async () => {
        const token =
          localStorage.getItem(
            "access_token",
          );

        if (!token) {
          clearBusinessState();
          setLoading(false);
          return;
        }

        try {
          setLoading(true);

          const response =
            await fetch(
              `${API_URL}/business-auth/me`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              },
            );

          if (!response.ok) {
            clearBusinessState();
            return;
          }

          const data: {
            memberships:
              BusinessMembership[];
          } =
            await response.json();

          const nextMemberships =
            data.memberships ?? [];

          setMemberships(
            nextMemberships,
          );

          if (
            nextMemberships.length ===
            0
          ) {
            setSelectedMembership(
              null,
            );

            localStorage.removeItem(
              BUSINESS_STORAGE_KEY,
            );

            return;
          }

          const savedBusinessId =
            localStorage.getItem(
              BUSINESS_STORAGE_KEY,
            );

          const selected =
            nextMemberships.find(
              (membership) =>
                membership.business
                  .id ===
                savedBusinessId,
            ) ??
            nextMemberships[0];

          setSelectedMembership(
            selected,
          );

          localStorage.setItem(
            BUSINESS_STORAGE_KEY,
            selected.business.id,
          );
        } catch {
          clearBusinessState();
        } finally {
          setLoading(false);
        }
      },
      [clearBusinessState],
    );


  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      clearBusinessState();
      setLoading(false);
      return;
    }

    void refreshBusiness();

  }, [
    authLoading,
    user?.id,
    refreshBusiness,
    clearBusinessState,
  ]);


  function selectBusiness(
    businessId: string,
  ) {
    const membership =
      memberships.find(
        (item) =>
          item.business.id ===
          businessId,
      );

    if (!membership) {
      return;
    }

    setSelectedMembership(
      membership,
    );

    localStorage.setItem(
      BUSINESS_STORAGE_KEY,
      businessId,
    );
  }


  return (
    <BusinessContext.Provider
      value={{
        memberships,
        selectedMembership,
        loading,
        refreshBusiness,
        selectBusiness,
        clearBusinessState,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}


export function useBusiness() {
  const context =
    useContext(
      BusinessContext,
    );

  if (!context) {
    throw new Error(
      "useBusiness must be used inside BusinessProvider",
    );
  }

  return context;
}