'use client'

// Minecraft 핫바: 하단 10슬롯 블록 선택 UI

import { useEffect, useCallback } from 'react'
import { BlockType, HOTBAR_BLOCKS, BLOCK_NAMES, BLOCK_ICONS } from '@/lib/3d/mc-types'

interface MCHotbarProps {
  selectedIndex: number
  onSelect: (index: number) => void
  locked: boolean
}

export default function MCHotbar({ selectedIndex, onSelect, locked }: MCHotbarProps) {
  // 숫자키 입력
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!locked) return
      const num = parseInt(e.key)
      if (num >= 1 && num <= 9) {
        onSelect(num - 1)
      }
      if (e.key === '0') {
        onSelect(9)
      }
    },
    [locked, onSelect]
  )

  // 마우스 휠
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!locked) return
      const dir = e.deltaY > 0 ? 1 : -1
      onSelect((selectedIndex + dir + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length)
    },
    [locked, selectedIndex, onSelect]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('wheel', handleWheel)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('wheel', handleWheel)
    }
  }, [handleKeyDown, handleWheel])

  if (!locked) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 2,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {HOTBAR_BLOCKS.map((blockType, i) => {
        const isSelected = i === selectedIndex
        const iconName = BLOCK_ICONS[blockType]
        return (
          <div
            key={i}
            style={{
              width: 48,
              height: 48,
              border: isSelected ? '3px solid #fff' : '2px solid #555',
              borderRadius: 4,
              background: isSelected
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {iconName ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/textures/block-icons/${iconName}.png`}
                alt={BLOCK_NAMES[blockType]}
                style={{
                  width: 32,
                  height: 32,
                  imageRendering: 'pixelated',
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: getBlockColor(blockType),
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
            )}
            {/* 슬롯 번호 */}
            <span
              style={{
                position: 'absolute',
                bottom: 1,
                right: 3,
                fontSize: 10,
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'monospace',
              }}
            >
              {i === 9 ? '0' : i + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 아이콘 없는 블록의 대체 색상
function getBlockColor(type: BlockType): string {
  const colors: Partial<Record<BlockType, string>> = {
    [BlockType.dirt]: '#8B6914',
    [BlockType.sand]: '#E8D5A3',
    [BlockType.coal]: '#333',
    [BlockType.leaf]: '#4A8C3F',
    [BlockType.bedrock]: '#444',
  }
  return colors[type] || '#666'
}
