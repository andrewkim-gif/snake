'use client';

/**
 * NationalitySelector — 국적 선택 드롭다운 (v14 Phase 1: S08)
 *
 * 195개국 드롭다운 (국기 이모지 + 국가명)
 * 검색 필터 (한글/영어)
 * 로비 캐릭터 생성 흐름에 통합: 이름 -> 국적 -> RANDOMIZE -> CONFIRM
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { COUNTRIES, iso2ToFlag, searchCountries } from '@/lib/country-data';
import type { CountryEntry } from '@/lib/country-data';
import { SK, bodyFont } from '@/lib/sketch-ui';

// ─── Constants ───

const STORAGE_KEY = 'agent-nationality';
const MAX_VISIBLE_ITEMS = 8;
const ITEM_HEIGHT = 32;

// ─── Props ───

interface NationalitySelectorProps {
  /** 현재 선택된 ISO3 코드 */
  value: string;
  /** 선택 변경 콜백 */
  onChange: (iso3: string) => void;
  /** 비활성화 */
  disabled?: boolean;
}

// ─── localStorage 유틸 ───

export function loadNationality(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveNationality(iso3: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, iso3);
  } catch { /* 무시 */ }
}

// ─── Component ───

export function NationalitySelector({ value, onChange, disabled }: NationalitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 검색 결과
  const filtered = useMemo(() => searchCountries(search), [search]);

  // 선택된 국가 정보
  const selected = useMemo(
    () => COUNTRIES.find(c => c.iso3 === value),
    [value],
  );

  // 드롭다운 열기/닫기
  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(prev => {
      if (!prev) {
        setSearch('');
        // 열릴 때 검색 인풋에 포커스
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      return !prev;
    });
  }, [disabled]);

  // 국가 선택
  const handleSelect = useCallback((country: CountryEntry) => {
    onChange(country.iso3);
    saveNationality(country.iso3);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 선택된 국가 위치로 스크롤
  useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const idx = filtered.findIndex(c => c.iso3 === value);
    if (idx > 0) {
      listRef.current.scrollTop = idx * ITEM_HEIGHT - ITEM_HEIGHT * 2;
    }
  }, [open, value, filtered]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* 선택 버튼 */}
      <button
        onClick={toggleOpen}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: SK.bgWarm,
          border: `1px solid ${open ? SK.borderFocus : SK.border}`,
          borderRadius: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 150ms ease',
          fontFamily: bodyFont,
          fontSize: '12px',
          color: SK.textPrimary,
          textAlign: 'left',
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: '16px', lineHeight: 1 }}>
              {iso2ToFlag(selected.iso2)}
            </span>
            <span style={{ flex: 1, fontWeight: 600 }}>
              {selected.name}
            </span>
            <span style={{ fontSize: '10px', color: SK.textMuted, fontWeight: 500 }}>
              {selected.iso3}
            </span>
          </>
        ) : (
          <span style={{ color: SK.textMuted, fontWeight: 500 }}>
            Select nationality...
          </span>
        )}
        <span style={{
          fontSize: '8px',
          color: SK.textMuted,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
        }}>
          {'\u25BC'}
        </span>
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* 검색 인풋 */}
          <div style={{
            padding: '8px',
            borderBottom: `1px solid ${SK.border}`,
          }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: SK.bgWarm,
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
                fontFamily: bodyFont,
                fontSize: '11px',
                color: SK.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = SK.borderFocus;
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = SK.border;
              }}
            />
          </div>

          {/* 국가 목록 */}
          <div
            ref={listRef}
            style={{
              maxHeight: `${MAX_VISIBLE_ITEMS * ITEM_HEIGHT}px`,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                fontFamily: bodyFont,
                fontSize: '11px',
                color: SK.textMuted,
              }}>
                No countries found
              </div>
            ) : (
              filtered.map(country => {
                const isSelected = country.iso3 === value;
                return (
                  <button
                    key={country.iso3}
                    onClick={() => handleSelect(country)}
                    style={{
                      width: '100%',
                      height: `${ITEM_HEIGHT}px`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px',
                      backgroundColor: isSelected ? `${SK.blue}15` : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? `2px solid ${SK.blue}` : '2px solid transparent',
                      cursor: 'pointer',
                      fontFamily: bodyFont,
                      fontSize: '11px',
                      color: isSelected ? SK.textWhite : SK.textSecondary,
                      textAlign: 'left',
                      transition: 'all 100ms ease',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = SK.cardBgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>
                      {iso2ToFlag(country.iso2)}
                    </span>
                    <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {country.name}
                    </span>
                    <span style={{ fontSize: '9px', color: SK.textMuted, flexShrink: 0, fontWeight: 500 }}>
                      {country.nameKo}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* 하단: 카운트 */}
          <div style={{
            padding: '4px 12px',
            borderTop: `1px solid ${SK.border}`,
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.textMuted,
            textAlign: 'right',
          }}>
            {filtered.length} / {COUNTRIES.length} countries
          </div>
        </div>
      )}
    </div>
  );
}
