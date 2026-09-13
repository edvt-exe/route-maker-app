"use client";

import React, { useState } from 'react';
import { 
  Clock, Car, Wallet, Utensils, Users, ChevronDown
} from 'lucide-react';

export interface RouteFilters {
  // Logistics & Time
  city: string;
  startPoint: string;
  endPoint: string;
  isRoundTrip: boolean;
  startTime: string;
  endTime: string;
  days: number;
  pacing: 'Relaxed' | 'Balanced' | 'Non-stop action';

  // Transport & Accessibility
  mainTransport: 'Walking' | 'Transit' | 'Car' | 'Bike/Scooter' | 'Rideshare';
  accessibility: boolean;
  avoid: string[];

  // Budget & Vibe
  maxBudget: number;
  budgetAllocation: number;
  freeOnly: boolean;
  categories: string[];
  touristLevel: number;
  vibe: string;
  weatherPreference: 'Mostly Outdoor' | 'Mostly Indoor';

  // Food & Breaks
  meals: number;
  diningStyle: string[];
  cuisine: string;
  dietaryRestrictions: string[];

  // Companions
  groupType: 'Solo' | 'Couple' | 'Friends' | 'Family';
  childAge: 'Toddler 0-3' | 'Kids 4-11' | 'Teens 12+' | null;
  petFriendly: boolean;
}

export const defaultFilters: RouteFilters = {
  city: '',
  startPoint: '', endPoint: '', isRoundTrip: true, startTime: '09:00', endTime: '18:00',
  days: 1, pacing: 'Balanced',
  mainTransport: 'Walking', accessibility: false, avoid: [],
  maxBudget: 200, budgetAllocation: 50, freeOnly: false, categories: [], touristLevel: 3,
  vibe: 'Relaxing/Zen', weatherPreference: 'Mostly Outdoor',
  meals: 2, diningStyle: [], cuisine: '', dietaryRestrictions: [],
  groupType: 'Solo', childAge: null, petFriendly: false
};

const IOSToggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    type="button"
    onClick={() => onChange(!checked)} 
    className={`relative w-[50px] h-[30px] rounded-full transition-colors duration-300 ease-in-out ${checked ? 'bg-[#32d74b]' : 'bg-[#39393d]'}`}
  >
    <div className={`absolute top-[2px] left-[2px] w-[26px] h-[26px] bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`} />
  </button>
);

