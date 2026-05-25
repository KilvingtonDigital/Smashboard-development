import React, { useState, useEffect } from 'react';
import { useAPI } from '../hooks/useAPI';

const PublicRegistration = ({ slug, tournamentId }) => {
  const api = useAPI();
  const [orgName, setOrgName] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [registrationFee, setRegistrationFee] = useState(0.00);
  const [status, setStatus] = useState('loading'); // 'loading' | 'form' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const [isCheckinMode, setIsCheckinMode] = useState(false);
  const [checkinIdent, setCheckinIdent] = useState('');
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [checkinPlayerName, setCheckinPlayerName] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    rating: '',
    gender: 'male',
    email: '',
    phone: '',
    duprId: '',
    waiverSigned: false
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkin') === 'true') {
      setIsCheckinMode(true);
    }

    if (params.get('payment') === 'success') {
      setStatus('success');
    } else if (params.get('payment') === 'cancel') {
      alert('Checkout was cancelled. Please complete payment to complete registration.');
    }

    const fetchOrgAndTournament = async () => {
      try {
        const url = tournamentId 
          ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}/${tournamentId}`
          : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}`;
          
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Invalid or expired registration link');
        }
        const data = await response.json();
        setOrgName(data.orgName);
        if (data.tournamentName) {
          setTournamentName(data.tournamentName);
        }
        if (data.registrationFee) {
          setRegistrationFee(Number(data.registrationFee));
        }
        
        // Only override to form status if not redirected back from Stripe success
        if (params.get('payment') !== 'success') {
          setStatus('form');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    };
    fetchOrgAndTournament();
  }, [slug, tournamentId]);

  const handleCheckin = async (e) => {
    e.preventDefault();
    if (!checkinIdent.trim()) {
      return alert("Mobile number or email address is required.");
    }

    try {
      setStatus('submitting');
      const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}/${tournamentId}/checkin`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIdent: checkinIdent })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Check-in failed');
      }

      const data = await response.json();
      setCheckinPlayerName(data.player.name);
      setCheckinSuccess(true);
      setStatus('success');
    } catch (err) {
      alert(`Check-in failed: ${err.message}`);
      setStatus('form');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.rating) {
        return alert("First name and rating are required");
    }
    if (!form.email || !form.phone) {
        return alert("Email and phone number are required");
    }
    if (!form.waiverSigned) {
        return alert("You must agree to the Terms of Service and Liability Waiver to register.");
    }

    try {
      setStatus('submitting');

      if (tournamentId && registrationFee > 0) {
        // Paid registration - create secure Stripe Checkout Session
        const checkoutUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/payments/checkout-session`;
        const response = await fetch(checkoutUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId,
            ...form
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to initiate checkout session');
        }

        const data = await response.json();
        // Redirect directly to the secure hosted Stripe Checkout page!
        window.location.href = data.url;
        return;
      }

      // Free registration
      const url = tournamentId 
        ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}/${tournamentId}`
        : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}`;

      const response = await fetch(url, {
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

  if (isCheckinMode) {
    if (status === 'success' && checkinSuccess) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center py-10 border border-brand-gray/30">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-black text-brand-primary mb-2">Checked In!</h2>
            <p className="text-sm font-semibold text-brand-primary/70 mb-8 max-w-[280px] mx-auto leading-relaxed">
              Welcome, <strong>{checkinPlayerName}</strong>! You have successfully signed in. Your name is now green on the Lobby TV check-in board.
            </p>
            <button 
              onClick={() => {
                setCheckinIdent('');
                setCheckinSuccess(false);
                setStatus('form');
              }}
              className="w-full bg-brand-secondary/20 text-brand-primary font-bold py-3 px-4 rounded-xl hover:bg-brand-secondary/30 transition-colors text-sm"
            >
              Check In Another Player
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light font-sans p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-brand-gray/30">
          <div className="text-center mb-6">
            <div className="grid h-8 w-8 place-items-center mx-auto mb-3 rounded-lg bg-brand-primary text-white font-bold text-sm tracking-tight"><span><span className="text-white">D</span><span className="text-brand-secondary">S</span></span></div>
            <h1 className="text-sm font-bold text-brand-primary/40 uppercase tracking-widest mb-1">Contactless Check-In</h1>
            <h2 className="text-2xl font-black text-brand-primary leading-tight">
              {tournamentName ? `Check In for ${tournamentName}` : `Check In`}
            </h2>
            <p className="text-xs font-semibold text-brand-primary/50 mt-2">Hosted by {orgName}</p>
          </div>

          <form onSubmit={handleCheckin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Phone Number or Email</label>
              <input
                type="text"
                required
                value={checkinIdent}
                onChange={(e) => setCheckinIdent(e.target.value)}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
                placeholder="e.g. (555) 123-4567 or jane@example.com"
              />
              <p className="text-[10px] text-brand-primary/40 font-medium ml-1 mt-1 leading-normal text-left">
                Enter the mobile phone number or email address you used when registering for this tournament.
              </p>
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full h-12 bg-brand-secondary text-brand-primary font-bold text-base rounded-xl hover:bg-[#d6f060] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all mt-4 shadow-sm shadow-brand-secondary/20"
            >
              {status === 'submitting' ? 'Checking in...' : 'Confirm Check-In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary/40 hover:text-brand-primary/60 transition-colors">
              Powered by DinkSync
            </a>
          </div>
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
            {tournamentName ? (
              <>You've been successfully registered for <strong>{tournamentName}</strong>!</>
            ) : (
              <>You've been successfully added to <strong>{orgName}</strong> roster.</>
            )}
          </p>

          {registrationFee > 0 && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 mb-8 text-left space-y-1 max-w-[280px] mx-auto shadow-sm">
              <div className="flex justify-between text-xs text-emerald-800 font-bold uppercase tracking-wide">
                <span>Payment Confirmed</span>
                <span>✓ Paid</span>
              </div>
              <div className="text-sm font-black text-emerald-900 mt-1">
                Entry Fee: ${registrationFee.toFixed(2)} USD
              </div>
              <p className="text-[10px] text-emerald-700/80 font-semibold mt-1 leading-normal">
                Your registration fee is fully settled. Checked-in lobby dashboards are synchronized! 🏓
              </p>
            </div>
          )}
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
                waiverSigned: false
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
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-brand-gray/30">
        
        {/* Header content */}
        <div className="text-center mb-6">
          <div className="grid h-8 w-8 place-items-center mx-auto mb-3 rounded-lg bg-brand-primary text-white font-bold text-sm tracking-tight"><span><span className="text-white">D</span><span className="text-brand-secondary">S</span></span></div>
          <h1 className="text-sm font-bold text-brand-primary/40 uppercase tracking-widest mb-1">Event Registration</h1>
          <h2 className="text-2xl font-black text-brand-primary leading-tight">
            {tournamentName ? `Register for ${tournamentName}` : `Join ${orgName}`}
          </h2>
          {tournamentName && (
            <p className="text-xs font-semibold text-brand-primary/50 mt-1">Hosted by {orgName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">DUPR Rating</label>
              <input
                type="number"
                required
                step="0.01"
                min="2.0"
                max="8.0"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
                placeholder="e.g. 3.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm appearance-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Email Address</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
              placeholder="jane.smith@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide ml-1">Phone Number</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
              placeholder="(555) 000-0000"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold text-brand-primary uppercase tracking-wide">DUPR ID</label>
              <span className="text-[10px] text-brand-primary/40 font-semibold uppercase">Optional</span>
            </div>
            <input
              type="text"
              value={form.duprId}
              onChange={(e) => setForm({ ...form, duprId: e.target.value })}
              className="w-full h-11 bg-brand-light rounded-xl border border-brand-primary/10 px-4 py-2 text-brand-primary placeholder-brand-primary/30 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:bg-white transition-all text-sm"
              placeholder="e.g. DUPR12345"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start cursor-pointer select-none group">
              <div className="relative mt-0.5 mr-3">
                <input
                  type="checkbox"
                  required
                  checked={form.waiverSigned}
                  onChange={(e) => setForm({ ...form, waiverSigned: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                  form.waiverSigned 
                    ? 'bg-brand-secondary border-brand-secondary text-brand-primary scale-100 shadow-sm shadow-brand-secondary/20' 
                    : 'bg-brand-light border-brand-primary/20 group-hover:border-brand-secondary/60'
                }`}>
                  {form.waiverSigned && (
                    <svg className="w-3.5 h-3.5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-brand-primary/70 leading-normal">
                I agree to the{' '}
                <a 
                  href="/terms" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-bold text-brand-primary underline hover:text-brand-secondary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a 
                  href="/waiver" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-bold text-brand-primary underline hover:text-brand-secondary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Liability Waiver
                </a>.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full h-12 bg-brand-secondary text-brand-primary font-bold text-base rounded-xl hover:bg-[#d6f060] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all mt-4 shadow-sm shadow-brand-secondary/20"
          >
            {status === 'submitting' 
              ? 'Processing...' 
              : registrationFee > 0 
                ? `Checkout & Pay $${registrationFee.toFixed(2)}` 
                : 'Register'
            }
          </button>
        </form>

        <div className="mt-6 text-center">
            <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary/40 hover:text-brand-primary/60 transition-colors">
            Powered by DinkSync
            </a>
        </div>
      </div>
    </div>
  );
};

export default PublicRegistration;
