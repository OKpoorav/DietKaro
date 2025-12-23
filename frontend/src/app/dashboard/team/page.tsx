'use client';

import {
    Plus,
    Search,
    MoreVertical,
    Mail,
    Phone,
    Users,
    Loader2,
} from 'lucide-react';
import { useTeam, TeamMember } from '@/lib/hooks/use-team';
import { InviteMemberModal } from '@/components/modals/invite-member-modal';
import { useState } from 'react';

// ...

export default function TeamPage() {
    const { data: team, isLoading, error } = useTeam();
    const [showInviteModal, setShowInviteModal] = useState(false);

    const getRoleBadgeColor = (role: string) => {
        switch (role.toLowerCase()) {
            case 'owner':
                return 'bg-purple-100 text-purple-700';
            case 'admin':
                return 'bg-blue-100 text-blue-700';
            case 'dietitian':
                return 'bg-green-100 text-green-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team</h1>
                    <p className="text-[#4e9767] mt-1">Manage your team members and their roles.</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Invite Team Member
                </button>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    Failed to load team members.
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && (!team || team.length === 0) && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No team members yet.</p>
                    <button className="mt-4 text-[#17cf54] font-medium hover:underline">
                        Invite your first team member
                    </button>
                </div>
            )}

            {/* Team Grid */}
            {!isLoading && team && team.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {team.map((member: TeamMember) => (
                        <div
                            key={member.id}
                            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] font-bold text-lg">
                                        {member.avatar}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{member.name}</h3>
                                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                                            {member.role}
                                        </span>
                                    </div>
                                </div>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            {member.specialization && (
                                <p className="text-sm text-gray-600 mb-3">{member.specialization}</p>
                            )}

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="w-4 h-4" />
                                    <span className="truncate">{member.email}</span>
                                </div>
                                {member.phone && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone className="w-4 h-4" />
                                        <span>{member.phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Users className="w-4 h-4" />
                                    <span>{member.clientCount} clients</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                <button className="flex-1 py-2 text-sm font-medium text-[#17cf54] hover:bg-[#17cf54]/10 rounded-lg transition-colors">
                                    View Profile
                                </button>
                                <button className="flex-1 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                    Message
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/* Invite Modal */}
            <InviteMemberModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} />
        </div>
    );
}
