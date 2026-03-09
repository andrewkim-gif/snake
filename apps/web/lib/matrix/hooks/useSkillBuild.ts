/**
 * useSkillBuild.ts - Skill Build State Management Hook
 * Manages build selection, level-up choices, and player skill state during gameplay
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  SkillCategory,
  SkillDefinition,
  PlayerSkillState,
  PlayerSkillProgress,
  LevelUpChoice,
  LevelUpChoiceConfig,
  WeaponType,
  PlayerClass,
} from '../types';
import {
  SKILL_MAP,
  ALL_SKILLS,
  SKILLS_BY_CATEGORY,
  SKILL_BRANCHES,
  BRANCH_UNLOCK_LEVEL,
  ULTIMATE_UNLOCK_LEVEL,
  getActivatableSynergies,
  checkSynergyRequirements,
  ALL_SYNERGIES,
  type SynergyDefinition,
} from '../config/skills';
import {
  SKILL_BUILD_PRESETS,
  getPresetById,
  getPresetsForClass,
  type SkillBuild,
} from '../config/skills/presets';

// ============================================
// TYPES
// ============================================

export interface UseSkillBuildReturn {
  // Player Skill State
  playerSkills: Map<WeaponType, number>;
  branchChoices: Map<WeaponType, 'A' | 'B'>;
  activeSynergies: SynergyDefinition[];

  // Build Management
  currentBuild: SkillBuild | null;
  availableBuilds: SkillBuild[];
  selectBuild: (buildId: string) => void;
  clearBuild: () => void;

  // Level-Up System
  generateLevelUpChoices: (currentWeapons?: Record<string, number>, count?: number) => LevelUpChoice[];
  applyLevelUp: (skill: WeaponType, branchChoice?: 'A' | 'B') => void;
  canLevelUp: (skill: WeaponType) => boolean;
  getNextLevel: (skill: WeaponType) => number;

  // Branch Evolution
  needsBranchChoice: (skill: WeaponType) => boolean;
  selectBranch: (skill: WeaponType, branch: 'A' | 'B') => void;
  getBranchChoice: (skill: WeaponType) => 'A' | 'B' | null;

  // Synergy Tracking
  checkNewSynergies: (skill: WeaponType, level: number) => SynergyDefinition | null;
  getNextSynergyProgress: () => { synergy: SynergyDefinition; progress: number } | null;

  // Progress & Persistence
  getProgress: () => PlayerSkillProgress;
  loadProgress: (progress: PlayerSkillProgress) => void;
  resetGame: () => void;

  // Utility
  getSkillLevel: (skill: WeaponType) => number;
  hasSkill: (skill: WeaponType) => boolean;
  getOwnedSkills: () => WeaponType[];
  getTotalSkillLevels: () => number;
}

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_LEVEL_UP_CONFIG: LevelUpChoiceConfig = {
  priorityWeight: 0.7,    // 70% chance for priority path skills
  categoryWeight: 0.2,    // 20% chance for same category skills
  randomWeight: 0.1,      // 10% chance for random skills
  choiceCount: 4,
  excludeSkills: [],
  maxSkillLevel: ULTIMATE_UNLOCK_LEVEL, // 20
};

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useSkillBuild(
  playerClass?: PlayerClass,
  config: Partial<LevelUpChoiceConfig> = {}
): UseSkillBuildReturn {
  // Merge config
  const levelUpConfig = useMemo(
    () => ({ ...DEFAULT_LEVEL_UP_CONFIG, ...config }),
    [config]
  );

  // Player Skill State
  const [playerSkills, setPlayerSkills] = useState<Map<WeaponType, number>>(new Map());
  const [branchChoices, setBranchChoices] = useState<Map<WeaponType, 'A' | 'B'>>(new Map());
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);

  // Progress tracking (for persistence)
  const progressRef = useRef<PlayerSkillProgress>({
    unlockedSkills: [],
    maxLevelReached: {} as Record<WeaponType, number>,
    branchExperience: {} as Record<WeaponType, { A: number; B: number }>,
    synergyAchievements: {},
    savedBuilds: [],
    lastUsedBuildId: '',
  });

  // ============================================
  // COMPUTED VALUES
  // ============================================

  // Current build
  const currentBuild = useMemo(() => {
    if (!currentBuildId) return null;
    return getPresetById(currentBuildId) || null;
  }, [currentBuildId]);

  // Available builds for current class
  const availableBuilds = useMemo(() => {
    if (playerClass) {
      const classBuilds = getPresetsForClass(playerClass);
      // Also include general builds (no specific class)
      const generalBuilds = SKILL_BUILD_PRESETS.filter(b => !b.recommendedClass);
      return [...classBuilds, ...generalBuilds];
    }
    return SKILL_BUILD_PRESETS;
  }, [playerClass]);

  // Active synergies
  const activeSynergies = useMemo(() => {
    const getCategoryForSkill = (skillId: WeaponType): SkillCategory | null => {
      const skill = SKILL_MAP[skillId];
      return skill?.category || null;
    };
    return getActivatableSynergies(playerSkills, getCategoryForSkill);
  }, [playerSkills]);

  // ============================================
  // BUILD MANAGEMENT
  // ============================================

  const selectBuild = useCallback((buildId: string) => {
    setCurrentBuildId(buildId);
    progressRef.current.lastUsedBuildId = buildId;
  }, []);

  const clearBuild = useCallback(() => {
    setCurrentBuildId(null);
  }, []);

  // ============================================
  // SKILL LEVEL HELPERS
  // ============================================

  const getSkillLevel = useCallback(
    (skill: WeaponType): number => playerSkills.get(skill) || 0,
    [playerSkills]
  );

  const hasSkill = useCallback(
    (skill: WeaponType): boolean => playerSkills.has(skill),
    [playerSkills]
  );

  const getOwnedSkills = useCallback(
    (): WeaponType[] => Array.from(playerSkills.keys()),
    [playerSkills]
  );

  const getTotalSkillLevels = useCallback((): number => {
    let total = 0;
    playerSkills.forEach(level => {
      total += level;
    });
    return total;
  }, [playerSkills]);

  const getNextLevel = useCallback(
    (skill: WeaponType): number => {
      const current = playerSkills.get(skill) || 0;
      return Math.min(current + 1, levelUpConfig.maxSkillLevel);
    },
    [playerSkills, levelUpConfig.maxSkillLevel]
  );

  const canLevelUp = useCallback(
    (skill: WeaponType): boolean => {
      const current = playerSkills.get(skill) || 0;
      return current < levelUpConfig.maxSkillLevel;
    },
    [playerSkills, levelUpConfig.maxSkillLevel]
  );

  // ============================================
  // BRANCH EVOLUTION
  // ============================================

  const needsBranchChoice = useCallback(
    (skill: WeaponType): boolean => {
      const level = playerSkills.get(skill) || 0;
      const nextLevel = level + 1;

      // Check if reaching branch unlock level (11) and has branches
      if (nextLevel === BRANCH_UNLOCK_LEVEL && SKILL_BRANCHES[skill]) {
        // Only need choice if not already chosen
        return !branchChoices.has(skill);
      }
      return false;
    },
    [playerSkills, branchChoices]
  );

  const selectBranch = useCallback((skill: WeaponType, branch: 'A' | 'B') => {
    setBranchChoices(prev => new Map(prev).set(skill, branch));

    // Track branch experience
    if (!progressRef.current.branchExperience[skill]) {
      progressRef.current.branchExperience[skill] = { A: 0, B: 0 };
    }
    progressRef.current.branchExperience[skill][branch]++;
  }, []);

  const getBranchChoice = useCallback(
    (skill: WeaponType): 'A' | 'B' | null => branchChoices.get(skill) || null,
    [branchChoices]
  );

  // ============================================
  // SYNERGY TRACKING
  // ============================================

  const checkNewSynergies = useCallback(
    (skill: WeaponType, level: number): SynergyDefinition | null => {
      // Simulate adding this skill/level
      const simulatedSkills = new Map(playerSkills);
      simulatedSkills.set(skill, level);

      const getCategoryForSkill = (skillId: WeaponType): SkillCategory | null => {
        const s = SKILL_MAP[skillId];
        return s?.category || null;
      };

      // Check each synergy
      for (const synergy of ALL_SYNERGIES) {
        // Skip if already active
        if (activeSynergies.find(s => s.id === synergy.id)) continue;

        // Check if this synergy would activate
        if (checkSynergyRequirements(synergy, simulatedSkills, getCategoryForSkill)) {
          return synergy;
        }
      }
      return null;
    },
    [playerSkills, activeSynergies]
  );

  const getNextSynergyProgress = useCallback((): {
    synergy: SynergyDefinition;
    progress: number;
  } | null => {
    const getCategoryForSkill = (skillId: WeaponType): SkillCategory | null => {
      const s = SKILL_MAP[skillId];
      return s?.category || null;
    };

    let bestProgress = 0;
    let bestSynergy: SynergyDefinition | null = null;

    for (const synergy of ALL_SYNERGIES) {
      // Skip if already active
      if (activeSynergies.find(s => s.id === synergy.id)) continue;

      const req = synergy.requirements;
      let progress = 0;
      let total = 0;

      if (req.type === 'category_mastery' && req.categories) {
        // Count skills in category at required level
        const category = req.categories[0];
        const requiredLevel = req.minLevel;
        const requiredCount = req.categoryCount || 3;

        let count = 0;
        playerSkills.forEach((level, skill) => {
          if (getCategoryForSkill(skill) === category && level >= requiredLevel) {
            count++;
          }
        });

        progress = count;
        total = requiredCount;
      } else if (req.skills) {
        // Count required skills at level
        const requiredLevel = req.minLevel;
        let count = 0;

        for (const skill of req.skills) {
          const level = playerSkills.get(skill) || 0;
          if (level >= requiredLevel) count++;
        }

        progress = count;
        total = req.skills.length;
      }

      if (total > 0) {
        const percentage = progress / total;
        if (percentage > bestProgress && percentage < 1) {
          bestProgress = percentage;
          bestSynergy = synergy;
        }
      }
    }

    if (bestSynergy) {
      return { synergy: bestSynergy, progress: bestProgress };
    }
    return null;
  }, [playerSkills, activeSynergies]);

  // ============================================
  // LEVEL-UP CHOICE GENERATION
  // ============================================

  const generateLevelUpChoices = useCallback(
    (currentWeapons?: Record<string, number>, count?: number): LevelUpChoice[] => {
      const choiceCount = count || levelUpConfig.choiceCount;
      const choices: LevelUpChoice[] = [];
      const usedSkills = new Set<WeaponType>();

      // v8.0: 외부에서 전달된 무기 상태 사용 (게임 내 실제 무기 레벨)
      // currentWeapons가 제공되면 그것을 사용, 아니면 내부 playerSkills 사용
      const weaponLevels = currentWeapons
        ? new Map(Object.entries(currentWeapons).filter(([_, v]) => v > 0) as [WeaponType, number][])
        : playerSkills;

      // Get player's main categories (for category weighting)
      const categoryCount = new Map<SkillCategory, number>();
      weaponLevels.forEach((_, skill) => {
        const def = SKILL_MAP[skill];
        if (def) {
          categoryCount.set(def.category, (categoryCount.get(def.category) || 0) + 1);
        }
      });

      // Find main category
      let mainCategory: SkillCategory | null = null;
      let maxCount = 0;
      categoryCount.forEach((count, cat) => {
        if (count > maxCount) {
          maxCount = count;
          mainCategory = cat;
        }
      });

      // Priority path skills (from current build)
      const prioritySkills: WeaponType[] = currentBuild?.priorityPath || [];

      // Helper to create choice
      const createChoice = (skill: WeaponType, source: 'priority' | 'category' | 'random'): LevelUpChoice => {
        const currentLevel = weaponLevels.get(skill) || 0;
        const nextLevel = currentLevel + 1;
        const willActivate = checkNewSynergies(skill, nextLevel);

        // Calculate priority score
        let priorityScore = 0;
        if (source === 'priority') {
          const idx = prioritySkills.indexOf(skill);
          priorityScore = idx >= 0 ? 100 - idx : 50;
        } else if (source === 'category') {
          priorityScore = 30;
        } else {
          priorityScore = 10;
        }

        return {
          skill,
          isNew: currentLevel === 0,
          currentLevel,
          nextLevel,
          needsBranchChoice: nextLevel === BRANCH_UNLOCK_LEVEL && !!SKILL_BRANCHES[skill],
          willActivateSynergy: willActivate?.id || null,
          priorityScore,
          source,
        };
      };

      // Get available skills (not at max level)
      const getAvailableSkills = (filter?: (def: SkillDefinition) => boolean): WeaponType[] => {
        return ALL_SKILLS
          .filter(def => {
            // Not already used
            if (usedSkills.has(def.id as WeaponType)) return false;
            // Not at max level
            const level = weaponLevels.get(def.id as WeaponType) || 0;
            if (level >= levelUpConfig.maxSkillLevel) return false;
            // Not excluded
            if (levelUpConfig.excludeSkills.includes(def.id as WeaponType)) return false;
            // Apply custom filter
            if (filter && !filter(def)) return false;
            return true;
          })
          .map(def => def.id as WeaponType);
      };

      // Weighted selection
      while (choices.length < choiceCount) {
        const roll = Math.random();
        let selectedSkill: WeaponType | null = null;
        let source: 'priority' | 'category' | 'random' = 'random';

        if (roll < levelUpConfig.priorityWeight && prioritySkills.length > 0) {
          // Try priority path
          const available = getAvailableSkills(def =>
            prioritySkills.includes(def.id as WeaponType)
          );
          if (available.length > 0) {
            // Prefer skills earlier in priority path
            for (const skill of prioritySkills) {
              if (available.includes(skill)) {
                selectedSkill = skill;
                source = 'priority';
                break;
              }
            }
          }
        }

        if (!selectedSkill && roll < levelUpConfig.priorityWeight + levelUpConfig.categoryWeight && mainCategory) {
          // Try same category
          const available = getAvailableSkills(def => def.category === mainCategory);
          if (available.length > 0) {
            selectedSkill = available[Math.floor(Math.random() * available.length)];
            source = 'category';
          }
        }

        if (!selectedSkill) {
          // Random skill
          const available = getAvailableSkills();
          if (available.length > 0) {
            selectedSkill = available[Math.floor(Math.random() * available.length)];
            source = 'random';
          }
        }

        if (selectedSkill) {
          usedSkills.add(selectedSkill);
          choices.push(createChoice(selectedSkill, source));
        } else {
          // No more available skills
          break;
        }
      }

      // Sort by priority score
      choices.sort((a, b) => b.priorityScore - a.priorityScore);

      return choices;
    },
    [playerSkills, currentBuild, levelUpConfig, checkNewSynergies]
  );

  // ============================================
  // APPLY LEVEL UP
  // ============================================

  const applyLevelUp = useCallback(
    (skill: WeaponType, branchChoice?: 'A' | 'B') => {
      setPlayerSkills(prev => {
        const newSkills = new Map(prev);
        const currentLevel = newSkills.get(skill) || 0;
        const nextLevel = Math.min(currentLevel + 1, levelUpConfig.maxSkillLevel);
        newSkills.set(skill, nextLevel);

        // Update progress
        if (!progressRef.current.unlockedSkills.includes(skill)) {
          progressRef.current.unlockedSkills.push(skill);
        }
        if (
          !progressRef.current.maxLevelReached[skill] ||
          progressRef.current.maxLevelReached[skill] < nextLevel
        ) {
          progressRef.current.maxLevelReached[skill] = nextLevel;
        }

        return newSkills;
      });

      // Handle branch choice
      if (branchChoice) {
        selectBranch(skill, branchChoice);
      }

      // Track synergy achievements
      const newSynergy = checkNewSynergies(skill, getSkillLevel(skill) + 1);
      if (newSynergy) {
        if (!progressRef.current.synergyAchievements[newSynergy.id]) {
          progressRef.current.synergyAchievements[newSynergy.id] = 0;
        }
        progressRef.current.synergyAchievements[newSynergy.id]++;
      }
    },
    [levelUpConfig.maxSkillLevel, selectBranch, checkNewSynergies, getSkillLevel]
  );

  // ============================================
  // PROGRESS & PERSISTENCE
  // ============================================

  const getProgress = useCallback((): PlayerSkillProgress => {
    return { ...progressRef.current };
  }, []);

  const loadProgress = useCallback((progress: PlayerSkillProgress) => {
    progressRef.current = { ...progress };
    if (progress.lastUsedBuildId) {
      setCurrentBuildId(progress.lastUsedBuildId);
    }
  }, []);

  const resetGame = useCallback(() => {
    setPlayerSkills(new Map());
    setBranchChoices(new Map());
    // Note: We keep progress and build selection
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Player Skill State
    playerSkills,
    branchChoices,
    activeSynergies,

    // Build Management
    currentBuild,
    availableBuilds,
    selectBuild,
    clearBuild,

    // Level-Up System
    generateLevelUpChoices,
    applyLevelUp,
    canLevelUp,
    getNextLevel,

    // Branch Evolution
    needsBranchChoice,
    selectBranch,
    getBranchChoice,

    // Synergy Tracking
    checkNewSynergies,
    getNextSynergyProgress,

    // Progress & Persistence
    getProgress,
    loadProgress,
    resetGame,

    // Utility
    getSkillLevel,
    hasSkill,
    getOwnedSkills,
    getTotalSkillLevels,
  };
}

export default useSkillBuild;
