import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Leaf,
  UtensilsCrossed,
  Users,
  BarChart3,
  Calendar,
  Shield,
  Smartphone,
  ArrowRight,
  Quote,
  CheckCircle,
  Menu,
} from 'lucide-react';

const features = [
  {
    icon: UtensilsCrossed,
    title: 'Smart Meal Planning',
    description: 'AI-assisted drag-and-drop diet creation. Create balanced plans in seconds, not hours.',
  },
  {
    icon: Users,
    title: 'Client Portal',
    description: 'Secure direct messaging, document sharing, and progress tracking for your clients.',
  },
  {
    icon: BarChart3,
    title: 'Data Analytics',
    description: 'Visualize health trends, weight changes, and adherence rates instantly with beautiful charts.',
  },
  {
    icon: Calendar,
    title: 'Scheduling & Booking',
    description: 'Integrated calendar that syncs with Google and Outlook. Reduce no-shows with automated reminders.',
  },
  {
    icon: Shield,
    title: 'Secure & Compliant',
    description: 'Enterprise-grade security keeps your patient data safe and compliant with regulations.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Companion App',
    description: 'Give clients a dedicated app to log meals, view plans, and stay connected on the go.',
  },
];

const testimonials = [
  {
    quote: "Diet Karo cut my administrative time in half. The meal planning tool is intuitive and my clients love the mobile app. It's a game changer.",
    name: 'Dr. Priya Sharma',
    role: 'Clinical Dietician',
    avatar: 'PS',
  },
  {
    quote: "Finally, a dashboard that looks good and works even better. The analytics feature helps me show tangible progress to my patients.",
    name: 'Rahul Verma',
    role: 'Sports Nutritionist',
    avatar: 'RV',
  },
  {
    quote: "The automated compliance features give me peace of mind. I can manage more clients without feeling overwhelmed. Highly recommended.",
    name: 'Dr. Anjali Mehta',
    role: 'Private Practice Owner',
    avatar: 'AM',
  },
];

const stats = [
  { value: '10k+', label: 'Professionals' },
  { value: '2M+', label: 'Meal Plans Created' },
  { value: '98%', label: 'Customer Satisfaction' },
];

