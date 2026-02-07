'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DayInfo {
    date: Date;
    label: string;
    day: string;
}

interface DayNavigatorProps {
    planDates: DayInfo[];
    selectedDayIndex: number;
    onSelectDay: (index: number) => void;
    isTemplateMode: boolean;
}

export function DayNavigator({ planDates, selectedDayIndex, onSelectDay, isTemplateMode }: DayNavigatorProps) {
    return (
        <div className="bg-white p-2 rounded-lg border border-gray-200 flex-shrink-0 sticky top-0 z-10">
            <div className="flex justify-between items-center">
                <button
                    onClick={() => onSelectDay(Math.max(0, selectedDayIndex - 1))}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
                    disabled={selectedDayIndex === 0}
                >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {planDates.map((d, i) => (
                        <button
                            key={i}
                            onClick={() => onSelectDay(i)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-w-[80px] ${selectedDayIndex === i
                                ? 'bg-[#17cf54] text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            {isTemplateMode ? (
                                <>
                                    <div className="text-xs opacity-80">Day</div>
                                    <div className="font-bold">{i + 1}</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-xs opacity-80">{d.label}</div>
                                    <div className="font-bold">{d.day}</div>
                                </>
                            )}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => onSelectDay(Math.min(6, selectedDayIndex + 1))}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
                    disabled={selectedDayIndex === 6}
                >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>
        </div>
    );
}
