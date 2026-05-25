import React, { useState, useEffect } from 'react';
import { useAPI } from '../hooks/useAPI';

const PublicRegistration = ({ slug }) => {
  const api = useAPI();
  const [orgName, setOrgName] = useState('');
  const [activeTournament, setActiveTournament] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'form' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    rating: '',
    gender: 'male',
    email: '',
    phone: '',
    duprId: '',
    waiverSigned: false,
    ageCategory: 'adult'
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
        if (data.activeTournament) {
          setActiveTournament(data.activeTournament);
        }
        setStatus('form');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    };
    fetchOrg();
  }, [slug]);

  const getValidationError = () => {
    if (!activeTournament) return null;

    // 1. Gender check
    const allowedGender = activeTournament.restricted_gender || 'all';
    if (allowedGender !== 'all') {
      const playerGender = (form.gender || 'male').toLowerCase();
      if (allowedGender === 'men' && playerGender !== 'male') {
        return "Registration locked: This tournament is restricted to Men's divisions only.";
      }
      if (allowedGender === 'women' && playerGender !== 'female') {
        return "Registration locked: This tournament is restricted to Women's divisions only.";
      }
    }

    // 2. Age check
    const allowedAge = activeTournament.restricted_age || 'all';
    if (allowedAge !== 'all') {
      const playerAge = (form.ageCategory || 'adult').toLowerCase();
      if (allowedAge === 'juniors' && playerAge !== 'junior') {
        return "Registration locked: This tournament is restricted to Juniors (Under 18) only.";
      }
      if (allowedAge === 'adults' && playerAge !== 'adult') {
        return "Registration locked: This tournament is restricted to Adults (18-49) only.";
      }
      if (allowedAge === 'seniors' && playerAge !== 'senior') {
        return "Registration locked: This tournament is restricted to Seniors (50+) only.";
      }
    }

    // 3. Skill rating check
    const allowedSkill = activeTournament.restricted_skill || 'all';
    if (allowedSkill !== 'all' && form.rating) {
      const playerRating = parseFloat(form.rating);
      if (!isNaN(playerRating)) {
        let minRating = 0;
        let maxRating = 10;
        let skillLabel = "";
        
        if (allowedSkill === '2.5-2.9') { minRating = 2.5; maxRating = 2.99; skillLabel = "Novice (2.5-2.99)"; }
        else if (allowedSkill === '3.0-3.4') { minRating = 3.0; maxRating = 3.49; skillLabel = "Intermediate (3.0-3.49)"; }
        else if (allowedSkill === '3.5-3.9') { minRating = 3.5; maxRating = 3.99; skillLabel = "High Intermediate (3.5-3.99)"; }
        else if (allowedSkill === '4.0-4.4') { minRating = 4.0; maxRating = 4.49; skillLabel = "Advanced (4.0-4.49)"; }
        else if (allowedSkill === '4.5-5.0') { minRating = 4.5; maxRating = 5.09; skillLabel = "High Advanced (4.5-5.09)"; }
        else if (allowedSkill === 'semi_pro') { minRating = 5.1; maxRating = 5.49; skillLabel = "Semi-Pro (5.1-5.49)"; }
        else if (allowedSkill === 'pro') { minRating = 5.5; maxRating = 10.0; skillLabel = "Professional (5.5+)"; }
        
        if (skillLabel && (playerRating < minRating || playerRating > maxRating)) {
          return `Registration locked: This tournament is restricted to the ${skillLabel} skill division.`;
        }
      }
    }

    return null;
  };

  const validationError = getValidationError();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validationError) {
      return alert(validationError);
    }
    if (!form.firstName || !form.rating) {
      return alert("First name and rating are required");
    }
    if (!form.waiverSigned) {
      return alert("You must sign the Liability Waiver and Terms to register.");
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center border border-brand-gray/30">
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center py-10 border border-brand-gray/30">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-black text-brand-primary mb-2">You're In!</h2>
          <p className="text-brand-primary/70 mb-8 max-w-[250px] mx-auto text-sm">
            You have successfully registered for the event under <strong>{orgName}</strong> roster.
          </p>
          <button 
            onClick={() => {
              setForm({
                firstName: '',
                lastName: '',
                rating: '',
                gender: 'male',
                email: '',
                phone: '',
                duprId: '',
                waiverSigned: false,
                ageCategory: 'adult'
              });
              setStatus('form');
            }}
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
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-brand-gray/30 my-8">
        
        {/* Header content */}
        <div className="text-center mb-6">
          <div className="bg-brand-secondary/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl text-brand-secondary font-black leading-none pb-1 font-serif italic">d</span>
          </div>
          <h1 className="text-xs font-bold text-brand-primary/40 uppercase tracking-widest mb-1">Event Registration</h1>
          <h2 className="text-xl font-black text-brand-primary leading-tight">Join {orgName}</h2>
          {activeTournament && (
            <p className="text-xs text-brand-primary/60 mt-1 font-medium bg-brand-secondary/10 py-1 px-3 rounded-full inline-block">
              Event: <span className="font-bold">{activeTournament.tournament_name}</span>
            </p>
          )}
        </div>

        {/* Division constraint description banner */}
        {activeTournament && (
          <div className="bg-brand-light border border-brand-gray rounded-2xl p-3 mb-6 space-y-1.5 text-xs text-brand-primary">
            <div className="font-bold text-brand-primary/80 uppercase tracking-wide text-[10px]">Active Division Constraints</div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-brand-primary/40 block">Skill Level:</span>
                <span className="font-semibold capitalize">
                  {activeTournament.restricted_skill === 'all' ? 'Open' : activeTournament.restricted_skill}
                </span>
              </div>
              <div>
                <span className="text-brand-primary/40 block">Age Limit:</span>
                <span className="font-semibold capitalize">
                  {activeTournament.restricted_age === 'all' ? 'All Ages' : activeTournament.restricted_age}
                </span>
              </div>
              <div>
                <span className="text-brand-primary/40 block">Gender:</span>
                <span className="font-semibold capitalize">
                  {activeTournament.restricted_gender === 'all' ? 'Open' : activeTournament.restricted_gender === 'men' ? "Men's Only" : "Women's Only"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Lockout Warning Banner */}
        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start space-x-3 text-red-700 animate-pulse">
            <span className="text-xl leading-none">🔒</span>
            <div className="text-xs">
              <div className="font-bold uppercase tracking-wider text-[10px] mb-0.5">Registration Locked Out</div>
              <p className="font-medium">{validationError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">First Name</label>
              <input
                type="text"
                required
                disabled={!!validationError}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Last Name</label>
              <input
                type="text"
                disabled={!!validationError}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">DUPR Rating</label>
              <input
                type="number"
                required
                step="0.01"
                min="2.0"
                max="8.0"
                disabled={!!validationError}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm"
                placeholder="e.g. 3.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">DUPR ID</label>
              <input
                type="text"
                disabled={!!validationError}
                value={form.duprId}
                onChange={(e) => setForm({ ...form, duprId: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Gender</label>
              <select
                value={form.gender}
                disabled={!!validationError}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm appearance-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Age Division</label>
              <select
                value={form.ageCategory}
                disabled={!!validationError}
                onChange={(e) => setForm({ ...form, ageCategory: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm appearance-none"
              >
                <option value="junior">Junior (Under 18)</option>
                <option value="adult">Adult (18-49)</option>
                <option value="senior">Senior (50+)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Email</label>
              <input
                type="email"
                required
                disabled={!!validationError}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm"
                placeholder="you@email.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Phone</label>
              <input
                type="tel"
                required
                disabled={!!validationError}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all disabled:opacity-50 text-sm"
                placeholder="(555) 000-0000"
              />
            </div>
          </div>

          {/* Waiver checkbox */}
          <div className="border border-brand-gray bg-brand-light/35 rounded-2xl p-3.5 space-y-2 mt-4">
            <div className="flex items-start space-x-2.5">
              <input 
                id="waiverSigned"
                type="checkbox"
                required
                disabled={!!validationError}
                checked={form.waiverSigned}
                onChange={(e) => setForm({ ...form, waiverSigned: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-brand-primary/20 text-brand-secondary focus:ring-brand-secondary focus:outline-none cursor-pointer"
              />
              <label htmlFor="waiverSigned" className="text-[11px] text-brand-primary/70 leading-normal cursor-pointer select-none">
                I agree to the <a href="/terms" target="_blank" className="font-bold text-brand-primary underline hover:text-brand-secondary transition-colors">Terms of Service</a> and the <a href="/waiver" target="_blank" className="font-bold text-brand-primary underline hover:text-brand-secondary transition-colors">Liability Waiver</a>. I certify my credentials are correct.
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting' || !!validationError}
            className="w-full h-12 bg-brand-secondary text-brand-primary font-bold text-base rounded-xl hover:bg-[#d6f060] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:hover:translate-y-0 transition-all mt-6 shadow-sm shadow-brand-secondary/20 uppercase tracking-wider"
          >
            {status === 'submitting' ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-primary/40 hover:text-brand-primary/60 transition-colors uppercase tracking-widest">
            Powered by DinkSync
          </a>
        </div>
      </div>
    </div>
  );
};

export default PublicRegistration;
