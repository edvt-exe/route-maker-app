"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Map as MapIcon } from 'lucide-react';

export default function AnimatedMap() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="fixed inset-0 overflow-hidden bg-[#07110f] pointer-events-none z-0" />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07110f] pointer-events-none z-0">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#24463b_1px,transparent_1px),linear-gradient(to_bottom,#24463b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35" />
      
      <svg className="absolute inset-0 w-full h-full opacity-40">
        <motion.path
          d="M-100,600 C200,500 300,700 600,300 S1000,500 1400,200"
          fill="none" stroke="#f08a68" strokeWidth="2" strokeDasharray="10 10"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M1400,800 C1100,700 900,900 600,600 S200,700 -100,400"
          fill="none" stroke="#6fae91" strokeWidth="1.5" strokeDasharray="5 15"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </svg>

      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`marker-${i}`}
          className="absolute text-[#6fae91]/30"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2], scale: [1, 1.2, 1] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative">
            <MapIcon size={48} strokeWidth={1} />
            <div className="absolute inset-0 bg-[#f08a68]/15 blur-xl rounded-full" />
          </div>
        </motion.div>
      ))}
      
    </div>
  );
}