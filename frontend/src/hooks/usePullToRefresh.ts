import { useEffect, useState, useCallback } from 'react';
import { hapticImpact } from '../utils/haptic.ts';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  resistance?: number;
  triggerThreshold?: number;
}

export function usePullToRefresh({
  onRefresh,
  resistance = 2.5,
  triggerThreshold = 80
}: UsePullToRefreshOptions) {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const distance = (currentY - startY) / resistance;
      
      if (distance > 0) {
        setPullDistance(Math.min(distance, triggerThreshold * 1.5));
        if (e.cancelable) e.preventDefault();
      }
    }
  }, [startY, resistance, triggerThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > triggerThreshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(triggerThreshold); // Snap back to threshold
      hapticImpact(); // Trigger haptic on refresh start
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        hapticImpact(); // Trigger haptic on refresh end
      }
    } else {
      setPullDistance(0);
      setStartY(0);
    }
  }, [pullDistance, triggerThreshold, isRefreshing, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullDistance, isRefreshing, triggerThreshold };
}
