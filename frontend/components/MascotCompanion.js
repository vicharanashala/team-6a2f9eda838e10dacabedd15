'use client';
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function MascotCompanion() {
  // --- States ---
  const [pos, setPos] = useState({ bottom: 90, right: 24 }); // Fixed starting position right above "Report Issue" button
  const [mascotName, setMascotName] = useState('Pyro');
  const [streak, setStreak] = useState(1);
  const [exp, setExp] = useState(0);
  const [level, setLevel] = useState(0);
  const [currentStage, setCurrentStage] = useState('junior'); // 'junior', 'evolved', 'ultimate'
  const [personality, setPersonality] = useState('calm'); // 'calm', 'fiery', 'bubbly'
  const [claimedRewards, setClaimedRewards] = useState([]); // Array of reward ids, e.g. ['lv5', 'lv6', 'lv7']
  const [hasClaimedToday, setHasClaimedToday] = useState(false);
  
  // Custom accessories toggles (unlocked and active)
  const [activeAccessories, setActiveAccessories] = useState({
    balloons: true,
    sharkHat: true,
  });

  // UI screens
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'details', 'appearance'
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('Pyro');

  // Drag states
  const mascotRef = useRef(null);
  const dragStartRef = useRef({ clientX: 0, clientY: 0, bottom: 0, right: 0 });
  const isDraggingRef = useRef(false);

  // Helper: Get local YYYY-MM-DD string
  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Helper: check if a date string represents yesterday
  const checkIsYesterday = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yyyy}-${mm}-${dd}`;
    
    return dateStr === yesterdayStr;
  };

  // Main evaluation logic for loading state and claiming daily logins
  const checkAndUpdateDailyStreak = () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('prashnasarathi_mascot_v3');
    
    let currentMascotName = 'Pyro';
    let currentStreak = 1;
    let currentExp = 0;
    let currentLevel = 0;
    let currentStageVal = 'junior';
    let currentPersonalityVal = 'calm';
    let currentClaimedRewards = [];
    let currentAccessories = { balloons: true, sharkHat: true };
    let currentPos = { bottom: 90, right: 24 };
    let savedLastLogin = '';

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.pos) currentPos = parsed.pos;
        if (parsed.mascotName) currentMascotName = parsed.mascotName;
        if (parsed.streak !== undefined) currentStreak = parsed.streak;
        if (parsed.exp !== undefined) currentExp = parsed.exp;
        if (parsed.level !== undefined) currentLevel = parsed.level;
        if (parsed.currentStage) currentStageVal = parsed.currentStage;
        if (parsed.personality) currentPersonalityVal = parsed.personality;
        if (parsed.claimedRewards) currentClaimedRewards = parsed.claimedRewards;
        if (parsed.activeAccessories) currentAccessories = parsed.activeAccessories;
        if (parsed.lastLoginDate) savedLastLogin = parsed.lastLoginDate;
      } catch (e) {
        console.error('Failed to parse saved mascot data:', e);
      }
    }

    const todayStr = getLocalDateString();
    if (savedLastLogin !== todayStr) {
      let finalStreak = currentStreak;
      let finalExp = currentExp;
      let finalLevel = currentLevel;

      if (savedLastLogin === '') {
        // First time initialization - start strictly at 0 level and 0 exp!
        finalStreak = 1;
        finalExp = 0;
        finalLevel = 0;
        toast(`Welcome! ${currentMascotName} is now active. Log in daily to grow!`, { icon: '🐣' });
      } else {
        if (checkIsYesterday(savedLastLogin)) {
          // Daily login continued
          finalStreak += 1;
          finalExp = currentExp + 15;
          toast.success(`Daily Login Claimed! Streak: ${finalStreak} days. +15 EXP`, { icon: '🔥' });
        } else {
          // Streak broken - reset progress entirely!
          finalStreak = 1;
          finalExp = 0;
          finalLevel = 0;
          currentStageVal = 'junior';
          toast(`Oh no! You missed a day. Your login streak and ${currentMascotName}'s progress reset to Level 0!`, { icon: '🌅', duration: 5000 });
        }
      }

      // Check level up (140 exp needed)
      if (finalExp >= 140) {
        finalLevel += 1;
        finalExp = finalExp - 140;
        toast.success(`Level Up! ${currentMascotName} is now Level ${finalLevel}!`, {
          icon: '✨',
          duration: 4000
        });
        setTimeout(() => launchConfetti(), 300);
      }

      // Auto evolve stage based on level
      if (finalLevel >= 4) {
        currentStageVal = 'ultimate';
      } else if (finalLevel >= 3) {
        currentStageVal = 'evolved';
      } else {
        currentStageVal = 'junior';
      }

      // Update state hooks
      setStreak(finalStreak);
      setExp(finalExp);
      setLevel(finalLevel);
      setCurrentStage(currentStageVal);
      setHasClaimedToday(true);

      // Save state
      const updatedData = {
        pos: currentPos,
        mascotName: currentMascotName,
        streak: finalStreak,
        exp: finalExp,
        level: finalLevel,
        currentStage: currentStageVal,
        personality: currentPersonalityVal,
        claimedRewards: currentClaimedRewards,
        activeAccessories: currentAccessories,
        lastLoginDate: todayStr
      };
      localStorage.setItem('prashnasarathi_mascot_v3', JSON.stringify(updatedData));
    } else {
      // Just load the values normally if already logged in today
      setStreak(currentStreak);
      setExp(currentExp);
      setLevel(currentLevel);
      setMascotName(currentMascotName);
      setTempName(currentMascotName);
      setPos(currentPos);
      setCurrentStage(currentStageVal);
      setPersonality(currentPersonalityVal);
      setClaimedRewards(currentClaimedRewards);
      setActiveAccessories(currentAccessories);
      setHasClaimedToday(true);
    }
  };

  // Run on mount and also register window focus checker
  useEffect(() => {
    checkAndUpdateDailyStreak();
  }, []);

  useEffect(() => {
    const handleFocusCheck = () => {
      checkAndUpdateDailyStreak();
    };
    window.addEventListener('focus', handleFocusCheck);
    return () => window.removeEventListener('focus', handleFocusCheck);
  }, []);

  // Save changes to localStorage helper
  const saveState = (updates = {}) => {
    const todayStr = getLocalDateString();
    const data = {
      pos,
      mascotName,
      streak,
      exp,
      level,
      currentStage,
      personality,
      claimedRewards,
      activeAccessories,
      lastLoginDate: todayStr,
      ...updates
    };
    localStorage.setItem('prashnasarathi_mascot_v3', JSON.stringify(data));
  };

  // Sparkles
  const launchConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

  // --- Handlers ---
  const handleSimulateDailyLogin = () => {
    if (hasClaimedToday) return;

    const nextStreak = streak + 1;
    const newExp = exp + 15;
    let nextLevel = level;
    let finalExp = newExp;
    let nextStage = currentStage;

    if (finalExp >= 140) {
      nextLevel += 1;
      finalExp = finalExp - 140;
      toast.success(`Level Up! ${mascotName} is now Level ${nextLevel}!`, {
        icon: '✨',
        duration: 4000
      });
      launchConfetti();
    } else {
      toast.success(`Simulated Daily Login! +15 EXP`, {
        icon: '🔥'
      });
    }

    // Auto evolve stage
    if (nextLevel >= 4) {
      nextStage = 'ultimate';
    } else if (nextLevel >= 3) {
      nextStage = 'evolved';
    } else {
      nextStage = 'junior';
    }

    setStreak(nextStreak);
    setExp(finalExp);
    setLevel(nextLevel);
    setCurrentStage(nextStage);
    setHasClaimedToday(true);
    saveState({ streak: nextStreak, exp: finalExp, level: nextLevel, currentStage: nextStage });
  };

  const handleClaimReward = (rewardId, spAmount) => {
    if (claimedRewards.includes(rewardId)) return;
    const updated = [...claimedRewards, rewardId];
    setClaimedRewards(updated);
    
    toast.success(`Claimed Reward: +${spAmount} SP Points Added!`, {
      icon: '🏆',
      duration: 3500
    });
    launchConfetti();
    saveState({ claimedRewards: updated });
  };

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    setMascotName(trimmed);
    setIsEditingName(false);
    toast.success(`Named companion to "${trimmed}"!`);
    saveState({ mascotName: trimmed });
  };

  // --- Draggable coordinates calculations ---
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    e.preventDefault();
    isDraggingRef.current = false;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      bottom: pos.bottom,
      right: pos.right
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    const deltaX = e.clientX - dragStartRef.current.clientX;
    const deltaY = e.clientY - dragStartRef.current.clientY;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDraggingRef.current = true;
    }

    const newRight = dragStartRef.current.right - deltaX;
    const newBottom = dragStartRef.current.bottom - deltaY;

    // Bounds checking
    const maxRight = window.innerWidth - 100;
    const maxBottom = window.innerHeight - 100;
    const boundedRight = Math.max(10, Math.min(maxRight, newRight));
    const boundedBottom = Math.max(10, Math.min(maxBottom, newBottom));

    setPos({ bottom: boundedBottom, right: boundedRight });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Save final dropped pos
    saveState({ pos });
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    const touch = e.touches[0];
    isDraggingRef.current = false;
    dragStartRef.current = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bottom: pos.bottom,
      right: pos.right
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.clientX;
    const deltaY = touch.clientY - dragStartRef.current.clientY;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDraggingRef.current = true;
    }

    const newRight = dragStartRef.current.right - deltaX;
    const newBottom = dragStartRef.current.bottom - deltaY;

    const maxRight = window.innerWidth - 100;
    const maxBottom = window.innerHeight - 100;
    const boundedRight = Math.max(10, Math.min(maxRight, newRight));
    const boundedBottom = Math.max(10, Math.min(maxBottom, newBottom));

    setPos({ bottom: boundedBottom, right: boundedRight });
  };

  const handleTouchEnd = () => {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    saveState({ pos });
  };

  const handleMascotClick = (e) => {
    if (isDraggingRef.current) return;
    setIsOpen(!isOpen);
  };

  // --- Dynamic animations based on settings ---
  const getPersonalityAnim = () => {
    if (personality === 'fiery') return 'pulseGlow 1.2s infinite ease-in-out';
    if (personality === 'bubbly') return 'speedBounce 1.5s infinite ease-in-out';
    return 'bounceMascot 3s infinite ease-in-out';
  };

  const getFlameSpeed = () => {
    return personality === 'fiery' ? '0.6s' : '1.5s';
  };

  return (
    <>
      {/* 1. CSS Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 4px #f97316) drop-shadow(0 0 8px #ef4444); }
          50% { filter: drop-shadow(0 0 12px #f97316) drop-shadow(0 0 24px #ef4444); }
        }
        @keyframes bounceMascot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes speedBounce {
          0%, 100% { transform: translateY(0) scaleY(1); }
          40% { transform: translateY(-24px) scaleY(0.9); }
          60% { transform: translateY(-24px) scaleY(0.9); }
          90% { transform: translateY(0) scaleY(1.05); }
        }
        @keyframes blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes tailWag {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes balloonSway {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(5px, -8px) rotate(4deg); }
        }
        @keyframes flameRise {
          0% { transform: translateY(5px) scale(0.8); opacity: 0; }
          50% { opacity: 0.9; }
          100% { transform: translateY(-20px) scale(0.3); opacity: 0; }
        }
      `}} />

      {/* 2. Companion mascot overlay */}
      <div
        ref={mascotRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleMascotClick}
        className="fixed z-40 cursor-grab active:cursor-grabbing select-none"
        style={{
          bottom: `${pos.bottom}px`,
          right: `${pos.right}px`,
          width: '100px',
          height: '100px',
        }}
      >
        <div 
          className="w-full h-full relative flex items-center justify-center"
          style={{ animation: getPersonalityAnim() }}
        >
          {/* Base shadow */}
          <div className="absolute bottom-1 w-16 h-3 bg-black/30 blur-sm rounded-full" />

          {/* Fire particles */}
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className="absolute w-2 h-2 rounded-full bg-gradient-to-t from-red-500 to-yellow-400"
                style={{
                  bottom: '25px',
                  left: `${20 + i * 15}%`,
                  animation: `flameRise ${getFlameSpeed()} infinite ease-in-out`,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>

          {/* Mascot SVG */}
          <svg viewBox="0 0 100 100" className="w-20 h-20 drop-shadow-xl overflow-visible">
            {currentStage === 'junior' && (
              <g id="mascot-junior">
                <circle cx="50" cy="55" r="22" fill="url(#fireGrad)" />
                <path d="M50 33 C42 22 50 12 50 12 C50 12 58 22 50 33 Z" fill="#f97316" />
                <path d="M42 38 C36 30 44 22 44 22 C44 22 48 30 42 38 Z" fill="#ef4444" />
                <path d="M58 38 C64 30 56 22 56 22 C56 22 52 30 58 38 Z" fill="#facc15" />
                <ellipse cx="42" cy="54" rx="4" ry="5" fill="#1e293b" style={{ transformOrigin: '42px 54px', animation: 'blink 4s infinite' }} />
                <ellipse cx="58" cy="54" rx="4" ry="5" fill="#1e293b" style={{ transformOrigin: '58px 54px', animation: 'blink 4s infinite' }} />
                <circle cx="43.5" cy="52" r="1.2" fill="white" />
                <circle cx="59.5" cy="52" r="1.2" fill="white" />
                <ellipse cx="38" cy="59" rx="3" ry="1.5" fill="#ef4444" opacity="0.6" />
                <ellipse cx="62" cy="59" rx="3" ry="1.5" fill="#ef4444" opacity="0.6" />
                <path d="M47 59 Q50 61 53 59" stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {currentStage === 'evolved' && (
              <g id="mascot-evolved">
                <path d="M68 62 C78 54 84 42 80 32 C74 42 66 50 64 58 Z" fill="url(#fireGrad)" style={{ transformOrigin: '64px 58px', animation: 'tailWag 2s infinite ease-in-out' }} />
                <ellipse cx="50" cy="62" rx="20" ry="18" fill="url(#fireGrad)" />
                <polygon points="50,55 53,60 50,65 47,60" fill="#facc15" />
                <circle cx="50" cy="42" r="18" fill="url(#fireGrad)" />
                <polygon points="34,38 18,22 36,30" fill="#f97316" />
                <polygon points="34,38 24,26 34,32" fill="#ef4444" />
                <polygon points="66,38 82,22 64,30" fill="#f97316" />
                <polygon points="66,38 76,26 66,32" fill="#ef4444" />
                <ellipse cx="42" cy="44" rx="4.5" ry="5.5" fill="#1e293b" style={{ transformOrigin: '42px 44px', animation: 'blink 3.5s infinite' }} />
                <ellipse cx="58" cy="44" rx="4.5" ry="5.5" fill="#1e293b" style={{ transformOrigin: '58px 44px', animation: 'blink 3.5s infinite' }} />
                <circle cx="43.5" cy="42" r="1.5" fill="white" />
                <circle cx="59.5" cy="42" r="1.5" fill="white" />
                <polygon points="50,49 48.5,47.5 51.5,47.5" fill="#1e293b" />
                <path d="M47 50 Q50 52 53 50" stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {currentStage === 'ultimate' && (
              <g id="mascot-ultimate">
                <path d="M25 55 C10 40 5 25 15 15 C20 30 30 40 35 48 Z" fill="#ef4444" opacity="0.8" />
                <path d="M75 55 C90 40 95 25 85 15 C80 30 70 40 65 48 Z" fill="#ef4444" opacity="0.8" />
                <path d="M68 64 C84 55 90 35 84 22 C78 35 70 50 65 60 Z" fill="url(#fireGrad)" style={{ transformOrigin: '65px 60px', animation: 'tailWag 1.2s infinite ease-in-out' }} />
                <path d="M36 78 L40 58 L60 58 L64 78 Z" fill="url(#fireGrad)" />
                <path d="M50 60 L56 68 L50 76 L44 68 Z" fill="#facc15" />
                <path d="M50 63 L53 68 L50 73 L47 68 Z" fill="#f97316" />
                <circle cx="34" cy="74" r="3.5" fill="#facc15" />
                <circle cx="66" cy="74" r="3.5" fill="#facc15" />
                <circle cx="50" cy="40" r="20" fill="url(#fireGrad)" />
                <path d="M30 36 C18 18 36 22 36 22 Z" fill="#ea580c" />
                <path d="M50 20 C50 0 42 12 42 12 Z" fill="#ef4444" />
                <path d="M70 36 C82 18 64 22 64 22 Z" fill="#ea580c" />
                <path d="M38 25 Q28 8 32 4 Q38 12 42 22 Z" fill="#ef4444" />
                <path d="M62 25 Q72 8 68 4 Q62 12 58 22 Z" fill="#ef4444" />
                <polygon points="36,33 46,36 40,39" fill="#facc15" />
                <polygon points="64,33 54,36 60,39" fill="#facc15" />
                <ellipse cx="41.5" cy="41" rx="4.5" ry="5.5" fill="#1e293b" style={{ transformOrigin: '41.5px 41px', animation: 'blink 3s infinite' }} />
                <ellipse cx="58.5" cy="41" rx="4.5" ry="5.5" fill="#1e293b" style={{ transformOrigin: '58.5px 41px', animation: 'blink 3s infinite' }} />
                <circle cx="43" cy="39.5" r="1.5" fill="white" />
                <circle cx="57" cy="39.5" r="1.5" fill="white" />
                <path d="M46 48 Q50 51 54 48" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
              </g>
            )}

            {activeAccessories.sharkHat && claimedRewards.includes('lv7') && (
              <g id="accessory-sharkhat" style={{ transform: 'translate(0, -10px)' }}>
                <path d="M26 40 C26 18 74 18 74 40 Z" fill="#3b82f6" />
                <path d="M50 24 L56 6 L64 22 Z" fill="#2563eb" />
                <circle cx="36" cy="30" r="3" fill="white" />
                <circle cx="36" cy="30" r="1.5" fill="black" />
                <circle cx="64" cy="30" r="3" fill="white" />
                <circle cx="64" cy="30" r="1.5" fill="black" />
                <path d="M26 38 L30 34 L34 38 L38 34 L42 38 L46 34 L50 38 L54 34 L58 38 L62 34 L66 38 L70 34 L74 38" stroke="white" strokeWidth="2.5" fill="none" />
              </g>
            )}

            {activeAccessories.balloons && claimedRewards.includes('lv6') && (
              <g id="accessory-balloons" style={{ transformOrigin: '30px 75px', animation: 'balloonSway 4s infinite ease-in-out' }}>
                <path d="M32 72 Q24 55 18 40" stroke="#94a3b8" strokeWidth="1" fill="none" />
                <path d="M32 72 Q30 52 32 36" stroke="#94a3b8" strokeWidth="1" fill="none" />
                <ellipse cx="16" cy="34" rx="9" ry="11" fill="#ef4444" />
                <polygon points="16,45 13,48 19,48" fill="#b91c1c" />
                <ellipse cx="32" cy="28" rx="8" ry="10" fill="#3b82f6" />
                <polygon points="32,38 29,41 35,41" fill="#1d4ed8" />
              </g>
            )}

            <defs>
              <linearGradient id="fireGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="40%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
            </defs>
          </svg>

          {/* Level indicator */}
          <span className="absolute -top-3.5 bg-slate-900/90 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded border border-white/20 uppercase tracking-tight">
            {mascotName} Lv.{level}
          </span>
        </div>
      </div>

      {/* 3. Glassmorphic dialogue modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950/75 dark:bg-slate-950/80 border border-white/10 text-white shadow-2xl p-6 flex flex-col gap-5 animate-scale-in">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-500 shadow-[0_0_20px_#f97316]" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">LOGIN STREAK</h3>
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="bg-slate-900/85 border border-white/20 text-xs px-2 py-0.5 rounded text-white outline-none focus:border-orange-500"
                        maxLength={12}
                      />
                      <button onClick={handleSaveName} className="text-[10px] bg-orange-600 px-1.5 py-0.5 rounded text-white hover:bg-orange-700">Save</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <h4 className="text-sm font-semibold">{mascotName}</h4>
                      <button onClick={() => setIsEditingName(true)} className="text-slate-400 hover:text-white text-xs">✏️</button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-3xl font-extrabold text-orange-500 font-mono tracking-tight">{streak}d</span>
                <p className="text-[9px] text-slate-400 mt-0.5">Active login days</p>
              </div>
            </div>

            <div className="bg-white/[0.04] dark:bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block">COMPANION STAGE</span>
                  <span className="text-base font-extrabold capitalize">{currentStage}</span>
                </div>
                <button
                  onClick={() => setActiveModal('appearance')}
                  className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 border border-white/10 transition-all active:scale-95"
                >
                  <span>APPEARANCE ⇄</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Level {level}</span>
                  <span className="text-[11px] font-mono text-slate-400">{exp}/140 EXP</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(exp / 140) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveModal('details')}
                  className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-0.5 transition-colors"
                >
                  DETAILS ≫
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSimulateDailyLogin}
                disabled={hasClaimedToday}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  hasClaimedToday 
                    ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-md hover:shadow-orange-500/25 active:scale-[0.98]'
                }`}
              >
                <span>{hasClaimedToday ? '✓ Claimed Today' : '🔥 Claim Daily Login'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. LEVEL DETAILS SUB-MODAL */}
      {activeModal === 'details' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setActiveModal(null)} />

          <div className="relative w-full max-w-2xl bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-xl border border-white/10 text-white rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold uppercase tracking-widest text-orange-500">LEVEL DETAILS</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white font-bold text-lg">×</button>
            </div>

            <div className="grid grid-cols-3 gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-6 items-center text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-orange-600/10 flex items-center justify-center border border-orange-500/20">
                  <span className="text-3xl">🐣</span>
                </div>
                <h4 className="text-xs font-bold">Junior</h4>
                <span className="text-[10px] text-slate-400">Lv. 1 Required</span>
              </div>

              <div className="flex flex-col items-center justify-center text-slate-600">
                <span className="text-xl">≫</span>
              </div>

              <div className={`flex flex-col items-center gap-2 ${level < 3 ? 'opacity-40' : ''}`}>
                <div className="w-16 h-16 rounded-full bg-orange-600/15 flex items-center justify-center border border-orange-500/30">
                  <span className="text-3xl">🦊</span>
                </div>
                <h4 className="text-xs font-bold">Evolved</h4>
                <span className="text-[10px] text-slate-400">Lv. 3 {level >= 3 ? '✓' : 'Locked'}</span>
              </div>

              <div className="col-span-3 flex justify-center text-slate-600 my-1">
                <span className="text-xl rotate-90">≫</span>
              </div>

              <div className={`col-span-3 flex flex-col items-center gap-2 ${level < 4 ? 'opacity-40' : ''}`}>
                <div className="w-16 h-16 rounded-full bg-orange-600/20 flex items-center justify-center border border-orange-500/40">
                  <span className="text-3xl">🐲</span>
                </div>
                <h4 className="text-xs font-bold">Ultimate</h4>
                <span className="text-[10px] text-slate-400">Lv. 4 {level >= 4 ? '✓' : 'Locked'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-orange-400">Current Level: Lv. {level}</span>
                <span className="text-slate-400 font-mono">{exp}/140 EXP</span>
              </div>
              <p className="text-[11px] text-slate-400">Log in daily, ask questions, and help others to earn EXP and level rewards!</p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-4">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">LEVEL REWARDS TRACK</h4>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3 flex flex-col gap-2 items-center text-center">
                  <span className="text-[10px] font-mono text-slate-400">Level 5</span>
                  <div className="text-xl">💰</div>
                  <span className="text-[10px] font-bold text-slate-200">100 SP Points</span>
                  
                  {claimedRewards.includes('lv5') ? (
                    <span className="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded">Claimed</span>
                  ) : level >= 5 ? (
                    <button
                      onClick={() => handleClaimReward('lv5', 100)}
                      className="text-[10px] font-bold bg-orange-600 hover:bg-orange-500 px-3 py-1 rounded text-white transition-all"
                    >
                      Claim Vault
                    </button>
                  ) : (
                    <span className="text-[9px] text-slate-500">Locked</span>
                  )}
                </div>

                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3 flex flex-col gap-2 items-center text-center">
                  <span className="text-[10px] font-mono text-slate-400">Level 6</span>
                  <div className="text-xl">🎈</div>
                  <span className="text-[10px] font-bold text-slate-200">Balloons Skin</span>
                  
                  {claimedRewards.includes('lv6') ? (
                    <span className="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded">Claimed</span>
                  ) : level >= 6 ? (
                    <button
                      onClick={() => handleClaimReward('lv6', 150)}
                      className="text-[10px] font-bold bg-orange-600 hover:bg-orange-500 px-3 py-1 rounded text-white transition-all"
                    >
                      Claim Vault
                    </button>
                  ) : (
                    <span className="text-[9px] text-slate-500">Locked</span>
                  )}
                </div>

                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3 flex flex-col gap-2 items-center text-center">
                  <span className="text-[10px] font-mono text-slate-400">Level 7</span>
                  <div className="text-xl">🦈</div>
                  <span className="text-[10px] font-bold text-slate-200">Shark Hat Skin</span>
                  
                  {claimedRewards.includes('lv7') ? (
                    <span className="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded">Claimed</span>
                  ) : level >= 7 ? (
                    <button
                      onClick={() => handleClaimReward('lv7', 200)}
                      className="text-[10px] font-bold bg-orange-600 hover:bg-orange-500 px-3 py-1 rounded text-white transition-all"
                    >
                      Claim Vault
                    </button>
                  ) : (
                    <span className="text-[9px] text-slate-500">Locked</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. APPEARANCE MODAL */}
      {activeModal === 'appearance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setActiveModal(null)} />

          <div className="relative w-full max-w-2xl bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-xl border border-white/10 text-white rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold uppercase tracking-widest text-orange-500">APPEARANCE SETTINGS</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white font-bold text-lg">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center bg-slate-900/50 border border-white/10 rounded-xl p-6 h-64 justify-center relative overflow-hidden">
                <span className="absolute top-2 left-2 text-[10px] font-mono text-slate-400">Live Preview</span>
                <div style={{ animation: getPersonalityAnim() }} className="w-40 h-40 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-32 h-32 overflow-visible">
                    {currentStage === 'junior' && (
                      <g>
                        <circle cx="50" cy="55" r="22" fill="url(#fireGrad)" />
                        <path d="M50 33 C42 22 50 12 50 12 C50 12 58 22 50 33 Z" fill="#f97316" />
                        <path d="M42 38 C36 30 44 22 44 22 C44 22 48 30 42 38 Z" fill="#ef4444" />
                        <path d="M58 38 C64 30 56 22 56 22 C56 22 52 30 58 38 Z" fill="#facc15" />
                        <ellipse cx="42" cy="54" rx="4" ry="5" fill="#1e293b" />
                        <ellipse cx="58" cy="54" rx="4" ry="5" fill="#1e293b" />
                        <circle cx="43.5" cy="52" r="1.2" fill="white" />
                        <circle cx="59.5" cy="52" r="1.2" fill="white" />
                        <ellipse cx="38" cy="59" rx="3" ry="1.5" fill="#ef4444" opacity="0.6" />
                        <ellipse cx="62" cy="59" rx="3" ry="1.5" fill="#ef4444" opacity="0.6" />
                        <path d="M47 59 Q50 61 53 59" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                      </g>
                    )}
                    {currentStage === 'evolved' && (
                      <g>
                        <path d="M68 62 C78 54 84 42 80 32 C74 42 66 50 64 58 Z" fill="url(#fireGrad)" />
                        <ellipse cx="50" cy="62" rx="20" ry="18" fill="url(#fireGrad)" />
                        <polygon points="50,55 53,60 50,65 47,60" fill="#facc15" />
                        <circle cx="50" cy="42" r="18" fill="url(#fireGrad)" />
                        <polygon points="34,38 18,22 36,30" fill="#f97316" />
                        <polygon points="34,38 24,26 34,32" fill="#ef4444" />
                        <polygon points="66,38 82,22 64,30" fill="#f97316" />
                        <polygon points="66,38 76,26 66,32" fill="#ef4444" />
                        <ellipse cx="42" cy="44" rx="4.5" ry="5.5" fill="#1e293b" />
                        <ellipse cx="58" cy="44" rx="4.5" ry="5.5" fill="#1e293b" />
                        <circle cx="43.5" cy="42" r="1.5" fill="white" />
                        <circle cx="59.5" cy="42" r="1.5" fill="white" />
                        <path d="M47 50 Q50 52 53 50" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                      </g>
                    )}
                    {currentStage === 'ultimate' && (
                      <g>
                        <path d="M25 55 C10 40 5 25 15 15 C20 30 30 40 35 48 Z" fill="#ef4444" opacity="0.8" />
                        <path d="M75 55 C90 40 95 25 85 15 C80 30 70 40 65 48 Z" fill="#ef4444" opacity="0.8" />
                        <path d="M68 64 C84 55 90 35 84 22 C78 35 70 50 65 60 Z" fill="url(#fireGrad)" />
                        <path d="M36 78 L40 58 L60 58 L64 78 Z" fill="url(#fireGrad)" />
                        <path d="M50 60 L56 68 L50 76 L44 68 Z" fill="#facc15" />
                        <circle cx="50" cy="40" r="20" fill="url(#fireGrad)" />
                        <path d="M38 25 Q28 8 32 4 Q38 12 42 22 Z" fill="#ef4444" />
                        <path d="M62 25 Q72 8 68 4 Q62 12 58 22 Z" fill="#ef4444" />
                        <ellipse cx="41.5" cy="41" rx="4.5" ry="5.5" fill="#1e293b" />
                        <ellipse cx="58.5" cy="41" rx="4.5" ry="5.5" fill="#1e293b" />
                        <circle cx="43" cy="39.5" r="1.5" fill="white" />
                        <circle cx="57" cy="39.5" r="1.5" fill="white" />
                        <path d="M46 48 Q50 51 54 48" stroke="#1e293b" strokeWidth="2" fill="none" />
                      </g>
                    )}
                    
                    {activeAccessories.balloons && claimedRewards.includes('lv6') && (
                      <g style={{ transformOrigin: '30px 75px', animation: 'balloonSway 4s infinite ease-in-out' }}>
                        <path d="M32 72 Q24 55 18 40" stroke="#94a3b8" strokeWidth="1" fill="none" />
                        <path d="M32 72 Q30 52 32 36" stroke="#94a3b8" strokeWidth="1" fill="none" />
                        <ellipse cx="16" cy="34" rx="9" ry="11" fill="#ef4444" />
                        <ellipse cx="32" cy="28" rx="8" ry="10" fill="#3b82f6" />
                      </g>
                    )}
                    
                    {activeAccessories.sharkHat && claimedRewards.includes('lv7') && (
                      <g style={{ transform: 'translate(0, -10px)' }}>
                        <path d="M26 40 C26 18 74 18 74 40 Z" fill="#3b82f6" />
                        <path d="M50 24 L56 6 L64 22 Z" fill="#2563eb" />
                        <circle cx="36" cy="30" r="3" fill="white" />
                        <circle cx="64" cy="30" r="3" fill="white" />
                        <path d="M26 38 L30 34 L34 38 L38 34 L42 38 L46 34 L50 38 L54 34 L58 38 L62 34 L66 38 L70 34 L74 38" stroke="white" strokeWidth="2.5" fill="none" />
                      </g>
                    )}
                  </svg>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">I SELECT STAGE</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setCurrentStage('junior');
                        saveState({ currentStage: 'junior' });
                        toast.success('Switched to Junior stage!');
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${currentStage === 'junior' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'}`}
                    >
                      🐥 Junior
                    </button>
                    
                    <button
                      onClick={() => {
                        if (level < 3) {
                          toast.error('Unlocks at Level 3!');
                          return;
                        }
                        setCurrentStage('evolved');
                        saveState({ currentStage: 'evolved' });
                        toast.success('Switched to Evolved stage!');
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${currentStage === 'evolved' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'} ${level < 3 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      🦊 Evolved
                    </button>

                    <button
                      onClick={() => {
                        if (level < 4) {
                          toast.error('Unlocks at Level 4!');
                          return;
                        }
                        setCurrentStage('ultimate');
                        saveState({ currentStage: 'ultimate' });
                        toast.success('Switched to Ultimate stage!');
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${currentStage === 'ultimate' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'} ${level < 4 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      🐲 Ultimate
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">I SELECT PERSONALITY</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['calm', 'fiery', 'bubbly'].map(p => (
                      <button
                        key={p}
                        onClick={() => {
                          setPersonality(p);
                          saveState({ personality: p });
                          toast.success(`Personality updated to ${p}!`);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all ${personality === p ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'}`}
                      >
                        {p === 'calm' ? '😴 Calm' : p === 'fiery' ? '🔥 Fiery' : '⚡ Bubbly'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">ACTIVE ACCESSORIES</span>
                  <div className="flex gap-4 text-xs">
                    {claimedRewards.includes('lv6') && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeAccessories.balloons}
                          onChange={(e) => {
                            const updated = { ...activeAccessories, balloons: e.target.checked };
                            setActiveAccessories(updated);
                            saveState({ activeAccessories: updated });
                          }}
                          className="rounded text-orange-500 focus:ring-0"
                        />
                        <span>Balloons</span>
                      </label>
                    )}

                    {claimedRewards.includes('lv7') && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeAccessories.sharkHat}
                          onChange={(e) => {
                            const updated = { ...activeAccessories, sharkHat: e.target.checked };
                            setActiveAccessories(updated);
                            saveState({ activeAccessories: updated });
                          }}
                          className="rounded text-orange-500 focus:ring-0"
                        />
                        <span>Shark Hat</span>
                      </label>
                    )}

                    {!claimedRewards.includes('lv6') && !claimedRewards.includes('lv7') && (
                      <span className="text-[10px] text-slate-500">No accessories unlocked yet. Reach Level 6+ to earn them!</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
