'use client';

import { ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';

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
    onAddDay?: () => void;
    onRemoveDay?: () => void;
}

export function DayNavigator({ planDates, selectedDayIndex, onSelectDay, isTemplateMode, onAddDay, onRemoveDay }: DayNavigatorProps) {
    const maxIndex = planDates.length - 1;

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
                <div className="flex gap-1 overflow-x-auto no-scrollbar items-center">
                    {onRemoveDay && planDates.length > 1 && (
                        <button
                            onClick={onRemoveDay}
                            className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove last day"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                    )}
                    {planDates.map((d, i) => (
                        <button
                            key={i}
                            onClick={() => onSelectDay(i)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-w-[80px] ${selectedDayIndex === i
                                ? 'bg-brand text-white'
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
                    {onAddDay && planDates.length < 7 && (
                        <button
                            onClick={onAddDay}
                            className="p-1.5 rounded-full hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            title="Add another day"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => onSelectDay(Math.min(maxIndex, selectedDayIndex + 1))}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
                    disabled={selectedDayIndex === maxIndex}
                >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>
        </div>
    );
}
