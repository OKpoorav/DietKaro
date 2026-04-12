'use client';

import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { Calendar, AlertTriangle, Clock, Utensils, Loader2 } from 'lucide-react';
import { useClientActiveRange, ClientPlanRange } from '@/lib/hooks/use-diet-plans';

export interface PlanSetupResult {
    planName: string;
    startDate: Date;
    numDays: number;
    overlapStrategy: 'overwrite' | 'end_previous' | 'update';
    overlappingPlanIds?: string[];
}

interface PlanSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    onConfirm: (result: PlanSetupResult) => void;
}

function formatDate(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(d: Date) {
    return d.toISOString().split('T')[0];
}

function datesOverlap(
    aStart: Date, aEnd: Date,
    bStart: Date, bEnd: Date
): boolean {
    return aStart <= bEnd && bStart <= aEnd;
}

export function PlanSetupModal({ isOpen, onClose, clientId, clientName, onConfirm }: PlanSetupModalProps) {
    const { data: existingPlans, isLoading } = useClientActiveRange(clientId);

    // Smart default: day after latest plan ends, or tomorrow
    const smartStartDate = useMemo(() => {
        if (!existingPlans?.length) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        const latestEnd = existingPlans.reduce((latest, p) => {
            if (!p.endDate) return latest;
            const d = new Date(p.endDate);
            return d > latest ? d : latest;
        }, new Date());
        const dayAfter = new Date(latestEnd);
        dayAfter.setDate(dayAfter.getDate() + 1);
        return dayAfter;
    }, [existingPlans]);

    const [planName, setPlanName] = useState('');
    const [startDateStr, setStartDateStr] = useState('');
    const [numDays, setNumDays] = useState(7);
    const [overlapStrategy, setOverlapStrategy] = useState<'overwrite' | 'end_previous' | 'update'>('end_previous');

    // Set smart default once data loads
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : smartStartDate;
    const endDate = useMemo(() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + numDays - 1);
        return d;
    }, [startDate, numDays]);

    // Detect overlapping plans
    const overlappingPlans = useMemo(() => {
        if (!existingPlans?.length) return [];
        return existingPlans.filter(p => {
            const pStart = new Date(p.startDate);
            const pEnd = p.endDate ? new Date(p.endDate) : pStart;
            return datesOverlap(startDate, endDate, pStart, pEnd);
        });
    }, [existingPlans, startDate, endDate]);

    const hasOverlap = overlappingPlans.length > 0;

    const handleConfirm = () => {
        onConfirm({
            planName,
            startDate,
            numDays,
            overlapStrategy: hasOverlap ? overlapStrategy : 'overwrite',
            overlappingPlanIds: hasOverlap ? overlappingPlans.map(p => p.id) : undefined,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Plan Setup" size="md">
            <div className="p-5 space-y-5">
                {/* Client name */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-semibold">
                        {clientName.charAt(0)}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">{clientName}</p>
                        <p className="text-xs text-gray-500">Setting up new diet plan</p>
                    </div>
                </div>

                {/* Existing plans */}
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading existing plans...
                    </div>
                ) : existingPlans && existingPlans.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Current Plans</p>
                        {existingPlans.map(p => (
                            <PlanRangeCard key={p.id} plan={p} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">No existing plans for this client.</p>
                )}

                {/* Plan name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                    <input
                        type="text"
                        value={planName}
                        onChange={e => setPlanName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        placeholder="e.g. Weight Loss Week 4"
                    />
                </div>

                {/* Date + Duration row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Calendar className="w-3.5 h-3.5 inline mr-1" />
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDateStr || toDateInputValue(smartStartDate)}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Clock className="w-3.5 h-3.5 inline mr-1" />
                            Duration
                        </label>
                        <select
                            value={numDays}
                            onChange={e => setNumDays(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28, 30].map(d => (
                                <option key={d} value={d}>
                                    {d} {d === 1 ? 'day' : d <= 7 ? 'days' : d === 14 ? 'days (2 weeks)' : d === 21 ? 'days (3 weeks)' : 'days (4 weeks)'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Computed end date */}
                <p className="text-xs text-gray-500">
                    Plan period: <span className="font-medium text-gray-700">{formatDate(startDate)}</span>
                    {' → '}
                    <span className="font-medium text-gray-700">{formatDate(endDate)}</span>
                </p>

                {/* Overlap warning */}
                {hasOverlap && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">Date Overlap Detected</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    This plan overlaps with: {Array.from(new Set(overlappingPlans.map(p => p.name))).map(n => `"${n}"`).join(', ')}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2 ml-6">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="overlap"
                                    value="end_previous"
                                    checked={overlapStrategy === 'end_previous'}
                                    onChange={() => setOverlapStrategy('end_previous')}
                                    className="mt-0.5 accent-brand"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">End previous plan early</p>
                                    <p className="text-xs text-gray-500">Previous plan ends the day before this one starts</p>
                                </div>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="overlap"
                                    value="overwrite"
                                    checked={overlapStrategy === 'overwrite'}
                                    onChange={() => setOverlapStrategy('overwrite')}
                                    className="mt-0.5 accent-brand"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Overwrite overlapping days</p>
                                    <p className="text-xs text-gray-500">Deactivate old plan, pending logs removed</p>
                                </div>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="overlap"
                                    value="update"
                                    checked={overlapStrategy === 'update'}
                                    onChange={() => setOverlapStrategy('update')}
                                    className="mt-0.5 accent-brand"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Update existing plan</p>
                                    <p className="text-xs text-gray-500">Copy overlapping days' meals into new plan, non-overlapping days start empty</p>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!planName.trim()}
                        className="px-5 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Start Building
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function PlanRangeCard({ plan }: { plan: ClientPlanRange }) {
    const start = new Date(plan.startDate);
    const end = plan.endDate ? new Date(plan.endDate) : null;

    return (
        <div className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${plan.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{plan.name}</p>
                <p className="text-xs text-gray-500">
                    {formatDate(start)}{end ? ` → ${formatDate(end)}` : ''} &middot; {plan.mealCount} meals
                    {plan.targetCalories ? ` &middot; ${plan.targetCalories} cal` : ''}
                </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                plan.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
                {plan.status}
            </span>
        </div>
    );
}
