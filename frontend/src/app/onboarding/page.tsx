'use client';

import { useCallback, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { TagInput } from '@/components/ui/tag-input';

const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/v1`;

interface ClientInfo {
    id: string;
    fullName: string;
    email?: string;
    phone: string;
    heightCm?: string | number | null;
    currentWeightKg?: string | number | null;
    targetWeightKg?: string | number | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    activityLevel?: string | null;
    dietPattern?: string | null;
    eggAllowed?: boolean | null;
    goal?: string | null;
    goalDeadline?: string | null;
    allergies?: string[] | null;
    dislikes?: string[] | null;
    likedFoods?: string[] | null;
}

function OnboardingForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [state, setState] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
    const [client, setClient] = useState<ClientInfo | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        heightCm: '',
        currentWeightKg: '',
        targetWeightKg: '',
        dateOfBirth: '',
        gender: '',
        activityLevel: '',
        dietPattern: '',
        eggAllowed: '',
        goal: '',
        goalDeadline: '',
    });
    const [allergies, setAllergies] = useState<string[]>([]);
    const [dislikes, setDislikes] = useState<string[]>([]);
    const [likedFoods, setLikedFoods] = useState<string[]>([]);
    const [beforePhotos, setBeforePhotos] = useState<{ front: string | null; side: string | null; back: string | null }>({ front: null, side: null, back: null });
    const [uploadingPhoto, setUploadingPhoto] = useState<{ front: boolean; side: boolean; back: boolean }>({ front: false, side: false, back: false });

    useEffect(() => {
        if (!token) { setState('error'); setErrorMsg('Invalid link. No token provided.'); return; }
        axios.get(`${API}/onboarding-invite/${token}`)
            .then((res) => {
                const c: ClientInfo = res.data.data.client;
                setClient(c);
                // Prefill everything the dietitian already entered — the client
                // reviews and corrects instead of retyping from scratch
                const num = (v: string | number | null | undefined) => (v != null && v !== '' ? String(Number(v)) : '');
                const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '');
                setForm((f) => ({
                    ...f,
                    heightCm: num(c.heightCm),
                    currentWeightKg: num(c.currentWeightKg),
                    targetWeightKg: num(c.targetWeightKg),
                    dateOfBirth: day(c.dateOfBirth),
                    gender: c.gender ?? '',
                    activityLevel: c.activityLevel ?? '',
                    dietPattern: c.dietPattern ?? '',
                    eggAllowed: c.eggAllowed == null ? '' : c.eggAllowed ? 'yes' : 'no',
                    goal: c.goal ?? '',
                    goalDeadline: day(c.goalDeadline),
                }));
                if (c.allergies?.length) setAllergies(c.allergies);
                if (c.dislikes?.length) setDislikes(c.dislikes);
                if (c.likedFoods?.length) setLikedFoods(c.likedFoods);
                setState('form');
            })
            .catch((err) => {
                const msg = err?.response?.data?.error?.message ?? 'This link is invalid or has expired.';
                setErrorMsg(msg);
                setState('error');
            });
    }, [token]);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const searchIngredients = useCallback(async (q: string): Promise<string[]> => {
        if (!token) return [];
        try {
            const { data } = await axios.get(`${API}/onboarding-invite/${token}/base-ingredients`, { params: { q } });
            return (data?.data ?? []).map((x: { name: string }) => x.name);
        } catch {
            return [];
        }
    }, [token]);

    const searchFoodItems = useCallback(async (q: string): Promise<string[]> => {
        if (!token) return [];
        try {
            const { data } = await axios.get(`${API}/onboarding-invite/${token}/food-items`, { params: { q } });
            return (data?.data ?? []).map((x: { name: string }) => x.name);
        } catch {
            return [];
        }
    }, [token]);

    const handlePhotoChange = async (type: 'front' | 'side' | 'back', file: File | null) => {
        if (!file || !token) return;
        setUploadingPhoto((p) => ({ ...p, [type]: true }));
        try {
            const fd = new FormData();
            fd.append('photo', file);
            const res = await axios.post(`${API}/onboarding-invite/${token}/upload-photo?type=${type}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setBeforePhotos((p) => ({ ...p, [type]: res.data.data.url }));
        } catch {
            // silently skip — photos are optional
        } finally {
            setUploadingPhoto((p) => ({ ...p, [type]: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: Record<string, unknown> = {};
            if (form.heightCm) payload.heightCm = Number(form.heightCm);
            if (form.currentWeightKg) payload.currentWeightKg = Number(form.currentWeightKg);
            if (form.targetWeightKg) payload.targetWeightKg = Number(form.targetWeightKg);
            if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
            if (form.gender) payload.gender = form.gender;
            if (form.activityLevel) payload.activityLevel = form.activityLevel;
            if (form.dietPattern) payload.dietPattern = form.dietPattern;
            if (form.eggAllowed !== '') payload.eggAllowed = form.eggAllowed === 'yes';
            if (form.goal) payload.goal = form.goal;
            if (form.goalDeadline) payload.goalDeadline = form.goalDeadline;
            if (allergies.length > 0) payload.allergies = allergies;
            if (dislikes.length > 0) payload.dislikes = dislikes;
            if (likedFoods.length > 0) payload.likedFoods = likedFoods;
            if (beforePhotos.front) payload.beforePhotoFrontUrl = beforePhotos.front;
            if (beforePhotos.side) payload.beforePhotoSideUrl = beforePhotos.side;
            if (beforePhotos.back) payload.beforePhotoBackUrl = beforePhotos.back;

            await axios.post(`${API}/onboarding-invite/${token}/submit`, payload);
            setState('done');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Something went wrong. Please try again.';
            setErrorMsg(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const input = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors';
    const label = 'block text-sm font-medium text-gray-700 mb-1.5';

    if (state === 'loading') return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (state === 'error') return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Link Unavailable</h2>
                <p className="text-sm text-gray-500">{errorMsg}</p>
                <p className="text-xs text-gray-400 mt-4">Contact your dietitian to get a new link.</p>
            </div>
        </div>
    );

    if (state === 'done') return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4 text-2xl">🎉</div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">All Done!</h2>
                <p className="text-sm text-gray-500">Your information has been submitted. Your dietitian will get started on your plan soon.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3 text-lg font-bold text-emerald-700">
                        {client?.fullName?.charAt(0)}
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Welcome, {client?.fullName?.split(' ')[0]}!</h1>
                    <p className="text-sm text-gray-500 mt-1">Fill in your details so we can build your personalised plan.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                    {/* Body Stats */}
                    <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Body Stats</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={label}>Date of Birth</label>
                                <input type="date" className={input} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                            </div>
                            <div>
                                <label className={label}>Gender</label>
                                <select className={input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className={label}>Height (cm)</label>
                                <input type="number" className={input} placeholder="165" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
                            </div>
                            <div>
                                <label className={label}>Current Weight (kg)</label>
                                <input type="number" className={input} placeholder="70" value={form.currentWeightKg} onChange={(e) => set('currentWeightKg', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className={label}>Target Weight (kg)</label>
                                <input type="number" className={input} placeholder="65" value={form.targetWeightKg} onChange={(e) => set('targetWeightKg', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* Lifestyle */}
                    <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Lifestyle</p>
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Activity Level</label>
                                <select className={input} value={form.activityLevel} onChange={(e) => set('activityLevel', e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="sedentary">Sedentary (desk job, little exercise)</option>
                                    <option value="lightly_active">Lightly Active (1–3 days/week)</option>
                                    <option value="moderately_active">Moderately Active (3–5 days/week)</option>
                                    <option value="very_active">Very Active (daily intense exercise)</option>
                                </select>
                            </div>
                            <div>
                                <label className={label}>Diet Type</label>
                                <select className={input} value={form.dietPattern} onChange={(e) => set('dietPattern', e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="vegetarian">Vegetarian</option>
                                    <option value="non_vegetarian">Non-Vegetarian</option>
                                    <option value="vegan">Vegan</option>
                                    <option value="eggetarian">Eggetarian</option>
                                    <option value="jain">Jain</option>
                                </select>
                            </div>
                            {(form.dietPattern === 'vegetarian' || form.dietPattern === 'jain') && (
                                <div>
                                    <label className={label}>Do you eat eggs?</label>
                                    <div className="flex gap-3">
                                        {['yes', 'no'].map((v) => (
                                            <button key={v} type="button" onClick={() => set('eggAllowed', v)}
                                                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${form.eggAllowed === v ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                {v === 'yes' ? 'Yes' : 'No'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Food Preferences */}
                    <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Food Preferences</p>
                        <div className="space-y-4">
                            <div>
                                <label className={label}>Allergies</label>
                                <TagInput value={allergies} onChange={setAllergies} searchFn={searchIngredients} placeholder="Search ingredients..." />
                                <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add</p>
                            </div>
                            <div>
                                <label className={label}>Food Dislikes</label>
                                <TagInput value={dislikes} onChange={setDislikes} searchFn={searchFoodItems} placeholder="Search foods you don't like..." />
                                <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add</p>
                            </div>
                            <div>
                                <label className={label}>Food Likes</label>
                                <TagInput value={likedFoods} onChange={setLikedFoods} searchFn={searchFoodItems} placeholder="Search foods you enjoy..." />
                                <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add</p>
                            </div>
                        </div>
                    </section>

                    {/* Goal */}
                    <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Your Goal</p>
                        <div className="space-y-3">
                            <div>
                                <label className={label}>What&apos;s your goal?</label>
                                <input type="text" className={input} placeholder="e.g. Lose 10kg, Manage diabetes, Build muscle..." value={form.goal} onChange={(e) => set('goal', e.target.value)} />
                            </div>
                            <div>
                                <label className={label}>Target date (optional)</label>
                                <input type="date" className={input} value={form.goalDeadline} onChange={(e) => set('goalDeadline', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* Before Photos */}
                    <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Before Photos</p>
                        <p className="text-xs text-gray-400 mb-4">Optional — helps your dietitian track your progress visually.</p>
                        <div className="grid grid-cols-3 gap-3">
                            {(['front', 'side', 'back'] as const).map((type) => (
                                <label key={type} className="flex flex-col items-center gap-2 cursor-pointer">
                                    <div className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-colors ${beforePhotos[type] ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-emerald-300'}`}>
                                        {uploadingPhoto[type] ? (
                                            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                        ) : beforePhotos[type] ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={beforePhotos[type]!} alt={`${type} view`} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl text-gray-300">+</span>
                                        )}
                                    </div>
                                    <span className="text-xs font-medium text-gray-600 capitalize">{type} Pic</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(type, e.target.files?.[0] ?? null)} />
                                </label>
                            ))}
                        </div>
                    </section>

                    {errorMsg && <p className="text-sm text-red-500 text-center">{errorMsg}</p>}

                    <button type="submit" disabled={submitting}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                        {submitting ? 'Submitting...' : 'Submit My Details'}
                    </button>
                </form>

                <p className="text-center text-xs text-gray-400 mt-4">Your information is private and only shared with your dietitian.</p>
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <OnboardingForm />
        </Suspense>
    );
}
