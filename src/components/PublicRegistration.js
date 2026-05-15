import React, { useState, useEffect } from 'react';
import { useAPI } from '../hooks/useAPI';

const PublicRegistration = ({ slug }) => {
  const api = useAPI();
  const [orgName, setOrgName] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading' | 'form' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    rating: '',
    gender: 'male'
  });

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}`);
        if (!response.ok) {
          throw new Error('Invalid or expired registration link');
        }
        const data = await response.json();
        setOrgName(data.orgName);
        setStatus('form');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    };
    fetchOrg();
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.rating) {
        return alert("First name and rating are required");
    }

    try {
      setStatus('submitting');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to register');
      }
      
      setStatus('success');
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
      setStatus('form');
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-brand-primary mb-2">Link Invalid</h2>
          <p className="text-brand-primary/70 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-brand-secondary text-brand-primary font-bold py-3 px-4 rounded-xl hover:bg-brand-secondary/90 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center py-10">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-black text-brand-primary mb-2">You're In!</h2>
          <p className="text-brand-primary/70 mb-8 max-w-[250px] mx-auto">
            You've been successfully added to <strong>{orgName}</strong> roster.
          </p>
          <button 
            onClick={() => setStatus('form')}
            className="w-full bg-brand-secondary/20 text-brand-primary font-bold py-3 px-4 rounded-xl hover:bg-brand-secondary/30 transition-colors"
          >
            Register Another Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-light font-sans p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-brand-gray/30">
        
        {/* Header content */}
        <div className="text-center mb-8">
          <div className="bg-brand-secondary/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-brand-secondary font-black leading-none pb-1 font-serif italic">d</span>
          </div>
          <h1 className="text-sm font-bold text-brand-primary/40 uppercase tracking-widest mb-2">Event Registration</h1>
          <h2 className="text-2xl font-black text-brand-primary leading-tight">Join {orgName}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-12 bg-brand-light rounded-xl border border-transparent px-4 py-2 border border-brand-primary/20 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all transition-colors"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-12 bg-brand-light rounded-xl border border-transparent px-4 py-2 border border-brand-primary/20 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all transition-colors"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">DUPR Rating</label>
            <input
              type="number"
              required
              step="0.01"
              min="2.0"
              max="6.0"
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
              className="w-full h-12 bg-brand-light rounded-xl border border-transparent px-4 py-2 border border-brand-primary/20 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all transition-colors"
              placeholder="e.g. 3.5"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full h-12 bg-brand-light rounded-xl border border-transparent px-4 py-2 border border-brand-primary/20 text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all transition-colors appearance-none"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full h-14 bg-brand-secondary text-brand-primary font-bold text-lg rounded-xl hover:bg-[#d6f060] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all mt-6 shadow-sm shadow-brand-secondary/20"
          >
            {status === 'submitting' ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="mt-8 text-center">
            <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary/40 hover:text-brand-primary/60 transition-colors">
            Powered by DinkSync
            </a>
        </div>
      </div>
    </div>
  );
};

export default PublicRegistration;
