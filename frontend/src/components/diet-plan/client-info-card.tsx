'use client';

import { getInitials } from '@/lib/utils/formatters';
import { ClientRestrictionsSummary } from './client-restrictions-summary';
import type { ClientData } from '@/lib/types/diet-plan.types';

interface ClientInfoCardProps {
    client: ClientData | null | undefined;
    isTemplateMode: boolean;
}

export function ClientInfoCard({ client, isTemplateMode }: ClientInfoCardProps) {
    if (isTemplateMode) {
        return (
            <>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                            T
                        </div>
                        <div>
                            <h1 className="text-gray-900 font-medium">Template</h1>
                            <p className="text-gray-500 text-sm">
                                Create reusable diet plan
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 className="text-gray-900 font-medium mb-3">Template Tips</h3>
                    <ul className="text-sm text-gray-600 space-y-2">
                        <li>• Templates can be assigned to any client</li>
                        <li>• Meals will be copied when assigned</li>
                        <li>• Client-specific targets will be applied later</li>
                    </ul>
                </div>
            </>
        );
    }

    if (!client) return null;

    const initials = getInitials(client.fullName);

    return (
        <>
            {/* Client Card */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] font-bold">
                        {initials}
                    </div>
                    <div>
                        <h1 className="text-gray-900 font-medium">{client.fullName}</h1>
                        <p className="text-gray-500 text-sm">
                            {client.heightCm}cm, {client.currentWeightKg}kg <br />
                            Goal: {client.targetWeightKg}kg
                        </p>
                    </div>
                </div>
            </div>

            {/* Dietary Restrictions Summary */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="text-gray-900 font-medium mb-3">Dietary Restrictions</h3>
                <ClientRestrictionsSummary
                    allergies={client.medicalProfile?.allergies || client.allergies || []}
                    intolerances={client.intolerances || []}
                    dietPattern={client.dietPattern}
                    medicalConditions={client.medicalProfile?.conditions || client.medicalConditions || []}
                    foodRestrictions={client.foodRestrictions || []}
                    dislikes={client.dislikes || []}
                    likedFoods={client.likedFoods || []}
                />
            </div>
        </>
    );
}