export default async function HomePage() {
  const { userId } = await auth();

  // If user is logged in, redirect to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#f6f8f6] text-[#0e1b12] font-sans antialiased overflow-x-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-[#e7f3eb] bg-[#f6f8f6]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-10 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#17cf54]/20 text-[#17cf54]">
                <Leaf className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight">Diet Karo</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium hover:text-[#17cf54] transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium hover:text-[#17cf54] transition-colors">Pricing</a>
              <a href="#about" className="text-sm font-medium hover:text-[#17cf54] transition-colors">About</a>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-bold hover:bg-black/5 rounded-lg transition-colors"
              >
                Login
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-2 text-sm font-bold bg-[#17cf54] hover:bg-[#17cf54]/90 text-[#0e1b12] rounded-lg shadow-sm shadow-[#17cf54]/20 transition-colors"
              >
                Get Started
              </Link>
            </div>
            <button className="md:hidden p-2">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative w-full">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-[#17cf54]/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-20 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Hero Content */}
            <div className="flex flex-col gap-6 flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 self-center lg:self-start px-3 py-1 rounded-full bg-[#17cf54]/10 border border-[#17cf54]/20 text-xs font-bold text-[#17cf54] uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#17cf54] animate-pulse" />
                New: AI Meal Planning
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
                Empower Your Practice with{' '}
                <span className="text-[#17cf54]">Intelligent</span> Nutrition.
              </h1>
              <p className="text-lg text-[#0e1b12]/70 max-w-2xl mx-auto lg:mx-0">
                Streamline client tracking, automate meal plans, and visualize patient progress in one secure dashboard tailored for modern dieticians.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <Link
                  href="/sign-up"
                  className="flex items-center justify-center gap-2 min-w-[140px] h-12 px-6 bg-[#17cf54] hover:bg-[#17cf54]/90 text-[#0e1b12] text-base font-bold rounded-lg shadow-lg shadow-[#17cf54]/25 transition-all"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center min-w-[140px] h-12 px-6 bg-white border border-[#e7f3eb] hover:bg-[#f0fdf4] text-base font-bold rounded-lg transition-all"
                >
                  Book a Demo
                </Link>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-4 pt-2">
                <div className="flex -space-x-2">
                  {['PS', 'RK', 'AM'].map((initials, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-[#17cf54]/20 border-2 border-white flex items-center justify-center text-xs font-bold text-[#17cf54]"
                    >
                      {initials}
                    </div>
                  ))}
                  <div className="w-8 h-8 rounded-full bg-[#17cf54] text-[#0e1b12] text-[10px] font-bold border-2 border-white flex items-center justify-center">
                    +2k
                  </div>
                </div>
                <p className="text-sm font-medium text-[#0e1b12]/60">Professionals trust us</p>
              </div>
            </div>

            {/* Hero Image */}
            <div className="w-full lg:w-1/2 flex justify-center lg:justify-end relative">
              <div className="absolute -inset-4 bg-[#17cf54]/20 blur-3xl rounded-full opacity-30" />
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden shadow-2xl border border-black/5 bg-white">
                <div className="w-full h-full bg-gradient-to-br from-[#f0fdf4] to-[#e7f3eb] flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 mx-auto bg-[#17cf54]/10 rounded-2xl flex items-center justify-center mb-4">
                      <UtensilsCrossed className="w-12 h-12 text-[#17cf54]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#0e1b12]">Diet Dashboard</h3>
                    <p className="text-sm text-[#0e1b12]/60 mt-2">Analytics • Plans • Progress</p>
                  </div>
                </div>
                {/* Floating notification */}
                <div className="absolute bottom-6 left-6 p-4 bg-white rounded-lg shadow-lg border border-[#17cf54]/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#17cf54]">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-[#0e1b12]/50 font-medium">Daily Goal</p>
                    <p className="text-sm font-bold text-[#0e1b12]">Meal Plan Added</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="w-full bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-10">
          <div className="text-center mb-12">
            <span className="text-[#17cf54] font-bold tracking-wider text-sm uppercase mb-2 block">
              Core Features
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to run a modern clinic
            </h2>
            <p className="mt-4 text-[#0e1b12]/60 max-w-2xl mx-auto">
              Focus on your patients while we handle the administration, planning, and tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group flex flex-col gap-4 rounded-xl border border-[#d0e7d7] bg-[#f6f8f6] p-6 transition-all hover:shadow-lg hover:border-[#17cf54]/50"
              >
                <div className="w-12 h-12 rounded-lg bg-[#17cf54]/10 flex items-center justify-center text-[#17cf54] group-hover:bg-[#17cf54] group-hover:text-[#0e1b12] transition-colors">
                  <feature.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-[#4e9767] text-sm leading-relaxed mt-2">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="w-full bg-[#17cf54]/5 border-y border-[#17cf54]/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-10">
          <div className="flex flex-wrap justify-around items-center gap-8 text-center">
            {stats.map((stat, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-4xl font-black tracking-tight">{stat.value}</span>
                <span className="text-sm font-medium text-[#4e9767] uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="w-full py-20 bg-[#f6f8f6]">
        <div className="max-w-7xl mx-auto px-4 md:px-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              Trusted by Top Nutritionists
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="flex flex-col justify-between p-8 bg-white rounded-2xl shadow-sm border border-[#e7f3eb]"
              >
                <div className="mb-6 text-[#17cf54]">
                  <Quote className="w-10 h-10" />
                </div>
                <p className="text-lg font-medium leading-relaxed mb-8">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold">{testimonial.name}</h4>
                    <p className="text-sm text-[#4e9767]">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4">
        <div className="max-w-7xl mx-auto bg-[#0e1b12] rounded-3xl overflow-hidden relative">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(#17cf54 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-10 md:p-16 gap-10">
            <div className="flex flex-col gap-6 max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                Ready to modernize your practice?
              </h2>
              <p className="text-white/80 text-lg">
                Join thousands of health professionals using Diet Karo to deliver better care.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/sign-up"
                  className="flex items-center justify-center rounded-lg h-12 px-8 bg-[#17cf54] hover:bg-[#17cf54]/90 text-[#0e1b12] text-base font-bold shadow-lg shadow-[#17cf54]/30 transition-all"
                >
                  Get Started Now
                </Link>
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center rounded-lg h-12 px-8 bg-white/10 hover:bg-white/20 text-white text-base font-bold border border-white/20 transition-all"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
            <div className="hidden lg:block relative">
              <div className="w-64 h-64 bg-[#17cf54]/20 rounded-full blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <Leaf className="w-48 h-48 text-[#17cf54]/30 rotate-12" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e7f3eb] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1 flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#17cf54]/20 text-[#17cf54] flex items-center justify-center">
                  <Leaf className="w-4 h-4" />
                </div>
                <span className="font-bold text-lg">Diet Karo</span>
              </div>
              <p className="text-sm text-[#0e1b12]/60">
                The all-in-one platform for nutrition professionals to manage clients, plans, and progress.
              </p>
            </div>
            {/* Links */}
            <div className="flex flex-col gap-4">
              <h4 className="font-bold">Product</h4>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Features</a>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Pricing</a>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Case Studies</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-bold">Company</h4>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">About</a>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Careers</a>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Contact</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-bold">Legal</h4>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Terms of Service</a>
              <a href="#" className="text-sm text-[#0e1b12]/60 hover:text-[#17cf54] transition-colors">Cookie Policy</a>
            </div>
          </div>
          <div className="border-t border-[#e7f3eb] pt-8 text-center">
            <p className="text-sm text-[#0e1b12]/40">
              © 2025 Diet Karo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
