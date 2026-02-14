'use client';

import { BookOpen, Loader2 } from 'lucide-react';
import type { TemplateData } from '@/lib/types/diet-plan.types';

interface TemplateSidebarProps {
    templates: TemplateData[];
    applyingTemplateId: string | null;
    onApplyTemplate: (id: string) => void;
}

export function TemplateSidebar({ templates, applyingTemplateId, onApplyTemplate }: TemplateSidebarProps) {
    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4 flex flex-col gap-3 max-h-[400px]">
            <h3 className="text-gray-900 font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                Saved Templates
            </h3>
            <div className="overflow-y-auto pr-1 space-y-2 flex-grow">
                {templates.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-4">No templates found</p>
                ) : (
                    templates.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => onApplyTemplate(t.id)}
                            disabled={applyingTemplateId === t.id}
                            className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-brand hover:bg-brand/5 transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <span className="font-medium text-gray-800 text-sm group-hover:text-brand line-clamp-1">
                                    {t.name}
                                </span>
                                {applyingTemplateId === t.id && (
                                    <Loader2 className="w-3 h-3 animate-spin text-brand" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span>{t.checkInFrequency || 'Flexible'}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