const SegmentedControl = ({ options, selected, onChange }: { options: string[], selected: string, onChange: (v: string) => void }) => (
  <div className="flex bg-[#2c2c2e] p-[3px] rounded-[9px] w-full">
    {options.map(opt => (
      <button 
        key={opt} type="button" onClick={() => onChange(opt)}
        className={`flex-1 py-1.5 px-1 text-[13px] font-medium rounded-md transition-all duration-200 ${selected === opt ? 'bg-[#636366] text-white shadow-sm' : 'text-[#aeaeb2] hover:text-white'}`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const Pill = ({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) => (
  <button 
    type="button" onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-[14px] transition-colors duration-200 ${selected ? 'bg-[#0a84ff] text-white' : 'bg-[#2c2c2e] text-[#aeaeb2] hover:bg-[#3a3a3c]'}`}
  >
    {label}
  </button>
);

const ListRow = ({ label, children, isLast = false }: { label: string, children: React.ReactNode, isLast?: boolean }) => (
  <div className={`flex items-center justify-between py-3.5 ${!isLast ? 'border-b border-[#38383a]' : ''}`}>
    <span className="text-[17px] text-white tracking-tight">{label}</span>
    <div className="flex items-center gap-3">{children}</div>
  </div>
);

const Section = ({ title, icon: Icon, isOpen, onToggle, children }: any) => (
  <div className="bg-[#1c1c1e] rounded-2xl mb-4 overflow-hidden">
    <button type="button" onClick={onToggle} className="w-full px-4 py-3.5 flex items-center justify-between bg-[#1c1c1e] active:bg-[#2c2c2e] transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-[#0a84ff] rounded-lg text-white"><Icon size={18} strokeWidth={2.5} /></div>
        <span className="text-[17px] font-semibold text-white tracking-tight">{title}</span>
      </div>
      <ChevronDown size={20} className={`text-[#8e8e93] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <div className="px-4 pb-4 border-t border-[#2c2c2e] pt-3">{children}</div>}
  </div>
);

// Main form component
export interface AdvancedRouteFormProps {
  filters: RouteFilters;
  setFilters: React.Dispatch<React.SetStateAction<RouteFilters>>;
}

export default function AdvancedRouteForm({ filters, setFilters }: AdvancedRouteFormProps) {
  const [openSection, setOpenSection] = useState<number | null>(1);

  const update = (key: keyof RouteFilters, value: any) => setFilters(prev => ({ ...prev, [key]: value }));
  const toggleArray = (key: keyof RouteFilters, value: string) => {
    const arr = filters[key] as string[];
    update(key, arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  return (
    <div className="w-full">
      
      {/* 1. Logistics & Time */}
      <Section title="Logistics & Time" icon={Clock} isOpen={openSection === 1} onToggle={() => setOpenSection(openSection === 1 ? null : 1)}>
        <div className="space-y-1">
          <ListRow label="City">
            <input type="text" value={filters.city} onChange={e => update('city', e.target.value)} placeholder="e.g. Bucharest" className="bg-transparent text-right text-[17px] text-[#0a84ff] placeholder-[#8e8e93] outline-none w-40" />
          </ListRow>
          <ListRow label="Start Point">
            <input type="text" value={filters.startPoint} onChange={e => update('startPoint', e.target.value)} placeholder="Address or Hotel" className="bg-transparent text-right text-[17px] text-[#0a84ff] placeholder-[#8e8e93] outline-none w-40" />
          </ListRow>
          <ListRow label="Round Trip">
            <IOSToggle checked={filters.isRoundTrip} onChange={v => update('isRoundTrip', v)} />
          </ListRow>
          {!filters.isRoundTrip && (
            <ListRow label="End Point">
              <input type="text" value={filters.endPoint} onChange={e => update('endPoint', e.target.value)} placeholder="Destination" className="bg-transparent text-right text-[17px] text-[#0a84ff] placeholder-[#8e8e93] outline-none w-40" />
            </ListRow>
          )}
          <ListRow label="Time Window">
            <div className="flex items-center gap-2 bg-[#2c2c2e] px-3 py-1.5 rounded-lg">
              <input type="time" value={filters.startTime} onChange={e => update('startTime', e.target.value)} className="bg-transparent text-[17px] text-white outline-none [&::-webkit-calendar-picker-indicator]:invert" />
              <span className="text-[#8e8e93]">-</span>
              <input type="time" value={filters.endTime} onChange={e => update('endTime', e.target.value)} className="bg-transparent text-[17px] text-white outline-none [&::-webkit-calendar-picker-indicator]:invert" />
            </div>
          </ListRow>
          <ListRow label="Number of Days">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => update('days', Math.max(1, filters.days - 1))} className="w-8 h-8 rounded-full bg-[#2c2c2e] text-[#0a84ff] flex items-center justify-center text-xl font-medium">-</button>
              <span className="text-[17px] w-4 text-center">{filters.days}</span>
              <button type="button" onClick={() => update('days', Math.min(14, filters.days + 1))} className="w-8 h-8 rounded-full bg-[#2c2c2e] text-[#0a84ff] flex items-center justify-center text-xl font-medium">+</button>
            </div>
          </ListRow>
          <div className="py-3">
            <p className="text-[17px] text-white tracking-tight mb-3">Pacing</p>
            <SegmentedControl options={['Relaxed', 'Balanced', 'Non-stop action']} selected={filters.pacing} onChange={v => update('pacing', v)} />
          </div>
        </div>
      </Section>

      {/* 2. Transport & Accessibility */}
      <Section title="Transport & Accessibility" icon={Car} isOpen={openSection === 2} onToggle={() => setOpenSection(openSection === 2 ? null : 2)}>
        <div className="space-y-1">
           <div className="py-3">
            <p className="text-[17px] text-white tracking-tight mb-3">Main Transport</p>
            <SegmentedControl options={['Walking', 'Transit', 'Car', 'Rideshare']} selected={filters.mainTransport} onChange={v => update('mainTransport', v)} />
          </div>
          <ListRow label="Wheelchair & Stroller Friendly">
            <IOSToggle checked={filters.accessibility} onChange={v => update('accessibility', v)} />
          </ListRow>
          <div className="py-3 border-t border-[#38383a]">
            <p className="text-[17px] text-white tracking-tight mb-3">Avoid</p>
            <div className="flex flex-wrap gap-2">
              {['Highways', 'Heavy pedestrian traffic', 'Toll roads'].map(avoid => (
                <Pill key={avoid} label={avoid} selected={filters.avoid.includes(avoid)} onClick={() => toggleArray('avoid', avoid)} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 3. Budget & Vibe */}
      <Section title="Budget & Vibe" icon={Wallet} isOpen={openSection === 3} onToggle={() => setOpenSection(openSection === 3 ? null : 3)}>
        <div className="space-y-1">
          <ListRow label="Max Total Budget">
             <div className="flex items-center gap-2">
               <span className="text-[#8e8e93]">€</span>
               <input type="number" value={filters.maxBudget} onChange={e => update('maxBudget', Number(e.target.value))} className="bg-transparent text-right text-[17px] text-[#0a84ff] outline-none w-16" />
             </div>
          </ListRow>
          <ListRow label="Show Free Only">
            <IOSToggle checked={filters.freeOnly} onChange={v => update('freeOnly', v)} />
          </ListRow>
          <div className="py-3 border-t border-[#38383a]">
             <div className="flex justify-between text-[13px] text-[#8e8e93] mb-2">
               <span>Food Focus</span>
               <span>Attraction Focus</span>
             </div>
             <input type="range" min="0" max="100" value={filters.budgetAllocation} onChange={e => update('budgetAllocation', Number(e.target.value))} className="w-full accent-[#0a84ff]" />
          </div>
          <div className="py-3 border-t border-[#38383a]">
             <div className="flex justify-between text-[13px] text-[#8e8e93] mb-2">
               <span>Top Tourist Spots</span>
               <span>Hidden Gems</span>
             </div>
             <input type="range" min="1" max="5" value={filters.touristLevel} onChange={e => update('touristLevel', Number(e.target.value))} className="w-full accent-[#0a84ff]" />
          </div>
          <div className="py-3 border-t border-[#38383a]">
            <p className="text-[17px] text-white tracking-tight mb-3">Categories</p>
            <div className="flex flex-wrap gap-2">
              {['History & Architecture', 'Art & Museums', 'Parks & Nature', 'Shopping', 'Viewpoints', 'Nightlife/Bars'].map(cat => (
                <Pill key={cat} label={cat} selected={filters.categories.includes(cat)} onClick={() => toggleArray('categories', cat)} />
              ))}
            </div>
          </div>
          <ListRow label="Desired Vibe">
            <select value={filters.vibe} onChange={e => update('vibe', e.target.value)} className="bg-transparent text-right text-[17px] text-[#0a84ff] outline-none appearance-none cursor-pointer">
              {['Romantic', 'Educational', 'Adventure', 'Relaxing/Zen', 'Instagrammable'].map(v => <option key={v} value={v} className="bg-[#1c1c1e] text-white">{v}</option>)}
            </select>
          </ListRow>
          <div className="py-3 border-t border-[#38383a]">
            <SegmentedControl options={['Mostly Outdoor', 'Mostly Indoor']} selected={filters.weatherPreference} onChange={v => update('weatherPreference', v)} />
          </div>
        </div>
      </Section>

      {/* 4. Food & Breaks */}
      <Section title="Food & Breaks" icon={Utensils} isOpen={openSection === 4} onToggle={() => setOpenSection(openSection === 4 ? null : 4)}>
        <div className="space-y-1">
          <ListRow label="Meals per day">
            <SegmentedControl options={['1', '2', '3', '4']} selected={filters.meals.toString()} onChange={v => update('meals', Number(v))} />
          </ListRow>
          <div className="py-3 border-t border-[#38383a]">
            <p className="text-[17px] text-white tracking-tight mb-3">Dining Style</p>
            <div className="flex flex-wrap gap-2">
              {['Street/Fast Food', 'Casual Dining', 'Fine Dining', 'Specialty Cafes'].map(style => (
                <Pill key={style} label={style} selected={filters.diningStyle.includes(style)} onClick={() => toggleArray('diningStyle', style)} />
              ))}
            </div>
          </div>
          <ListRow label="Specific Cuisine">
            <input type="text" value={filters.cuisine} onChange={e => update('cuisine', e.target.value)} placeholder="e.g. Italian, Sushi" className="bg-transparent text-right text-[17px] text-[#0a84ff] placeholder-[#8e8e93] outline-none w-48" />
          </ListRow>
          <div className="py-3 border-t border-[#38383a]">
            <p className="text-[17px] text-white tracking-tight mb-3">Dietary Restrictions</p>
            <div className="flex flex-wrap gap-2">
              {['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal'].map(diet => (
                <Pill key={diet} label={diet} selected={filters.dietaryRestrictions.includes(diet)} onClick={() => toggleArray('dietaryRestrictions', diet)} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 5. Companions */}
      <Section title="Companions" icon={Users} isOpen={openSection === 5} onToggle={() => setOpenSection(openSection === 5 ? null : 5)}>
        <div className="space-y-1">
          <div className="py-3">
            <p className="text-[17px] text-white tracking-tight mb-3">Group Type</p>
            <SegmentedControl options={['Solo', 'Couple', 'Friends', 'Family']} selected={filters.groupType} onChange={v => {
              update('groupType', v);
              if (v !== 'Family') update('childAge', null);
              if (v === 'Family' && !filters.childAge) update('childAge', 'Kids 4-11');
            }} />
          </div>
          {filters.groupType === 'Family' && (
            <div className="py-3 border-t border-[#38383a]">
              <p className="text-[17px] text-white tracking-tight mb-3">Child Age</p>
              <SegmentedControl options={['Toddler 0-3', 'Kids 4-11', 'Teens 12+']} selected={filters.childAge || 'Kids 4-11'} onChange={v => update('childAge', v)} />
            </div>
          )}
          <ListRow label="Pet-friendly Route" isLast>
            <IOSToggle checked={filters.petFriendly} onChange={v => update('petFriendly', v)} />
          </ListRow>
        </div>
      </Section>

    </div>
  );
}