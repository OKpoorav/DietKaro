'use client';

import { useState, useEffect } from 'react';
import {
    User,
    Bell,
    Shield,
    Palette,
    Globe,
    CreditCard,
    HelpCircle,
    LogOut,
    Check,
    Loader2
} from 'lucide-react';
import { useClerk } from '@clerk/nextjs';
import { useProfile, useUpdateProfile } from '@/lib/hooks/use-profile';
import { toast } from 'sonner';

const settingsSections = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'language', name: 'Language', icon: Globe },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'help', name: 'Help & Support', icon: HelpCircle },
];

export default function SettingsPage() {
    const { signOut } = useClerk();
    const { data: profile, isLoading } = useProfile();
    const updateProfile = useUpdateProfile();

    const [activeSection, setActiveSection] = useState('profile');
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        mealReminders: true,
        weeklyReports: false,
    });

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        specialization: '',
        bio: ''
    });

    // Sync form data when profile loads
    useEffect(() => {
        if (profile) {
            setFormData({
                fullName: profile.fullName || '',
                phone: profile.phone || '',
                specialization: profile.specialization || '',
                bio: profile.bio || ''
            });
        }
    }, [profile]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateProfile.mutateAsync(formData);
            toast.success('Profile updated successfully');
        } catch {
            toast.error('Failed to update profile');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
                <p className="text-[#4e9767] mt-1">Manage your account preferences and settings.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Settings Navigation */}
                <div className="lg:col-span-1">
                    <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {settingsSections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeSection === section.id
                                    ? 'bg-[#17cf54]/10 text-[#17cf54] border-r-2 border-[#17cf54]'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <section.icon className="w-5 h-5" />
                                <span className="text-sm font-medium">{section.name}</span>
                            </button>
                        ))}
                        <button
                            onClick={() => signOut()}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </nav>
                </div>

                {/* Settings Content */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        {/* Profile Section */}
                        {activeSection === 'profile' && profile && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>

                                {/* Avatar */}
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] text-2xl font-bold overflow-hidden">
                                        {profile.profilePhotoUrl ? (
                                            <img src={profile.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            profile.fullName?.charAt(0) || 'U'
                                        )}
                                    </div>
                                    <div>
                                        <button disabled className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
                                            Change Photo
                                        </button>
                                        <p className="text-sm text-gray-500 mt-1">Managed via Clerk</p>
                                    </div>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={formData.fullName}
                                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-[#17cf54] focus:border-[#17cf54] text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={profile.email}
                                            disabled
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-[#17cf54] focus:border-[#17cf54] text-gray-900"
                                            placeholder="+1 234 567 8900"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                                        <input
                                            type="text"
                                            value={formData.specialization}
                                            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-[#17cf54] focus:border-[#17cf54] text-gray-900"
                                            placeholder="e.g. Sports Nutrition, Weight Loss"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                                        <textarea
                                            rows={3}
                                            value={formData.bio}
                                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                            placeholder="Tell use about yourself..."
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-[#17cf54] focus:border-[#17cf54] text-gray-900"
                                        />
                                    </div>

                                    <div className="md:col-span-2 pt-2">
                                        <button
                                            type="submit"
                                            disabled={updateProfile.isPending}
                                            className="px-4 py-2.5 text-sm font-bold text-white bg-[#17cf54] rounded-lg hover:bg-[#17cf54]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {updateProfile.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Notifications Section */}
                        {activeSection === 'notifications' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>

                                <div className="space-y-4">
                                    {[
                                        { key: 'email', label: 'Email Notifications', desc: 'Receive updates via email' },
                                        { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications' },
                                        { key: 'mealReminders', label: 'Meal Review Reminders', desc: 'Get notified when clients submit meals' },
                                        { key: 'weeklyReports', label: 'Weekly Reports', desc: 'Receive weekly summary reports' },
                                    ].map((item) => (
                                        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-medium text-gray-900">{item.label}</p>
                                                <p className="text-sm text-gray-500">{item.desc}</p>
                                            </div>
                                            <button
                                                onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                                                className={`w-12 h-6 rounded-full transition-colors ${notifications[item.key as keyof typeof notifications] ? 'bg-[#17cf54]' : 'bg-gray-300'
                                                    }`}
                                            >
                                                <div
                                                    className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-0.5'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Appearance Section */}
                        {activeSection === 'appearance' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-gray-900">Appearance</h2>

                                <div>
                                    <p className="font-medium text-gray-900 mb-3">Theme</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        {['Light', 'Dark', 'System'].map((theme) => (
                                            <button
                                                key={theme}
                                                className={`p-4 rounded-lg border-2 transition-colors ${theme === 'Light' ? 'border-[#17cf54] bg-[#17cf54]/5' : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full mx-auto mb-2 ${theme === 'Light' ? 'bg-white border border-gray-200' :
                                                    theme === 'Dark' ? 'bg-gray-800' : 'bg-gradient-to-r from-white to-gray-800'
                                                    }`} />
                                                <p className="text-sm font-medium text-gray-900">{theme}</p>
                                                {theme === 'Light' && <Check className="w-4 h-4 text-[#17cf54] mx-auto mt-1" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Other Sections - Placeholder */}
                        {['security', 'language', 'billing', 'help'].includes(activeSection) && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    {(() => {
                                        const section = settingsSections.find(s => s.id === activeSection);
                                        if (section) {
                                            const Icon = section.icon;
                                            return <Icon className="w-8 h-8 text-gray-400" />;
                                        }
                                        return null;
                                    })()}
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    {settingsSections.find(s => s.id === activeSection)?.name}
                                </h3>
                                <p className="text-gray-500">This section is coming soon.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
