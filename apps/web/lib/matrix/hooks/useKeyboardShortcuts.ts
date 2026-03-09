/**
 * useKeyboardShortcuts - 데스크톱 키보드 단축키 훅
 * 로비 및 게임 내 키보드 네비게이션 지원
 */

import { useEffect, useCallback, useRef } from 'react';

// 단축키 정의
export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * 키보드 단축키 훅
 * @param shortcuts 단축키 정의 배열
 * @param options 옵션
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutDefinition[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, preventDefault = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 입력 필드에서는 단축키 비활성화
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.code.toLowerCase() === shortcut.key.toLowerCase();

        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (preventDefault) {
            event.preventDefault();
          }
          shortcut.action();
          return;
        }
      }
    },
    [enabled, preventDefault]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 로비 단축키 프리셋
 */
export interface LobbyShortcutHandlers {
  onPlay?: () => void;
  onCharacterSelect?: () => void;
  onInventory?: () => void;
  onLeaderboard?: () => void;
  onSettings?: () => void;
  onEscape?: () => void;
}

export function useLobbyShortcuts(handlers: LobbyShortcutHandlers, enabled = true): void {
  const shortcuts: ShortcutDefinition[] = [
    {
      key: 'i',
      action: () => handlers.onInventory?.(),
      description: 'Inventory/Collection',
    },
    {
      key: 'l',
      action: () => handlers.onLeaderboard?.(),
      description: 'Leaderboard',
    },
    {
      key: 'Escape',
      action: () => handlers.onSettings?.(),
      description: 'Settings/Close Modal',
    },
  ];

  useKeyboardShortcuts(shortcuts, { enabled });
}

/**
 * 게임 내 단축키 프리셋
 */
export interface GameShortcutHandlers {
  onPause?: () => void;
  onSpecialSkill?: () => void;
  onShowStats?: () => void;
  onWeaponSelect?: (slot: number) => void;
}

export function useGameShortcuts(handlers: GameShortcutHandlers, enabled = true): void {
  const shortcuts: ShortcutDefinition[] = [
    {
      key: 'Escape',
      action: () => handlers.onPause?.(),
      description: 'Pause Game',
    },
    {
      key: 'Space',
      action: () => handlers.onSpecialSkill?.(),
      description: 'Activate Special Skill',
    },
    {
      key: 'Tab',
      action: () => handlers.onShowStats?.(),
      description: 'Show/Hide Stats',
    },
    {
      key: '1',
      action: () => handlers.onWeaponSelect?.(0),
      description: 'Select Weapon 1',
    },
    {
      key: '2',
      action: () => handlers.onWeaponSelect?.(1),
      description: 'Select Weapon 2',
    },
    {
      key: '3',
      action: () => handlers.onWeaponSelect?.(2),
      description: 'Select Weapon 3',
    },
    {
      key: '4',
      action: () => handlers.onWeaponSelect?.(3),
      description: 'Select Weapon 4',
    },
  ];

  useKeyboardShortcuts(shortcuts, { enabled });
}

/**
 * 이동 키 상태 훅 (게임 내 WASD/방향키)
 */
export interface MovementKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export function useMovementKeys(enabled = true): MovementKeys {
  const keysRef = useRef<MovementKeys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    if (!enabled) {
      keysRef.current = { up: false, down: false, left: false, right: false };
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysRef.current.up = true;
          break;
        case 's':
        case 'arrowdown':
          keysRef.current.down = true;
          break;
        case 'a':
        case 'arrowleft':
          keysRef.current.left = true;
          break;
        case 'd':
        case 'arrowright':
          keysRef.current.right = true;
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysRef.current.up = false;
          break;
        case 's':
        case 'arrowdown':
          keysRef.current.down = false;
          break;
        case 'a':
        case 'arrowleft':
          keysRef.current.left = false;
          break;
        case 'd':
        case 'arrowright':
          keysRef.current.right = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled]);

  return keysRef.current;
}

/**
 * 단축키 목록을 반환하는 유틸리티
 */
export const KEYBOARD_SHORTCUTS = {
  lobby: [
    { key: 'I', description: 'Inventory/Collection' },
    { key: 'L', description: 'Leaderboard' },
    { key: 'ESC', description: 'Settings' },
  ],
  game: [
    { key: 'W/A/S/D', description: 'Move' },
    { key: 'Arrow Keys', description: 'Move (Alternative)' },
    { key: 'Space', description: 'Special Skill' },
    { key: 'ESC', description: 'Pause' },
    { key: 'Tab', description: 'Show Stats' },
    { key: '1-4', description: 'Select Weapon' },
  ],
} as const;

export default useKeyboardShortcuts;
