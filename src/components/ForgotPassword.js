import React, { useState } from 'react';

const ForgotPassword = ({ onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to request password reset');
            }

            setMessage(data.message || 'If an account exists, an email has been sent.');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-lime mb-2">SmashBoard</h1>
                    <p className="text-gray">Tournament Management System</p>
                </div>

                {/* Form */}
                <div className="bg-dark-gray rounded-lg p-8 shadow-xl border border-gray">
                    <h2 className="text-2xl font-bold text-white mb-6">Reset Password</h2>

                    {message && (
                        <div className="bg-green-500 bg-opacity-10 border border-green-500 text-green-500 rounded p-3 mb-4 text-sm">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 rounded p-3 mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-gray text-sm font-medium mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-2 bg-black border border-gray rounded focus:outline-none focus:border-lime text-white"
                                placeholder="your@email.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-lime text-black font-bold py-3 px-4 rounded hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending Link...' : 'Send Reset Link'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray text-sm">
                            Remember your password?{' '}
                            <button
                                onClick={onSwitchToLogin}
                                className="text-lime hover:underline font-medium"
                            >
                                Login
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
