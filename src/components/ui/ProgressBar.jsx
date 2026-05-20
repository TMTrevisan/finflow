import React from 'react';
import { motion } from 'framer-motion';
import { cn } from './Card';

export function ProgressBar({ value, max, className }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  let colorClass = 'bg-neon-emerald'; // Good
  if (percentage >= 85 && percentage < 100) {
    colorClass = 'bg-amber-400'; // Warning
  } else if (percentage >= 100) {
    colorClass = 'bg-neon-crimson'; // Danger
  }

  return (
    <div className={cn("w-full h-3 bg-obsidian-700 rounded-full overflow-hidden", className)}>
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={cn("h-full rounded-full", colorClass)}
      />
    </div>
  );
}
