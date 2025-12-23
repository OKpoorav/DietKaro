import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-emerald-800">DietConnect</h1>
                    <p className="text-gray-600 mt-2">Create your account</p>
                </div>
                <SignUp
                    appearance={{
                        elements: {
                            formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-700',
                            card: 'shadow-xl',
                        }
                    }}
                />
            </div>
        </div>
    );
}
