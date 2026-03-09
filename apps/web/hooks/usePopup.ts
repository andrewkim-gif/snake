'use client';

/**
 * usePopup — 팝업 URL 상태 동기화 훅
 * ?popup=<name>&section=<section> 또는 ?popup=settings&tab=<tab>
 * 레거시 ?panel= → ?popup= 자동 변환
 * 동시 열기 방지: 하나만 열림
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/* ── 타입 ── */

/** 팝업 이름 (확장 가능) */
export type PopupName =
  | 'economy'
  | 'factions'
  | 'governance'
  | 'hallOfFame'
  | 'settings';

export interface UsePopupReturn {
  /** 현재 열린 팝업 이름 (없으면 null) */
  activePopup: PopupName | null;
  /** 현재 활성 섹션 (서브섹션 또는 설정 탭) */
  activeSection: string | null;
  /** 팝업 열기 + URL 업데이트 */
  openPopup: (name: PopupName, section?: string) => void;
  /** 팝업 닫기 + URL 정리 */
  closePopup: () => void;
  /** 섹션만 변경 (팝업은 유지) */
  setSection: (section: string) => void;
}

/* ── 레거시 ?panel= → ?popup= 매핑 ── */

interface LegacyMapping {
  popup: PopupName;
  /** section 또는 tab 파라미터명 */
  paramKey: 'section' | 'tab';
  /** 레거시 tab 값 → 새 section/tab 값 (기본 유지) */
  sectionValue?: string;
}

/**
 * 레거시 panel 값을 새 popup 스키마로 변환
 * panel=economy&tab=tokens → popup=economy&section=tokens
 * panel=hallOfFame → popup=hallOfFame
 * panel=profile → popup=settings&tab=profile
 * panel=dashboard → popup=settings&tab=dashboard
 * panel=settings → popup=settings&tab=settings
 * panel=factions&tab=overview → popup=factions&section=overview
 * panel=governance&tab=proposals → popup=governance&section=proposals
 */
function mapLegacyPanel(panel: string, tab: string | null): LegacyMapping | null {
  switch (panel) {
    case 'economy':
      return { popup: 'economy', paramKey: 'section', sectionValue: tab || 'tokens' };
    case 'factions':
      return { popup: 'factions', paramKey: 'section', sectionValue: tab || 'overview' };
    case 'governance':
      return { popup: 'governance', paramKey: 'section', sectionValue: tab || 'proposals' };
    case 'hallOfFame':
      return { popup: 'hallOfFame', paramKey: 'section' };
    case 'profile':
      return { popup: 'settings', paramKey: 'tab', sectionValue: 'profile' };
    case 'dashboard':
      return { popup: 'settings', paramKey: 'tab', sectionValue: 'dashboard' };
    case 'settings':
      return { popup: 'settings', paramKey: 'tab', sectionValue: 'settings' };
    default:
      return null;
  }
}

/* ── 훅 ── */

export function usePopup(): UsePopupReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  /* URL 파라미터 읽기 */
  const urlPopup = searchParams.get('popup') as PopupName | null;
  const urlSection = searchParams.get('section');
  const urlTab = searchParams.get('tab');
  const urlPanel = searchParams.get('panel'); // 레거시

  /* 상태 */
  const [activePopup, setActivePopup] = useState<PopupName | null>(urlPopup);
  const [activeSection, setActiveSection] = useState<string | null>(
    urlSection || urlTab || null,
  );

  /* 레거시 ?panel= 자동 변환 (최초 1회) */
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (urlPanel) {
      const legacyTab = searchParams.get('tab');
      const mapping = mapLegacyPanel(urlPanel, legacyTab);
      if (mapping) {
        const params = new URLSearchParams();
        params.set('popup', mapping.popup);
        if (mapping.sectionValue) {
          params.set(mapping.paramKey, mapping.sectionValue);
        }
        // 레거시 URL 교체 (히스토리 대체)
        router.replace(`/?${params.toString()}`, { scroll: false });
        setActivePopup(mapping.popup);
        setActiveSection(mapping.sectionValue || null);
      }
      return;
    }

    // ?popup= 파라미터 초기화
    if (urlPopup) {
      setActivePopup(urlPopup);
      setActiveSection(urlSection || urlTab || null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* URL 변경 → 상태 동기화 (브라우저 뒤로가기 등) */
  useEffect(() => {
    // 레거시 panel이 있으면 위에서 처리하므로 무시
    if (urlPanel) return;

    if (urlPopup) {
      setActivePopup(urlPopup);
      setActiveSection(urlSection || urlTab || null);
    } else {
      setActivePopup(null);
      setActiveSection(null);
    }
  }, [urlPopup, urlSection, urlTab, urlPanel]);

  /* URL 업데이트 헬퍼 */
  const updateUrl = useCallback((popup: PopupName | null, section?: string | null) => {
    if (!popup) {
      router.replace('/', { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set('popup', popup);

    if (section) {
      // settings 팝업은 tab, 나머지는 section
      const paramKey = popup === 'settings' ? 'tab' : 'section';
      params.set(paramKey, section);
    }

    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [router]);

  /* 팝업 열기 — 동시 열기 방지 (기존 팝업 자동 닫힘) */
  const openPopup = useCallback((name: PopupName, section?: string) => {
    setActivePopup(name);
    setActiveSection(section || null);
    updateUrl(name, section);
  }, [updateUrl]);

  /* 팝업 닫기 */
  const closePopup = useCallback(() => {
    setActivePopup(null);
    setActiveSection(null);
    updateUrl(null);
  }, [updateUrl]);

  /* 섹션만 변경 (팝업 유지) */
  const setSection = useCallback((section: string) => {
    setActiveSection(section);
    if (activePopup) {
      updateUrl(activePopup, section);
    }
  }, [activePopup, updateUrl]);

  return {
    activePopup,
    activeSection,
    openPopup,
    closePopup,
    setSection,
  };
}
